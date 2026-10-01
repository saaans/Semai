-- =============================================================================
-- Semai · Pembayaran langganan lewat Midtrans (Snap, VA + QRIS)
--
-- Alur:
-- 1. Owner memilih paket → create_checkout_invoice() menghitung nominal di
--    database dan membuat invoice pending (berlaku 24 jam).
-- 2. Server membuat transaksi Snap (order_id = invoices.number) lalu
--    menyimpan link bayar lewat set_invoice_checkout() (service role).
-- 3. Webhook Midtrans (signature + status dicek ulang di server) memanggil
--    apply_payment() (service role). Idempoten: notifikasi berulang aman.
--
-- Aturan nominal dan periode:
--   baru        dari Benih/trial         harga penuh, periode mulai saat bayar
--   upgrade     ke paket lebih mahal     harga baru - sisa nilai paket lama
--                                        (prorata, dibulatkan ke bawah),
--                                        periode mulai saat bayar
--   perpanjang  paket sama/lebih murah   harga penuh, bisa dibayar mulai 7
--               atau ganti siklus        hari sebelum periode berakhir;
--                                        periode mulai dari akhir periode
--                                        lama, kecuali sudah lewat tenggang
--                                        7 hari (baca saja) → mulai saat bayar
-- Uang selalu bigint rupiah.
-- - Aman dijalankan ulang.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Kolom invoice
-- -----------------------------------------------------------------------------

alter table public.invoices
  add column if not exists plan_code      text references public.plans (code),
  add column if not exists billing_cycle  text,
  add column if not exists kind           text,
  add column if not exists credit_amount  bigint not null default 0,
  add column if not exists checkout_url   text,
  add column if not exists expires_at     timestamptz;

alter table public.invoices drop constraint if exists invoices_billing_cycle_check;
alter table public.invoices add constraint invoices_billing_cycle_check
  check (billing_cycle is null or billing_cycle in ('bulanan', 'tahunan'));
alter table public.invoices drop constraint if exists invoices_kind_check;
alter table public.invoices add constraint invoices_kind_check
  check (kind is null or kind in ('baru', 'upgrade', 'perpanjang'));
alter table public.invoices drop constraint if exists invoices_credit_amount_check;
alter table public.invoices add constraint invoices_credit_amount_check check (credit_amount >= 0);

comment on column public.invoices.kind is 'baru (dari Benih/trial), upgrade (ke paket lebih mahal, prorata), perpanjang (periode berikutnya).';
comment on column public.invoices.credit_amount is 'Potongan sisa nilai paket lama untuk upgrade (rupiah).';
comment on column public.invoices.checkout_url is 'Link halaman bayar Midtrans Snap.';

-- Maksimal satu tagihan pending per usaha.
create unique index if not exists invoices_one_pending_idx on public.invoices (company_id)
  where status = 'pending';


-- -----------------------------------------------------------------------------
-- Log notifikasi pembayaran (debug + jejak). Hanya service role yang menulis.
-- -----------------------------------------------------------------------------

create table if not exists public.payment_events (
  id                  bigint generated always as identity primary key,
  provider            text not null default 'midtrans',
  order_id            text,
  transaction_status  text,
  signature_valid     boolean not null,
  payload             jsonb not null,
  result              text,
  created_at          timestamptz not null default now()
);

create index if not exists payment_events_order_idx on public.payment_events (order_id, created_at desc);

alter table public.payment_events enable row level security;

drop policy if exists "Super admin melihat notifikasi pembayaran" on public.payment_events;
create policy "Super admin melihat notifikasi pembayaran" on public.payment_events
  for select to authenticated using (public.is_platform_admin());

grant select on public.payment_events to authenticated;


-- -----------------------------------------------------------------------------
-- Hitungan
-- -----------------------------------------------------------------------------

-- Harga satu periode untuk paket + siklus. null = harga custom.
create or replace function public.plan_cycle_price(p_plan_code text, p_cycle text)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select case when p_cycle = 'tahunan' then p.price_yearly else p.price_monthly end
  from public.plans p where p.code = p_plan_code;
$$;

-- "1 Nov 2026" dalam WIB, untuk pesan error.
create or replace function public.format_tanggal(p_value timestamptz)
returns text
language sql
immutable
set search_path = ''
as $$
  select extract(day from p_value at time zone 'Asia/Jakarta')::int || ' '
    || (array['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'])
         [extract(month from p_value at time zone 'Asia/Jakarta')::int]
    || ' ' || extract(year from p_value at time zone 'Asia/Jakarta')::int;
$$;

create or replace function public.cycle_interval(p_cycle text)
returns interval
language sql
immutable
set search_path = ''
as $$
  select case when p_cycle = 'tahunan' then interval '1 year' else interval '1 month' end;
$$;


-- -----------------------------------------------------------------------------
-- Buat tagihan
-- -----------------------------------------------------------------------------

create or replace function public.create_checkout_invoice(
  p_company_id  uuid,
  p_plan_code   text,
  p_cycle       text
)
returns public.invoices
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan      public.plans;
  v_sub       public.subscriptions;
  v_cur_plan  public.plans;
  v_price     bigint;
  v_cur_price bigint;
  v_used      integer;
  v_kind      text;
  v_credit    bigint := 0;
  v_amount    bigint;
  v_existing  public.invoices;
  v_invoice   public.invoices;
  v_open_at   timestamptz;
begin
  if not public.is_company_owner(p_company_id) then
    raise exception 'Hanya owner yang bisa membayar paket.' using errcode = '42501';
  end if;
  if p_cycle is null or p_cycle not in ('bulanan', 'tahunan') then
    raise exception 'Pilih pembayaran bulanan atau tahunan.' using errcode = 'P0001', hint = 'siklus_tidak_valid';
  end if;

  -- Satu per satu per usaha supaya klik ganda tidak membuat dua tagihan.
  perform 1 from public.companies c where c.id = p_company_id for update;

  select * into v_plan from public.plans p
  where p.code = p_plan_code and p.is_active and p.level <> 'benih';
  v_price := public.plan_cycle_price(p_plan_code, p_cycle);
  if v_plan.code is null or v_price is null or v_price <= 0 then
    raise exception 'Paket ini tidak bisa dibayar online. Pilih paket lain atau hubungi tim Semai.'
      using errcode = 'P0001', hint = 'paket_tidak_ada';
  end if;

  select count(*) into v_used from public.employees e
  where e.company_id = p_company_id and e.status in ('aktif', 'diundang');
  if v_plan.max_employees is not null and v_used > v_plan.max_employees then
    raise exception 'Paket % hanya untuk % karyawan, sedangkan karyawanmu % orang. Pilih paket yang lebih besar.',
      v_plan.name, v_plan.max_employees, v_used
      using errcode = 'P0001', hint = 'paket_kecil';
  end if;

  v_sub := public.current_subscription(p_company_id);

  if v_sub.id is null or v_sub.status = 'trialing' then
    v_kind := 'baru';
  else
    select * into v_cur_plan from public.plans p where p.code = v_sub.plan_code;
    if coalesce(v_plan.price_monthly, 0) > coalesce(v_cur_plan.price_monthly, 0) then
      v_kind := 'upgrade';
      -- Sisa nilai periode berjalan, dibulatkan ke bawah, tidak lebih dari harga baru.
      v_cur_price := coalesce(v_sub.price_override, public.plan_cycle_price(v_sub.plan_code, v_sub.billing_cycle), 0);
      if v_sub.current_period_start is not null and v_sub.current_period_end > now()
         and v_sub.current_period_end > v_sub.current_period_start then
        v_credit := floor(
          v_cur_price::numeric
          * extract(epoch from (v_sub.current_period_end - now()))::numeric
          / extract(epoch from (v_sub.current_period_end - v_sub.current_period_start))::numeric
        )::bigint;
      end if;
      v_credit := least(greatest(v_credit, 0), v_price);
    else
      v_kind := 'perpanjang';
      v_open_at := v_sub.current_period_end - interval '7 days';
      if v_sub.current_period_end is not null and now() < v_open_at then
        raise exception 'Paketmu aktif sampai %. Perpanjangan atau ganti paket bisa dibayar mulai %.',
          public.format_tanggal(v_sub.current_period_end),
          public.format_tanggal(v_open_at)
          using errcode = 'P0001', hint = 'belum_waktunya';
      end if;
    end if;
  end if;

  v_amount := v_price - v_credit;

  -- Pakai lagi tagihan pending yang sama (masih berlaku dan sudah punya link bayar).
  select * into v_existing from public.invoices i
  where i.company_id = p_company_id and i.status = 'pending'
  for update;
  if v_existing.id is not null then
    if v_existing.plan_code = p_plan_code and v_existing.billing_cycle = p_cycle
       and v_existing.kind = v_kind and v_existing.checkout_url is not null
       and v_existing.expires_at > now() + interval '1 hour' then
      return v_existing;
    end if;
    update public.invoices i set status = 'void' where i.id = v_existing.id;
  end if;

  insert into public.invoices (
    company_id, subscription_id, number, amount, status, due_at, expires_at,
    provider, plan_code, billing_cycle, kind, credit_amount
  )
  values (
    p_company_id,
    case when v_kind = 'perpanjang' then v_sub.id end,
    'SMI-' || to_char(now() at time zone 'Asia/Jakarta', 'YYMMDD') || '-'
      || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
    v_amount, 'pending', now() + interval '24 hours', now() + interval '24 hours',
    'midtrans', p_plan_code, p_cycle, v_kind, v_credit
  )
  returning * into v_invoice;

  perform public.log_audit(
    p_company_id, 'owner', 'invoice.create', 'invoices', v_invoice.id, null, null,
    jsonb_build_object(
      'number', v_invoice.number, 'plan_code', p_plan_code, 'billing_cycle', p_cycle,
      'kind', v_kind, 'amount', v_amount, 'credit_amount', v_credit
    )
  );

  -- Upgrade yang tertutup penuh oleh sisa nilai paket lama: langsung aktif.
  if v_amount = 0 then
    perform public.activate_invoice(v_invoice.id, 'kredit', null);
    select * into v_invoice from public.invoices i where i.id = v_invoice.id;
  end if;

  return v_invoice;
end;
$$;

-- Simpan link bayar Snap. Service role saja.
create or replace function public.set_invoice_checkout(p_invoice_id uuid, p_checkout_url text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.invoices i set checkout_url = p_checkout_url
  where i.id = p_invoice_id and i.status = 'pending';
$$;


-- -----------------------------------------------------------------------------
-- Terapkan pembayaran
-- -----------------------------------------------------------------------------

-- Tandai invoice lunas lalu buat/perpanjang langganan. Dipanggil dari
-- apply_payment (webhook) dan create_checkout_invoice (nominal 0).
create or replace function public.activate_invoice(
  p_invoice_id      uuid,
  p_payment_method  text,
  p_transaction_id  text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inv    public.invoices;
  v_sub    public.subscriptions;
  v_start  timestamptz;
  v_end    timestamptz;
  v_sub_id uuid;
begin
  select * into v_inv from public.invoices i where i.id = p_invoice_id for update;
  if v_inv.id is null or v_inv.status = 'paid' then
    return;
  end if;

  perform 1 from public.companies c where c.id = v_inv.company_id for update;
  v_sub := public.current_subscription(v_inv.company_id);

  if v_inv.kind = 'perpanjang' and v_sub.id is not null and v_sub.status in ('active', 'past_due') then
    -- Masih dalam tenggang: lanjut dari akhir periode lama. Sudah baca saja: mulai sekarang.
    v_start := case
      when v_sub.current_period_end is not null and now() < v_sub.current_period_end + interval '7 days'
        then v_sub.current_period_end
      else now()
    end;
    v_end := v_start + public.cycle_interval(v_inv.billing_cycle);
    update public.subscriptions s
    set plan_code = v_inv.plan_code, billing_cycle = v_inv.billing_cycle, status = 'active',
        current_period_start = v_start, current_period_end = v_end,
        cancel_at_period_end = false, provider = 'midtrans', ended_at = null
    where s.id = v_sub.id;
    v_sub_id := v_sub.id;
  else
    v_start := now();
    v_end := v_start + public.cycle_interval(v_inv.billing_cycle);
    update public.subscriptions s
    set status = 'canceled', ended_at = now()
    where s.company_id = v_inv.company_id and s.status in ('trialing', 'active', 'past_due');
    insert into public.subscriptions (
      company_id, plan_code, status, billing_cycle, current_period_start, current_period_end, provider
    )
    values (v_inv.company_id, v_inv.plan_code, 'active', v_inv.billing_cycle, v_start, v_end, 'midtrans')
    returning id into v_sub_id;
  end if;

  update public.invoices i
  set status = 'paid', paid_at = now(), payment_method = p_payment_method,
      provider_invoice_id = coalesce(p_transaction_id, i.provider_invoice_id),
      subscription_id = v_sub_id, period_start = v_start, period_end = v_end
  where i.id = v_inv.id;

  perform public.log_audit(
    v_inv.company_id, 'system', 'subscription.paid', 'subscriptions', v_sub_id, null,
    case when v_sub.id is null then null
         else jsonb_build_object('plan_code', v_sub.plan_code, 'status', v_sub.status,
                                 'current_period_end', v_sub.current_period_end) end,
    jsonb_build_object(
      'invoice', v_inv.number, 'plan_code', v_inv.plan_code, 'billing_cycle', v_inv.billing_cycle,
      'kind', v_inv.kind, 'amount', v_inv.amount, 'period_start', v_start, 'period_end', v_end
    )
  );

  perform public.apply_employee_limit(v_inv.company_id);
end;
$$;

-- Notifikasi Midtrans yang sudah diverifikasi server (signature + cek status).
-- p_outcome: paid | expired | failed | pending. Mengembalikan hasil singkat
-- untuk payment_events. Idempoten.
create or replace function public.apply_payment(
  p_order_id        text,
  p_outcome         text,
  p_gross_amount    bigint,
  p_payment_method  text,
  p_transaction_id  text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inv public.invoices;
begin
  select * into v_inv from public.invoices i where i.number = p_order_id for update;
  if v_inv.id is null then
    return 'invoice_tidak_ada';
  end if;
  if v_inv.status = 'paid' then
    return 'sudah_lunas';
  end if;

  if p_outcome = 'paid' then
    if p_gross_amount is distinct from v_inv.amount then
      return 'nominal_beda';
    end if;
    -- Dibayar setelah dibatalkan/diganti tetap diterima: uangnya sudah masuk.
    perform public.activate_invoice(v_inv.id, p_payment_method, p_transaction_id);
    return 'lunas';
  end if;

  if v_inv.status <> 'pending' then
    return 'diabaikan';
  end if;
  if p_outcome = 'expired' then
    update public.invoices i set status = 'expired' where i.id = v_inv.id;
    return 'kedaluwarsa';
  end if;
  if p_outcome = 'failed' then
    update public.invoices i set status = 'failed' where i.id = v_inv.id;
    return 'gagal';
  end if;
  return 'menunggu';
end;
$$;


-- -----------------------------------------------------------------------------
-- Hak akses fungsi
-- -----------------------------------------------------------------------------

revoke execute on function
  public.plan_cycle_price(text, text),
  public.cycle_interval(text),
  public.format_tanggal(timestamptz),
  public.create_checkout_invoice(uuid, text, text),
  public.set_invoice_checkout(uuid, text),
  public.activate_invoice(uuid, text, text),
  public.apply_payment(text, text, bigint, text, text)
from public, anon, authenticated;

grant execute on function public.create_checkout_invoice(uuid, text, text) to authenticated;

grant execute on function
  public.set_invoice_checkout(uuid, text),
  public.apply_payment(text, text, bigint, text, text)
to service_role;
