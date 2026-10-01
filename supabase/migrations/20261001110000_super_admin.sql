-- =============================================================================
-- Semai · Area super admin (PRD ADM-01 sampai ADM-04)
--
-- - Semua fungsi admin_* security definer dan menolak selain is_platform_admin().
-- - Super admin hanya melihat angka pemakaian (jumlah absen, jumlah gajian),
--   tidak pernah nama karyawan, foto, lokasi, atau nominal gaji.
-- - Setiap aksi (ubah paket, perpanjang trial, diskon, suspend/aktifkan) wajib
--   alasan dan tercatat di audit_logs dengan actor_role = 'platform_admin'.
-- - Suspend: owner/admin tidak bisa mengubah data apa pun (guard_read_only).
--   Absen karyawan tetap jalan.
-- - Diskon persen per usaha, opsional dengan batas tanggal. Dipakai saat
--   tagihan dibuat; harga setelah diskon disimpan di subscriptions.price_override
--   supaya MRR dan prorata upgrade memakai harga yang benar-benar dibayar.
-- - companies.last_active_at diisi saat ada absen dan saat owner membuka
--   dashboard, paling sering sekali per jam.
-- - Aman dijalankan ulang.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Kolom
-- -----------------------------------------------------------------------------

alter table public.companies
  add column if not exists suspend_reason    text,
  add column if not exists discount_percent  smallint,
  add column if not exists discount_until    timestamptz,
  add column if not exists discount_reason   text;

alter table public.companies drop constraint if exists companies_discount_percent_check;
alter table public.companies add constraint companies_discount_percent_check
  check (discount_percent is null or discount_percent between 1 and 100);

comment on column public.companies.suspended_at is 'Ditangguhkan tim Semai: owner/admin tidak bisa mengubah data. Absen karyawan tetap jalan.';
comment on column public.companies.discount_percent is 'Diskon persen dari tim Semai untuk tagihan berikutnya. null = tanpa diskon.';
comment on column public.companies.discount_until is 'Diskon berlaku untuk tagihan yang dibuat sebelum waktu ini. null = tanpa batas.';
comment on column public.companies.last_active_at is 'Aktivitas terakhir: absen karyawan atau owner membuka dashboard (dibulatkan per jam).';

alter table public.invoices
  add column if not exists discount_amount bigint not null default 0;

alter table public.invoices drop constraint if exists invoices_discount_amount_check;
alter table public.invoices add constraint invoices_discount_amount_check check (discount_amount >= 0);

comment on column public.invoices.discount_amount is 'Potongan diskon tim Semai dari harga paket (rupiah), sebelum potongan prorata.';

alter table public.subscriptions drop constraint if exists subscriptions_provider_check;
alter table public.subscriptions add constraint subscriptions_provider_check
  check (provider is null or provider in ('midtrans', 'xendit', 'manual'));

create index if not exists companies_last_active_idx on public.companies (last_active_at);
create index if not exists attendances_clock_in_idx on public.attendances (clock_in_at);
create index if not exists invoices_status_created_idx on public.invoices (status, created_at desc);


-- -----------------------------------------------------------------------------
-- Aktivitas terakhir usaha
-- -----------------------------------------------------------------------------

create or replace function public.touch_company_activity(p_company_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prev text := current_setting('semai.system_write', true);
begin
  perform set_config('semai.system_write', 'on', true);
  update public.companies c set last_active_at = now()
  where c.id = p_company_id
    and (c.last_active_at is null or c.last_active_at < now() - interval '1 hour');
  perform set_config('semai.system_write', coalesce(v_prev, ''), true);
end;
$$;

create or replace function public.attendance_touch_company()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.clock_in_at is not null or new.clock_out_at is not null then
    perform public.touch_company_activity(new.company_id);
  end if;
  return new;
end;
$$;

drop trigger if exists attendances_touch_company on public.attendances;
create trigger attendances_touch_company after insert or update of clock_in_at, clock_out_at on public.attendances
  for each row execute function public.attendance_touch_company();

-- Isi awal dari absen terakhir.
do $$
begin
  perform set_config('semai.system_write', 'on', true);
  update public.companies c
  set last_active_at = a.last_at
  from (
    select company_id, max(greatest(clock_in_at, coalesce(clock_out_at, clock_in_at))) as last_at
    from public.attendances
    where clock_in_at is not null
    group by company_id
  ) a
  where a.company_id = c.id and (c.last_active_at is null or c.last_active_at < a.last_at);
  perform set_config('semai.system_write', 'off', true);
end;
$$;

-- Sama seperti sebelumnya, ditambah catat aktivitas saat owner membuka dashboard.
create or replace function public.sync_plan_state(p_company_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null and not public.is_company_member(p_company_id) then
    raise exception 'Kamu tidak punya akses ke usaha ini.' using errcode = '42501';
  end if;

  perform set_config('semai.system_write', 'on', true);

  update public.subscriptions s
  set status = 'expired', ended_at = coalesce(s.ended_at, s.trial_ends_at)
  where s.company_id = p_company_id and s.status = 'trialing' and s.trial_ends_at <= now();

  update public.subscriptions s
  set status = 'past_due'
  where s.company_id = p_company_id and s.status = 'active'
    and s.current_period_end is not null and s.current_period_end <= now();

  perform set_config('semai.system_write', 'off', true);

  if auth.uid() is not null then
    perform public.touch_company_activity(p_company_id);
  end if;

  perform public.apply_employee_limit(p_company_id);
end;
$$;


-- -----------------------------------------------------------------------------
-- Suspend: owner/admin tidak bisa menulis apa pun. Absen karyawan tetap jalan
-- karena karyawan bukan anggota usaha (company_members).
-- -----------------------------------------------------------------------------

create or replace function public.is_company_suspended(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.companies c where c.id = p_company_id and c.suspended_at is not null);
$$;

create or replace function public.guard_read_only()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row        jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_company_id uuid;
begin
  -- Penulisan sistem (sync paket, webhook) dan service role selalu lolos.
  if coalesce(current_setting('semai.system_write', true), '') = 'on' or auth.uid() is null then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  v_company_id := case when tg_table_name = 'companies' then (v_row ->> 'id')::uuid
                       else (v_row ->> 'company_id')::uuid end;

  -- Bukan anggota (misalnya karyawan yang absen): biarkan RLS/RPC yang mengatur.
  if v_company_id is null or not public.is_company_member(v_company_id) then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if public.is_company_suspended(v_company_id) then
    raise exception 'Akun usahamu sedang ditangguhkan tim Semai, jadi data belum bisa diubah. Hubungi tim Semai lewat WhatsApp untuk mengaktifkannya lagi.'
      using errcode = 'P0001', hint = 'ditangguhkan';
  end if;

  if public.company_billing_state(v_company_id) = 'baca_saja' then
    raise exception 'Tagihan paket sudah lewat 7 hari, jadi data hanya bisa dilihat. Bayar tagihan atau turun ke Benih di menu Paket untuk mengubah data lagi.'
      using errcode = 'P0001', hint = 'baca_saja';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;


-- -----------------------------------------------------------------------------
-- Diskon pada tagihan
-- -----------------------------------------------------------------------------

-- Diskon persen yang berlaku sekarang, atau 0.
create or replace function public.company_discount_percent(p_company_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select c.discount_percent::integer from public.companies c
    where c.id = p_company_id and c.discount_percent is not null
      and (c.discount_until is null or now() < c.discount_until)
  ), 0);
$$;

-- Sama seperti versi pembayaran, ditambah diskon tim Semai. Diskon dihitung
-- dari harga paket (dibulatkan ke bawah), lalu prorata upgrade dipotong.
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
  v_discount  bigint := 0;
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

  if public.is_company_suspended(p_company_id) then
    raise exception 'Akun usahamu sedang ditangguhkan tim Semai. Hubungi tim Semai lewat WhatsApp.'
      using errcode = 'P0001', hint = 'ditangguhkan';
  end if;

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

  v_discount := floor(v_price::numeric * public.company_discount_percent(p_company_id) / 100)::bigint;
  v_price := v_price - v_discount;

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

  -- Pakai lagi tagihan pending yang sama (masih berlaku, nominal sama, sudah punya link bayar).
  select * into v_existing from public.invoices i
  where i.company_id = p_company_id and i.status = 'pending'
  for update;
  if v_existing.id is not null then
    if v_existing.plan_code = p_plan_code and v_existing.billing_cycle = p_cycle
       and v_existing.kind = v_kind and v_existing.amount = v_amount
       and v_existing.discount_amount = v_discount
       and v_existing.checkout_url is not null
       and v_existing.expires_at > now() + interval '1 hour' then
      return v_existing;
    end if;
    update public.invoices i set status = 'void' where i.id = v_existing.id;
  end if;

  insert into public.invoices (
    company_id, subscription_id, number, amount, status, due_at, expires_at,
    provider, plan_code, billing_cycle, kind, credit_amount, discount_amount
  )
  values (
    p_company_id,
    case when v_kind = 'perpanjang' then v_sub.id end,
    'SMI-' || to_char(now() at time zone 'Asia/Jakarta', 'YYMMDD') || '-'
      || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
    v_amount, 'pending', now() + interval '24 hours', now() + interval '24 hours',
    'midtrans', p_plan_code, p_cycle, v_kind, v_credit, v_discount
  )
  returning * into v_invoice;

  perform public.log_audit(
    p_company_id, 'owner', 'invoice.create', 'invoices', v_invoice.id, null, null,
    jsonb_build_object(
      'number', v_invoice.number, 'plan_code', p_plan_code, 'billing_cycle', p_cycle,
      'kind', v_kind, 'amount', v_amount, 'credit_amount', v_credit, 'discount_amount', v_discount
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

-- Saat invoice lunas, simpan harga per periode yang dibayar (setelah diskon,
-- sebelum prorata) di langganan. null = harga paket normal.
create or replace function public.invoice_paid_set_price()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prev text := current_setting('semai.system_write', true);
begin
  if new.status = 'paid' and old.status is distinct from 'paid' and new.subscription_id is not null then
    perform set_config('semai.system_write', 'on', true);
    update public.subscriptions s
    set price_override = case
      when new.discount_amount > 0
        then public.plan_cycle_price(new.plan_code, new.billing_cycle) - new.discount_amount
      end
    where s.id = new.subscription_id;
    perform set_config('semai.system_write', coalesce(v_prev, ''), true);
  end if;
  return new;
end;
$$;

drop trigger if exists invoices_paid_set_price on public.invoices;
create trigger invoices_paid_set_price after update of status on public.invoices
  for each row execute function public.invoice_paid_set_price();


-- -----------------------------------------------------------------------------
-- Hitungan untuk dashboard
-- -----------------------------------------------------------------------------

-- Nilai bulanan langganan (tahunan / 12, dibulatkan ke bawah). null = harga custom belum diisi.
create or replace function public.subscription_mrr(p_sub public.subscriptions)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_sub.billing_cycle = 'tahunan'
      then coalesce(p_sub.price_override, p.price_yearly) / 12
    else coalesce(p_sub.price_override, p.price_monthly)
  end
  from public.plans p where p.code = p_sub.plan_code;
$$;

-- Langganan berbayar yang menghasilkan uang: active/past_due, belum lewat tenggang 7 hari.
create or replace function public.is_paying_subscription(p_sub public.subscriptions)
returns boolean
language sql
stable
set search_path = ''
as $$
  select p_sub.status in ('active', 'past_due')
    and (p_sub.current_period_end is null or now() < p_sub.current_period_end + interval '7 days');
$$;

-- Usaha ini membayar pada waktu p_at: periode lunas + tenggang 7 hari dan
-- langganannya belum dihentikan, atau paket manual dari tim Semai.
create or replace function public.company_paid_at(p_company_id uuid, p_at timestamptz)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.invoices i
    left join public.subscriptions s on s.id = i.subscription_id
    where i.company_id = p_company_id and i.status = 'paid'
      and i.period_start <= p_at and p_at < i.period_end + interval '7 days'
      and p_at < coalesce(s.ended_at, 'infinity'::timestamptz)
  ) or exists (
    select 1 from public.subscriptions s
    where s.company_id = p_company_id and s.provider = 'manual' and s.trial_ends_at is null
      and s.current_period_start <= p_at
      and p_at < coalesce(s.ended_at, 'infinity'::timestamptz)
      and (s.current_period_end is null or p_at < s.current_period_end + interval '7 days')
  );
$$;

-- Pernah membayar (invoice lunas bernominal atau paket manual).
create or replace function public.company_ever_paid(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.invoices i
    where i.company_id = p_company_id and i.status = 'paid' and i.amount > 0
  ) or exists (
    select 1 from public.subscriptions s
    where s.company_id = p_company_id and s.provider = 'manual' and s.trial_ends_at is null
  );
$$;


-- -----------------------------------------------------------------------------
-- Baca: dashboard, daftar, detail
-- -----------------------------------------------------------------------------

create or replace function public.require_platform_admin()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Halaman ini khusus tim Semai.' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.admin_dashboard_metrics()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_start  timestamptz := now() - interval '30 days';
  v_result jsonb;
begin
  perform public.require_platform_admin();

  with co as (
    -- Usaha terdaftar = sudah selesai onboarding dan tidak diarsip.
    select c.id, c.created_at, public.current_subscription(c.id) as sub
    from public.companies c
    where c.onboarding_completed_at is not null and c.archived_at is null
  ),
  flags as (
    select
      co.*,
      public.is_paying_subscription(co.sub) as paying,
      public.subscription_mrr(co.sub) as mrr,
      (co.sub).status = 'trialing' and (co.sub).trial_ends_at > now() as trialing,
      public.company_paid_at(co.id, v_start) as paid_start,
      public.company_paid_at(co.id, now()) as paid_now,
      public.company_ever_paid(co.id) as ever_paid,
      exists (
        select 1 from public.subscriptions s
        where s.company_id = co.id and s.trial_ends_at is not null and s.trial_ends_at <= now()
      ) as trial_done,
      case
        when (co.sub).id is null then 'benih'
        when (co.sub).status = 'trialing' and (co.sub).trial_ends_at <= now() then 'benih'
        else (co.sub).plan_code
      end as plan_code
    from co
  ),
  per_plan as (
    -- Per paket yang berlaku sekarang. Trial dihitung terpisah.
    select coalesce(jsonb_agg(x order by x.sort_order), '[]'::jsonb) as rows
    from (
      select p.code as plan_code, p.name, p.tier, p.sort_order,
        count(f.id) filter (where not coalesce(f.trialing, false))::integer as companies,
        count(f.id) filter (where f.trialing)::integer as trialing
      from public.plans p
      left join flags f on f.plan_code = p.code
      where p.is_active or f.id is not null
      group by p.code, p.name, p.tier, p.sort_order
    ) x
  )
  select jsonb_build_object(
    'registered',          count(*),
    'new_30d',             count(*) filter (where f.created_at >= v_start),
    'active_7d',           (
                             select count(distinct a.company_id) from public.attendances a
                             where a.clock_in_at >= now() - interval '7 days'
                               and a.company_id in (select co.id from co)
                           ),
    'paying',              count(*) filter (where f.paying),
    'trialing',            count(*) filter (where f.trialing),
    'mrr',                 coalesce(sum(f.mrr) filter (where f.paying), 0),
    'mrr_custom_unpriced', count(*) filter (where f.paying and f.mrr is null),
    'churn_base',          count(*) filter (where f.paid_start),
    'churned',             count(*) filter (where f.paid_start and not f.paid_now),
    'ever_paid',           count(*) filter (where f.ever_paid),
    'trial_done',          count(*) filter (where f.trial_done),
    'trial_paid',          count(*) filter (where f.trial_done and f.ever_paid),
    'per_plan',            (select rows from per_plan)
  )
  into v_result
  from flags f;

  return v_result;
end;
$$;

-- p_plan: kode paket, 'trial', atau null. p_activity: '7_hari' | '30_hari' |
-- 'tidak_aktif_30' | 'belum_pernah' | null.
create or replace function public.admin_list_companies(
  p_search         text default null,
  p_business_type  text default null,
  p_city           text default null,
  p_plan           text default null,
  p_activity       text default null,
  p_limit          integer default 50,
  p_offset         integer default 0
)
returns table (
  id                uuid,
  name              text,
  business_type     text,
  city              text,
  plan_code         text,
  plan_name         text,
  subscription_status text,
  employees_active  integer,
  created_at        timestamptz,
  last_active_at    timestamptz,
  suspended_at      timestamptz,
  onboarding_done   boolean,
  total_count       bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  perform public.require_platform_admin();

  return query
  with base as (
    select c.*, public.current_plan_code(c.id) as cur_code, public.current_subscription(c.id) as sub
    from public.companies c
    where c.archived_at is null
      and (p_search is null or c.name ilike '%' || p_search || '%')
      and (p_business_type is null or c.business_type = p_business_type)
      and (p_city is null or c.city ilike '%' || p_city || '%')
      and (
        p_activity is null
        or (p_activity = '7_hari' and c.last_active_at >= now() - interval '7 days')
        or (p_activity = '30_hari' and c.last_active_at >= now() - interval '30 days')
        or (p_activity = 'tidak_aktif_30' and c.last_active_at < now() - interval '30 days')
        or (p_activity = 'belum_pernah' and c.last_active_at is null)
      )
  )
  select
    b.id, b.name, b.business_type, b.city,
    b.cur_code, p.name,
    case when b.cur_code = 'benih' then null else (b.sub).status end,
    (select count(*)::integer from public.employees e where e.company_id = b.id and e.status = 'aktif'),
    b.created_at, b.last_active_at, b.suspended_at,
    b.onboarding_completed_at is not null,
    count(*) over ()
  from base b
  join public.plans p on p.code = b.cur_code
  where p_plan is null
     or (p_plan = 'trial' and b.cur_code <> 'benih' and (b.sub).status = 'trialing')
     or (p_plan <> 'trial' and b.cur_code = p_plan)
  order by b.created_at desc, b.id
  limit least(greatest(coalesce(p_limit, 50), 1), 200)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

-- Kota yang ada, untuk pilihan filter.
create or replace function public.admin_company_cities()
returns setof text
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_platform_admin();
  return query
  select distinct initcap(trim(c.city)) from public.companies c
  where c.city is not null and length(trim(c.city)) > 0 and c.archived_at is null
  order by 1;
end;
$$;

-- Detail usaha tanpa data pribadi karyawan: hanya angka pemakaian.
create or replace function public.admin_company_detail(p_company_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_company public.companies;
  v_owner   jsonb;
  v_usage   jsonb;
  v_sub     public.subscriptions;
  v_code    text;
begin
  perform public.require_platform_admin();

  select * into v_company from public.companies c where c.id = p_company_id;
  if v_company.id is null then
    return null;
  end if;

  select jsonb_build_object('name', p.full_name, 'email', u.email, 'phone', coalesce(p.phone, v_company.phone))
  into v_owner
  from public.company_members m
  join public.profiles p on p.id = m.user_id
  left join auth.users u on u.id = m.user_id
  where m.company_id = p_company_id and m.role = 'owner'
  order by m.created_at
  limit 1;

  select jsonb_build_object(
    'employees_active',   count(*) filter (where e.status = 'aktif'),
    'employees_invited',  count(*) filter (where e.status = 'diundang'),
    'employees_inactive', count(*) filter (where e.status = 'nonaktif'),
    'employees_hidden',   count(*) filter (where e.hidden_by_plan_at is not null),
    'locations',          (select count(*) from public.locations l where l.company_id = p_company_id and l.is_active),
    'admins',             (select count(*) from public.company_members m where m.company_id = p_company_id and m.role = 'admin'),
    'attendances_7d',     (select count(*) from public.attendances a where a.company_id = p_company_id and a.clock_in_at >= now() - interval '7 days'),
    'attendances_30d',    (select count(*) from public.attendances a where a.company_id = p_company_id and a.clock_in_at >= now() - interval '30 days'),
    'attendances_total',  (select count(*) from public.attendances a where a.company_id = p_company_id and a.clock_in_at is not null),
    'last_attendance_at', (select max(a.clock_in_at) from public.attendances a where a.company_id = p_company_id),
    'payroll_runs',       (select count(*) from public.payroll_runs r where r.company_id = p_company_id),
    'payroll_locked',     (select count(*) from public.payroll_runs r where r.company_id = p_company_id and r.status = 'dikunci'),
    'last_payroll_period',(select max(r.period_end) from public.payroll_runs r where r.company_id = p_company_id)
  )
  into v_usage
  from public.employees e
  where e.company_id = p_company_id;

  v_code := public.current_plan_code(p_company_id);
  v_sub := public.current_subscription(p_company_id);

  return jsonb_build_object(
    'company', jsonb_build_object(
      'id', v_company.id,
      'name', v_company.name,
      'business_type', v_company.business_type,
      'city', v_company.city,
      'timezone', v_company.timezone,
      'employee_range', v_company.employee_range,
      'created_at', v_company.created_at,
      'onboarding_completed_at', v_company.onboarding_completed_at,
      'last_active_at', v_company.last_active_at,
      'suspended_at', v_company.suspended_at,
      'suspend_reason', v_company.suspend_reason,
      'discount_percent', v_company.discount_percent,
      'discount_until', v_company.discount_until,
      'discount_reason', v_company.discount_reason,
      'discount_active', public.company_discount_percent(p_company_id) > 0
    ),
    'owner', v_owner,
    'plan', jsonb_build_object(
      'plan_code', v_code,
      'plan_name', (select p.name from public.plans p where p.code = v_code),
      'billing_state', public.company_billing_state(p_company_id),
      'subscription', case when v_sub.id is null then null else jsonb_build_object(
        'id', v_sub.id,
        'plan_code', v_sub.plan_code,
        'status', v_sub.status,
        'billing_cycle', v_sub.billing_cycle,
        'trial_ends_at', v_sub.trial_ends_at,
        'current_period_start', v_sub.current_period_start,
        'current_period_end', v_sub.current_period_end,
        'price_override', v_sub.price_override,
        'provider', v_sub.provider,
        'mrr', case when public.is_paying_subscription(v_sub) then public.subscription_mrr(v_sub) end
      ) end,
      'trial_used', exists (select 1 from public.subscriptions s where s.company_id = p_company_id)
    ),
    'usage', v_usage
  );
end;
$$;

-- Riwayat langganan, tagihan, dan aksi tim Semai untuk satu usaha.
create or replace function public.admin_company_audit(p_company_id uuid, p_limit integer default 50)
returns table (
  id          bigint,
  action      text,
  actor_role  text,
  reason      text,
  before      jsonb,
  after       jsonb,
  created_at  timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_platform_admin();
  return query
  select l.id, l.action, l.actor_role, l.reason, l.before, l.after, l.created_at
  from public.audit_logs l
  where l.company_id = p_company_id
    and (l.action like 'admin.%' or l.action like 'subscription.%' or l.action like 'invoice.%')
  order by l.created_at desc, l.id desc
  limit least(greatest(coalesce(p_limit, 50), 1), 200);
end;
$$;


-- -----------------------------------------------------------------------------
-- Aksi super admin. Alasan wajib; semua tercatat di audit_logs.
-- -----------------------------------------------------------------------------

create or replace function public.admin_require_reason(p_reason text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_reason is null or length(trim(p_reason)) < 5 then
    raise exception 'Tulis alasan minimal 5 huruf. Alasan disimpan di catatan audit.'
      using errcode = 'P0001', hint = 'alasan_wajib';
  end if;
  return trim(p_reason);
end;
$$;

-- Ubah paket manual (tanpa invoice). Benih = hentikan langganan berjalan.
-- p_price = harga per periode (wajib untuk paket harga custom, opsional
-- untuk menimpa harga normal).
create or replace function public.admin_set_plan(
  p_company_id  uuid,
  p_plan_code   text,
  p_cycle       text,
  p_period_end  timestamptz,
  p_price       bigint,
  p_reason      text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason text;
  v_plan   public.plans;
  v_old    public.subscriptions;
  v_new_id uuid;
begin
  perform public.require_platform_admin();
  v_reason := public.admin_require_reason(p_reason);

  perform 1 from public.companies c where c.id = p_company_id for update;
  if not found then
    raise exception 'Usaha tidak ditemukan.' using errcode = 'P0001';
  end if;

  select * into v_plan from public.plans p where p.code = p_plan_code;
  if v_plan.code is null or (not v_plan.is_active and v_plan.level <> 'benih') then
    raise exception 'Paket tidak dikenal atau sudah tidak dijual.' using errcode = 'P0001', hint = 'paket_tidak_ada';
  end if;

  v_old := public.current_subscription(p_company_id);

  perform set_config('semai.system_write', 'on', true);

  if v_plan.level = 'benih' then
    if v_old.id is null then
      raise exception 'Usaha ini sudah memakai paket Benih.' using errcode = 'P0001', hint = 'sudah_benih';
    end if;
    update public.subscriptions s
    set status = 'canceled', ended_at = now(), cancel_at_period_end = false
    where s.company_id = p_company_id and s.status in ('trialing', 'active', 'past_due');
  else
    if p_cycle is null or p_cycle not in ('bulanan', 'tahunan') then
      raise exception 'Pilih siklus bulanan atau tahunan.' using errcode = 'P0001', hint = 'siklus_tidak_valid';
    end if;
    if p_period_end is null or p_period_end <= now() then
      raise exception 'Akhir periode harus setelah hari ini.' using errcode = 'P0001', hint = 'periode_tidak_valid';
    end if;
    if p_period_end > now() + interval '2 years' then
      raise exception 'Akhir periode paling lama 2 tahun dari sekarang.' using errcode = 'P0001', hint = 'periode_tidak_valid';
    end if;
    if p_price is not null and p_price < 0 then
      raise exception 'Harga tidak boleh minus.' using errcode = 'P0001', hint = 'harga_tidak_valid';
    end if;
    if p_price is null and public.plan_cycle_price(p_plan_code, p_cycle) is null then
      raise exception 'Paket % memakai harga custom. Isi harga per periode.', v_plan.name
        using errcode = 'P0001', hint = 'harga_wajib';
    end if;

    update public.subscriptions s
    set status = 'canceled', ended_at = now(), cancel_at_period_end = false
    where s.company_id = p_company_id and s.status in ('trialing', 'active', 'past_due');

    insert into public.subscriptions (
      company_id, plan_code, status, billing_cycle, current_period_start, current_period_end,
      price_override, provider
    )
    values (p_company_id, p_plan_code, 'active', p_cycle, now(), p_period_end, p_price, 'manual')
    returning id into v_new_id;
  end if;

  perform set_config('semai.system_write', 'off', true);

  perform public.log_audit(
    p_company_id, 'platform_admin', 'admin.set_plan', 'subscriptions', coalesce(v_new_id, v_old.id), v_reason,
    case when v_old.id is null then jsonb_build_object('plan_code', 'benih')
         else jsonb_build_object('plan_code', v_old.plan_code, 'status', v_old.status,
                                 'billing_cycle', v_old.billing_cycle,
                                 'current_period_end', v_old.current_period_end,
                                 'price_override', v_old.price_override) end,
    case when v_plan.level = 'benih' then jsonb_build_object('plan_code', 'benih')
         else jsonb_build_object('plan_code', p_plan_code, 'status', 'active', 'billing_cycle', p_cycle,
                                 'current_period_end', p_period_end, 'price_override', p_price,
                                 'provider', 'manual') end
  );

  perform public.apply_employee_limit(p_company_id);
end;
$$;

-- Tambah 1–30 hari trial. Trial berjalan diperpanjang, trial yang sudah habis
-- dibuka lagi, usaha yang belum pernah trial diberi trial baru.
create or replace function public.admin_extend_trial(p_company_id uuid, p_days integer, p_reason text)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason  text;
  v_sub     public.subscriptions;
  v_last    public.subscriptions;
  v_ends_at timestamptz;
  v_plan    text;
  v_id      uuid;
begin
  perform public.require_platform_admin();
  v_reason := public.admin_require_reason(p_reason);

  if p_days is null or p_days < 1 or p_days > 30 then
    raise exception 'Perpanjangan trial 1 sampai 30 hari.' using errcode = 'P0001', hint = 'hari_tidak_valid';
  end if;

  perform 1 from public.companies c where c.id = p_company_id for update;
  if not found then
    raise exception 'Usaha tidak ditemukan.' using errcode = 'P0001';
  end if;

  perform set_config('semai.system_write', 'on', true);

  select * into v_sub from public.subscriptions s
  where s.company_id = p_company_id and s.status in ('trialing', 'active', 'past_due')
  order by s.created_at desc limit 1;

  if v_sub.id is not null and v_sub.status <> 'trialing' then
    raise exception 'Usaha ini sedang di paket berbayar, jadi trial tidak bisa diperpanjang. Pakai ubah paket untuk menambah masa aktif.'
      using errcode = 'P0001', hint = 'sedang_berbayar';
  end if;

  if v_sub.id is not null then
    v_ends_at := greatest(v_sub.trial_ends_at, now()) + make_interval(days => p_days);
    update public.subscriptions s
    set trial_ends_at = v_ends_at, current_period_end = v_ends_at
    where s.id = v_sub.id;
    v_id := v_sub.id;
  else
    select * into v_last from public.subscriptions s
    where s.company_id = p_company_id order by s.created_at desc limit 1;

    v_ends_at := now() + make_interval(days => p_days);

    if v_last.id is not null and v_last.trial_ends_at is not null and v_last.status = 'expired' then
      -- Trial terakhir sudah habis: buka lagi.
      update public.subscriptions s
      set status = 'trialing', trial_ends_at = v_ends_at, current_period_end = v_ends_at, ended_at = null
      where s.id = v_last.id;
      v_id := v_last.id;
      v_sub := v_last;
    else
      v_plan := public.plus_plan_for_company(p_company_id);
      if v_plan is null then
        raise exception 'Paket berbayar belum tersedia.' using errcode = 'P0001', hint = 'paket_tidak_ada';
      end if;
      insert into public.subscriptions (company_id, plan_code, status, trial_ends_at, current_period_start, current_period_end)
      values (p_company_id, v_plan, 'trialing', v_ends_at, now(), v_ends_at)
      returning id into v_id;
    end if;
  end if;

  perform set_config('semai.system_write', 'off', true);

  perform public.log_audit(
    p_company_id, 'platform_admin', 'admin.extend_trial', 'subscriptions', v_id, v_reason,
    case when v_sub.id is null then null
         else jsonb_build_object('status', v_sub.status, 'trial_ends_at', v_sub.trial_ends_at) end,
    jsonb_build_object('status', 'trialing', 'trial_ends_at', v_ends_at, 'days', p_days)
  );

  perform public.apply_employee_limit(p_company_id);
  return v_ends_at;
end;
$$;

-- Pasang diskon (1–100%, opsional sampai tanggal) atau hapus (p_percent null).
create or replace function public.admin_set_discount(
  p_company_id  uuid,
  p_percent     integer,
  p_until       timestamptz,
  p_reason      text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason text;
  v_old    public.companies;
begin
  perform public.require_platform_admin();
  v_reason := public.admin_require_reason(p_reason);

  if p_percent is not null and (p_percent < 1 or p_percent > 100) then
    raise exception 'Diskon 1 sampai 100 persen.' using errcode = 'P0001', hint = 'diskon_tidak_valid';
  end if;
  if p_percent is not null and p_until is not null and p_until <= now() then
    raise exception 'Batas diskon harus setelah hari ini.' using errcode = 'P0001', hint = 'diskon_tidak_valid';
  end if;

  select * into v_old from public.companies c where c.id = p_company_id for update;
  if v_old.id is null then
    raise exception 'Usaha tidak ditemukan.' using errcode = 'P0001';
  end if;

  perform set_config('semai.system_write', 'on', true);
  update public.companies c
  set discount_percent = p_percent,
      discount_until = case when p_percent is null then null else p_until end,
      discount_reason = case when p_percent is null then null else v_reason end
  where c.id = p_company_id;
  perform set_config('semai.system_write', 'off', true);

  perform public.log_audit(
    p_company_id, 'platform_admin', 'admin.set_discount', 'companies', p_company_id, v_reason,
    jsonb_build_object('discount_percent', v_old.discount_percent, 'discount_until', v_old.discount_until),
    jsonb_build_object('discount_percent', p_percent,
                       'discount_until', case when p_percent is null then null else p_until end)
  );
end;
$$;

create or replace function public.admin_set_suspended(p_company_id uuid, p_suspended boolean, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason text;
  v_old    public.companies;
begin
  perform public.require_platform_admin();
  v_reason := public.admin_require_reason(p_reason);

  select * into v_old from public.companies c where c.id = p_company_id for update;
  if v_old.id is null then
    raise exception 'Usaha tidak ditemukan.' using errcode = 'P0001';
  end if;
  if p_suspended and v_old.suspended_at is not null then
    raise exception 'Usaha ini sudah ditangguhkan.' using errcode = 'P0001', hint = 'sudah_ditangguhkan';
  end if;
  if not p_suspended and v_old.suspended_at is null then
    raise exception 'Usaha ini tidak sedang ditangguhkan.' using errcode = 'P0001', hint = 'tidak_ditangguhkan';
  end if;

  perform set_config('semai.system_write', 'on', true);
  update public.companies c
  set suspended_at = case when p_suspended then now() end,
      suspend_reason = case when p_suspended then v_reason end
  where c.id = p_company_id;
  perform set_config('semai.system_write', 'off', true);

  perform public.log_audit(
    p_company_id, 'platform_admin', case when p_suspended then 'admin.suspend' else 'admin.unsuspend' end,
    'companies', p_company_id, v_reason,
    jsonb_build_object('suspended_at', v_old.suspended_at),
    jsonb_build_object('suspended_at', case when p_suspended then now() end)
  );
end;
$$;


-- -----------------------------------------------------------------------------
-- Hak akses fungsi
-- -----------------------------------------------------------------------------

revoke execute on function
  public.touch_company_activity(uuid),
  public.attendance_touch_company(),
  public.is_company_suspended(uuid),
  public.company_discount_percent(uuid),
  public.invoice_paid_set_price(),
  public.subscription_mrr(public.subscriptions),
  public.is_paying_subscription(public.subscriptions),
  public.company_paid_at(uuid, timestamptz),
  public.company_ever_paid(uuid),
  public.require_platform_admin(),
  public.admin_require_reason(text),
  public.admin_dashboard_metrics(),
  public.admin_list_companies(text, text, text, text, text, integer, integer),
  public.admin_company_cities(),
  public.admin_company_detail(uuid),
  public.admin_company_audit(uuid, integer),
  public.admin_set_plan(uuid, text, text, timestamptz, bigint, text),
  public.admin_extend_trial(uuid, integer, text),
  public.admin_set_discount(uuid, integer, timestamptz, text),
  public.admin_set_suspended(uuid, boolean, text)
from public, anon, authenticated;

-- Fungsi admin_* mengecek is_platform_admin() sendiri.
grant execute on function
  public.admin_dashboard_metrics(),
  public.admin_list_companies(text, text, text, text, text, integer, integer),
  public.admin_company_cities(),
  public.admin_company_detail(uuid),
  public.admin_company_audit(uuid, integer),
  public.admin_set_plan(uuid, text, text, timestamptz, bigint, text),
  public.admin_extend_trial(uuid, integer, text),
  public.admin_set_discount(uuid, integer, timestamptz, text),
  public.admin_set_suspended(uuid, boolean, text)
to authenticated;
