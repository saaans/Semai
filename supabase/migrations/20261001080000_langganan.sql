-- =============================================================================
-- Semai · Paket, trial, dan batas langganan (PRD bagian 9 dan 10)
--
-- - Status tagihan dihitung dari waktu, bukan dari kolom status, supaya
--   tetap benar walau job harian telat:
--     normal    = trial, Benih, atau periode berbayar masih berjalan
--     tenggang  = periode berbayar lewat, belum dibayar, kurang dari 7 hari
--     baca_saja = lewat 7 hari: owner/admin hanya bisa melihat data
-- - Mode baca saja dijaga trigger guard_read_only() di tabel yang diubah
--   owner. Yang ditolak hanya penulisan oleh anggota usaha; absen karyawan
--   (RPC clock_in/clock_out oleh karyawan) dan service role tetap jalan.
-- - Trial Plus 14 hari sekali per usaha (start_trial_plus). Setelah habis,
--   company_level() otomatis jadi benih; sync_plan_state() merapikan status.
-- - Owner bisa turun ke Benih kapan saja (downgrade_to_benih), termasuk untuk
--   keluar dari mode baca saja.
-- - Karyawan di atas batas paket: 14 hari tenggang sejak usaha melewati batas
--   (companies.over_limit_since), lalu karyawan terbaru disembunyikan dari
--   owner (employees.hidden_by_plan_at). Tidak dihapus. Karyawan yang
--   disembunyikan tetap bisa absen, dan muncul lagi setelah upgrade atau
--   setelah ada karyawan lain yang dinonaktifkan.
-- - Aman dijalankan ulang.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Kolom
-- -----------------------------------------------------------------------------

alter table public.subscriptions
  add column if not exists ended_at timestamptz;

comment on column public.subscriptions.ended_at is
  'Kapan langganan berakhir (trial habis = trial_ends_at, turun paket = saat itu). Diisi saat status jadi expired/canceled.';

alter table public.companies
  add column if not exists over_limit_since timestamptz;

comment on column public.companies.over_limit_since is
  'Sejak kapan karyawan aktif + diundang melewati batas paket. Setelah 14 hari, kelebihannya disembunyikan.';

alter table public.employees
  add column if not exists hidden_by_plan_at timestamptz;

comment on column public.employees.hidden_by_plan_at is
  'Disembunyikan dari owner karena melewati batas paket. Tidak dihapus; muncul lagi saat batas cukup.';

create index if not exists employees_hidden_idx on public.employees (company_id)
  where hidden_by_plan_at is not null;


-- -----------------------------------------------------------------------------
-- Langganan berjalan dan status tagihan
-- -----------------------------------------------------------------------------

-- Langganan terbaru yang belum berakhir (trialing/active/past_due), atau null.
create or replace function public.current_subscription(p_company_id uuid)
returns public.subscriptions
language sql
stable
security definer
set search_path = ''
as $$
  select s.* from public.subscriptions s
  where s.company_id = p_company_id and s.status in ('trialing', 'active', 'past_due')
  order by s.created_at desc
  limit 1;
$$;

-- normal | tenggang | baca_saja. Trial tidak pernah masuk tenggang: saat habis
-- usaha turun ke Benih (gratis).
create or replace function public.company_billing_state(p_company_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when s.id is null or s.status = 'trialing' or s.current_period_end is null then 'normal'
    when now() < s.current_period_end then 'normal'
    when now() < s.current_period_end + interval '7 days' then 'tenggang'
    else 'baca_saja'
  end
  from (select (public.current_subscription(p_company_id)).*) s;
$$;


-- -----------------------------------------------------------------------------
-- Mode baca saja
-- -----------------------------------------------------------------------------

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
  if v_company_id is not null
     and public.is_company_member(v_company_id)
     and public.company_billing_state(v_company_id) = 'baca_saja' then
    raise exception 'Tagihan paket sudah lewat 7 hari, jadi data hanya bisa dilihat. Bayar tagihan atau turun ke Benih di menu Paket untuk mengubah data lagi.'
      using errcode = 'P0001', hint = 'baca_saja';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'companies', 'company_members', 'locations', 'work_schedules', 'employees', 'attendances',
    'payroll_rules', 'payroll_runs', 'payroll_adjustments', 'cash_advances'
  ] loop
    execute format('drop trigger if exists %I on public.%I', v_table || '_guard_read_only', v_table);
    execute format(
      'create trigger %I before insert or update or delete on public.%I
         for each row execute function public.guard_read_only()',
      v_table || '_guard_read_only', v_table
    );
  end loop;
end;
$$;


-- -----------------------------------------------------------------------------
-- Karyawan di atas batas paket
-- -----------------------------------------------------------------------------

-- Dipakai policy absen: owner tidak melihat absen karyawan yang disembunyikan.
create or replace function public.is_hidden_employee(p_employee_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.employees e where e.id = p_employee_id and e.hidden_by_plan_at is not null
  );
$$;

drop policy if exists "Anggota melihat karyawan, karyawan melihat dirinya" on public.employees;
create policy "Anggota melihat karyawan, karyawan melihat dirinya" on public.employees
  for select to authenticated
  using (
    (public.is_company_member(company_id) and hidden_by_plan_at is null)
    or user_id = (select auth.uid())
  );

drop policy if exists "Anggota melihat absen, karyawan melihat absennya" on public.attendances;
create policy "Anggota melihat absen, karyawan melihat absennya" on public.attendances
  for select to authenticated
  using (
    (public.is_company_member(company_id) and not public.is_hidden_employee(employee_id))
    or employee_id in (select public.my_employee_ids())
  );

-- Gajian, penyesuaian, dan kasbon baru tidak boleh untuk karyawan tersembunyi.
create or replace function public.reject_hidden_employee()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.is_hidden_employee(new.employee_id) then
    raise exception 'Karyawan ini disembunyikan karena melewati batas paket. Upgrade paket untuk mengelolanya lagi.'
      using errcode = 'P0001', hint = 'karyawan_tersembunyi';
  end if;
  return new;
end;
$$;

do $$
declare
  v_table text;
begin
  foreach v_table in array array['payslips', 'payroll_adjustments', 'cash_advances'] loop
    execute format('drop trigger if exists %I on public.%I', v_table || '_reject_hidden', v_table);
    execute format(
      'create trigger %I before insert on public.%I
         for each row execute function public.reject_hidden_employee()',
      v_table || '_reject_hidden', v_table
    );
  end loop;
end;
$$;

-- Terapkan batas karyawan: catat kapan mulai melewati batas, sembunyikan
-- kelebihan setelah 14 hari, munculkan lagi kalau batas cukup. Yang tetap
-- terlihat: karyawan aktif + diundang yang paling dulu ditambahkan.
create or replace function public.apply_employee_limit(p_company_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit  integer := public.employee_limit(p_company_id);
  v_count  integer;
  v_since  timestamptz;
begin
  perform set_config('semai.system_write', 'on', true);

  -- Karyawan nonaktif tidak dihitung dan tidak disembunyikan.
  update public.employees e set hidden_by_plan_at = null
  where e.company_id = p_company_id and e.status = 'nonaktif' and e.hidden_by_plan_at is not null;

  select count(*) into v_count from public.employees e
  where e.company_id = p_company_id and e.status in ('aktif', 'diundang');

  if v_limit is null or v_count <= v_limit then
    update public.companies c set over_limit_since = null
    where c.id = p_company_id and c.over_limit_since is not null;
    update public.employees e set hidden_by_plan_at = null
    where e.company_id = p_company_id and e.hidden_by_plan_at is not null;
    perform set_config('semai.system_write', 'off', true);
    return;
  end if;

  update public.companies c set over_limit_since = coalesce(c.over_limit_since, now())
  where c.id = p_company_id
  returning c.over_limit_since into v_since;

  if now() >= v_since + interval '14 days' then
    with ranked as (
      select e.id, row_number() over (order by e.created_at, e.id) as rn
      from public.employees e
      where e.company_id = p_company_id and e.status in ('aktif', 'diundang')
    )
    update public.employees e
    set hidden_by_plan_at = case when r.rn > v_limit then coalesce(e.hidden_by_plan_at, now()) end
    from ranked r
    where e.id = r.id
      and (e.hidden_by_plan_at is null) = (r.rn > v_limit);
  end if;

  perform set_config('semai.system_write', 'off', true);
end;
$$;


-- -----------------------------------------------------------------------------
-- Sinkron status paket
-- -----------------------------------------------------------------------------

-- Rapikan status langganan sesuai waktu lalu terapkan batas karyawan.
-- Idempoten. Dipanggil saat owner membuka dashboard dan oleh job harian.
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

  perform public.apply_employee_limit(p_company_id);
end;
$$;

-- Job harian: semua usaha yang punya langganan atau sedang melewati batas.
create or replace function public.sync_all_plan_states()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company_id uuid;
begin
  for v_company_id in
    select c.id from public.companies c
    where c.over_limit_since is not null
       or exists (select 1 from public.subscriptions s where s.company_id = c.id and s.status in ('trialing', 'active'))
       or exists (select 1 from public.employees e where e.company_id = c.id and e.hidden_by_plan_at is not null)
  loop
    perform public.sync_plan_state(v_company_id);
  end loop;
end;
$$;

-- pg_cron opsional: kalau ekstensi tidak tersedia, status tetap dirapikan
-- saat owner membuka dashboard.
do $$
begin
  create extension if not exists pg_cron;
  perform cron.unschedule(j.jobid) from cron.job j where j.jobname = 'semai_sync_plan_states';
  perform cron.schedule('semai_sync_plan_states', '5 17 * * *', 'select public.sync_all_plan_states()');
exception when others then
  raise notice 'pg_cron tidak tersedia, job harian dilewati: %', sqlerrm;
end;
$$;


-- -----------------------------------------------------------------------------
-- Aksi owner
-- -----------------------------------------------------------------------------

-- Paket Plus terkecil yang muat untuk jumlah karyawan (aktif + diundang).
create or replace function public.plus_plan_for_company(p_company_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.code from public.plans p
  where p.level = 'plus' and p.is_active
    and (p.max_employees is null or p.max_employees >= (
      select count(*) from public.employees e
      where e.company_id = p_company_id and e.status in ('aktif', 'diundang')
    ))
  order by p.sort_order
  limit 1;
$$;

-- Trial Plus 14 hari, sekali per usaha. Hanya owner.
create or replace function public.start_trial_plus(p_company_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan_code text;
  v_ends_at   timestamptz := now() + interval '14 days';
begin
  if not public.is_company_owner(p_company_id) then
    raise exception 'Hanya owner yang bisa memulai trial.' using errcode = '42501';
  end if;

  -- Satu per satu per usaha supaya klik ganda tidak membuat dua trial.
  perform 1 from public.companies c where c.id = p_company_id for update;

  if exists (select 1 from public.subscriptions s where s.company_id = p_company_id) then
    raise exception 'Trial Plus hanya bisa dipakai sekali per usaha. Pilih paket di menu Paket.'
      using errcode = 'P0001', hint = 'trial_terpakai';
  end if;

  v_plan_code := public.plus_plan_for_company(p_company_id);
  if v_plan_code is null then
    raise exception 'Paket Plus belum tersedia. Hubungi tim Semai.' using errcode = 'P0001', hint = 'paket_tidak_ada';
  end if;

  insert into public.subscriptions (company_id, plan_code, status, trial_ends_at, current_period_start, current_period_end)
  values (p_company_id, v_plan_code, 'trialing', v_ends_at, now(), v_ends_at);

  perform public.log_audit(
    p_company_id, 'owner', 'subscription.trial_start', 'subscriptions', null, null, null,
    jsonb_build_object('plan_code', v_plan_code, 'trial_ends_at', v_ends_at)
  );

  perform public.apply_employee_limit(p_company_id);
  return v_ends_at;
end;
$$;

-- Hentikan langganan berjalan dan pakai Benih. Hanya owner. Data di atas
-- batas Benih disembunyikan setelah 14 hari, tidak dihapus.
create or replace function public.downgrade_to_benih(p_company_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sub public.subscriptions;
begin
  if not public.is_company_owner(p_company_id) then
    raise exception 'Hanya owner yang bisa mengubah paket.' using errcode = '42501';
  end if;

  select * into v_sub from public.subscriptions s
  where s.company_id = p_company_id and s.status in ('trialing', 'active', 'past_due')
  order by s.created_at desc
  limit 1
  for update;

  if v_sub.id is null then
    raise exception 'Usahamu sudah memakai paket Benih.' using errcode = 'P0001', hint = 'sudah_benih';
  end if;

  update public.subscriptions s
  set status = 'canceled', ended_at = now(), cancel_at_period_end = false
  where s.company_id = p_company_id and s.status in ('trialing', 'active', 'past_due');

  perform public.log_audit(
    p_company_id, 'owner', 'subscription.downgrade_benih', 'subscriptions', v_sub.id, null,
    jsonb_build_object('plan_code', v_sub.plan_code, 'status', v_sub.status),
    jsonb_build_object('plan_code', 'benih', 'status', 'canceled')
  );

  perform public.apply_employee_limit(p_company_id);
end;
$$;


-- -----------------------------------------------------------------------------
-- Ringkasan paket untuk owner/admin
-- -----------------------------------------------------------------------------

create or replace function public.get_billing_overview(p_company_id uuid)
returns table (
  plan_code          text,
  plan_name          text,
  level              text,
  subscription_status text,
  billing_cycle      text,
  billing_state      text,
  trial_ends_at      timestamptz,
  current_period_end timestamptz,
  trial_used         boolean,
  employees_used     integer,
  employee_limit     integer,
  hidden_count       integer,
  over_limit_since   timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_sub  public.subscriptions;
  v_code text := public.current_plan_code(p_company_id);
begin
  if not public.is_company_member(p_company_id) then
    raise exception 'Kamu tidak punya akses ke usaha ini.' using errcode = '42501';
  end if;

  v_sub := public.current_subscription(p_company_id);

  return query
  select
    p.code,
    p.name,
    p.level,
    case when v_code = 'benih' then null else v_sub.status end,
    case when v_code = 'benih' then null else v_sub.billing_cycle end,
    public.company_billing_state(p_company_id),
    case when v_code = 'benih' then null else v_sub.trial_ends_at end,
    case when v_code = 'benih' then null else v_sub.current_period_end end,
    exists (select 1 from public.subscriptions s where s.company_id = p_company_id),
    (select count(*)::integer from public.employees e
      where e.company_id = p_company_id and e.status in ('aktif', 'diundang')),
    p.max_employees,
    (select count(*)::integer from public.employees e
      where e.company_id = p_company_id and e.hidden_by_plan_at is not null),
    (select c.over_limit_since from public.companies c where c.id = p_company_id)
  from public.plans p
  where p.code = v_code;
end;
$$;


-- -----------------------------------------------------------------------------
-- Absen remote: pakai ended_at kalau ada (status expired/canceled diubah
-- belakangan oleh sync, jadi updated_at tidak lagi menandai akhir langganan).
-- -----------------------------------------------------------------------------

create or replace function public.remote_attendance_status(p_company_id uuid)
returns table (allowed boolean, grace_until timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_ended timestamptz;
begin
  if auth.uid() is not null
     and not public.is_company_member(p_company_id)
     and not public.is_company_employee(p_company_id) then
    return query select false, null::timestamptz;
    return;
  end if;

  if public.has_feature(p_company_id, 'absen_remote') then
    return query select true, null::timestamptz;
    return;
  end if;

  select max(coalesce(s.ended_at, case when s.status = 'trialing' then s.trial_ends_at else s.updated_at end))
    into v_ended
  from public.subscriptions s
  where s.company_id = p_company_id
    and (
      s.status in ('canceled', 'expired')
      or (s.status = 'trialing' and s.trial_ends_at <= now())
    );

  if v_ended is not null and now() < v_ended + interval '14 days' then
    return query select true, v_ended + interval '14 days';
  else
    return query select false, null::timestamptz;
  end if;
end;
$$;


-- -----------------------------------------------------------------------------
-- Hak akses fungsi
-- -----------------------------------------------------------------------------

revoke execute on function
  public.current_subscription(uuid),
  public.company_billing_state(uuid),
  public.guard_read_only(),
  public.is_hidden_employee(uuid),
  public.reject_hidden_employee(),
  public.apply_employee_limit(uuid),
  public.sync_plan_state(uuid),
  public.sync_all_plan_states(),
  public.plus_plan_for_company(uuid),
  public.start_trial_plus(uuid),
  public.downgrade_to_benih(uuid),
  public.get_billing_overview(uuid)
from public, anon, authenticated;

-- is_hidden_employee dipakai policy absen, jadi perlu bisa dieksekusi.
grant execute on function
  public.is_hidden_employee(uuid),
  public.sync_plan_state(uuid),
  public.start_trial_plus(uuid),
  public.downgrade_to_benih(uuid),
  public.get_billing_overview(uuid)
to authenticated;
