-- =============================================================================
-- Semai · Skema inti MVP
--
-- Prinsip:
-- - Setiap tabel data usaha punya company_id dan RLS aktif.
-- - Uang = bigint rupiah. Waktu = timestamptz. Tanggal kerja = date (zona usaha).
-- - Tabel sensitif (absen, gajian, audit) hanya bisa DIBACA client.
--   Penulisan lewat RPC security definer di langkah fiturnya masing-masing,
--   supaya aturan radius, waktu server, audit, dan kunci gajian tidak bisa dilewati.
-- - Super admin tidak punya akses RLS ke data pribadi karyawan (foto, lokasi,
--   gaji). Akses lewat support_access_grants dibuat sebagai RPC yang tercatat.
-- - Foreign key antar tabel data usaha memakai (id, company_id) supaya baris
--   dari usaha lain tidak bisa direferensikan.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Utilitas
-- -----------------------------------------------------------------------------

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;


-- -----------------------------------------------------------------------------
-- Paket
-- -----------------------------------------------------------------------------

create table public.plans (
  code           text primary key,
  tier           text not null check (tier in ('benih', 'tunas', 'tumbuh', 'berkembang', 'rindang', 'hutan')),
  level          text not null check (level in ('benih', 'dasar', 'plus')),
  name           text not null,
  min_employees  integer not null check (min_employees >= 1),
  max_employees  integer check (max_employees >= min_employees),          -- null = tanpa batas
  price_monthly  bigint check (price_monthly >= 0),                         -- null = harga custom
  price_yearly   bigint check (price_yearly >= 0),                          -- null = harga custom
  sort_order     integer not null,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  unique (tier, level)
);

comment on table public.plans is 'Paket langganan: tier (rentang karyawan) x level (fitur).';

-- Fitur dan batas ditentukan oleh level, bukan tier.
create table public.plan_features (
  level        text not null check (level in ('benih', 'dasar', 'plus')),
  feature_key  text not null check (feature_key ~ '^[a-z0-9_]+$'),
  enabled      boolean not null default false,
  limit_value  integer check (limit_value >= 0),                            -- null = tanpa batas
  primary key (level, feature_key)
);

comment on table public.plan_features is 'Fitur (enabled) dan batas angka (limit_value) per level paket.';


-- -----------------------------------------------------------------------------
-- Profil pengguna
-- -----------------------------------------------------------------------------

create table public.profiles (
  id                 uuid primary key references auth.users (id) on delete cascade,
  full_name          text,
  phone              text,
  is_platform_admin  boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

comment on table public.profiles is 'Satu baris per akun Auth (owner, admin, karyawan, tim Semai).';
comment on column public.profiles.is_platform_admin is 'Super admin tim Semai. Hanya bisa diubah lewat SQL/service role.';

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Buat profil otomatis saat akun baru terdaftar.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')), ''),
    nullif(trim(new.raw_user_meta_data ->> 'phone'), '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();


-- -----------------------------------------------------------------------------
-- Usaha dan anggota
-- -----------------------------------------------------------------------------

create table public.companies (
  id                       uuid primary key default gen_random_uuid(),
  name                     text,                                            -- diisi saat onboarding
  business_type            text check (business_type in ('kuliner', 'retail', 'salon', 'klinik', 'bengkel', 'laundry', 'jasa_lain')),
  city                     text,
  timezone                 text not null default 'Asia/Jakarta'
                           check (timezone in ('Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura')),
  employee_range           text check (employee_range in ('1-5', '6-15', '16-30', '31-50', '51+')),
  branch_count             integer not null default 1 check (branch_count >= 1),
  onboarding               jsonb not null default '{}'::jsonb,
  onboarding_completed_at  timestamptz,
  suspended_at             timestamptz,
  archived_at              timestamptz,
  last_active_at           timestamptz,
  created_by               uuid references auth.users (id) on delete set null,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

comment on column public.companies.timezone is 'WIB = Asia/Jakarta, WITA = Asia/Makassar, WIT = Asia/Jayapura.';
comment on column public.companies.onboarding is 'Jawaban onboarding mentah, untuk analitik dan default per bidang.';

create trigger companies_updated_at before update on public.companies
  for each row execute function public.set_updated_at();

create table public.company_members (
  company_id  uuid not null references public.companies (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  role        text not null check (role in ('owner', 'admin')),
  created_at  timestamptz not null default now(),
  primary key (company_id, user_id)
);

create index company_members_user_id_idx on public.company_members (user_id);


-- -----------------------------------------------------------------------------
-- Lokasi dan jam kerja
-- -----------------------------------------------------------------------------

create table public.locations (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id) on delete cascade,
  name        text not null check (length(trim(name)) > 0),
  address     text,
  latitude    double precision not null check (latitude between -90 and 90),
  longitude   double precision not null check (longitude between -180 and 180),
  radius_m    integer not null default 100 check (radius_m between 10 and 1000),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (id, company_id)
);

create index locations_company_id_idx on public.locations (company_id);

create trigger locations_updated_at before update on public.locations
  for each row execute function public.set_updated_at();

create table public.work_schedules (
  id                         uuid primary key default gen_random_uuid(),
  company_id                 uuid not null references public.companies (id) on delete cascade,
  name                       text not null check (length(trim(name)) > 0),
  start_time                 time not null,
  end_time                   time not null,                              -- < start_time = lewat tengah malam
  work_days                  smallint[] not null default '{1,2,3,4,5,6}'
                             check (work_days <@ '{1,2,3,4,5,6,7}'::smallint[] and cardinality(work_days) > 0),
  late_tolerance_min         integer not null default 0 check (late_tolerance_min between 0 and 240),
  early_leave_tolerance_min  integer not null default 0 check (early_leave_tolerance_min between 0 and 240),
  is_default                 boolean not null default false,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now(),
  unique (id, company_id)
);

comment on column public.work_schedules.work_days is '1 = Senin ... 7 = Minggu (ISO).';

create index work_schedules_company_id_idx on public.work_schedules (company_id);
create unique index work_schedules_one_default_idx on public.work_schedules (company_id) where is_default;

create trigger work_schedules_updated_at before update on public.work_schedules
  for each row execute function public.set_updated_at();


-- -----------------------------------------------------------------------------
-- Karyawan
-- -----------------------------------------------------------------------------

-- Satu baris per (usaha, orang). Satu akun Auth (nomor HP) bisa terhubung
-- ke beberapa usaha lewat beberapa baris dengan user_id yang sama.
create table public.employees (
  id                 uuid primary key default gen_random_uuid(),
  company_id         uuid not null references public.companies (id) on delete cascade,
  user_id            uuid references auth.users (id) on delete set null,  -- diisi setelah aktivasi
  full_name          text not null check (length(trim(full_name)) > 0),
  phone              text not null check (phone ~ '^62[0-9]{8,13}$'),      -- format 62xxxxxxxxxx
  position           text,
  status             text not null default 'diundang' check (status in ('diundang', 'aktif', 'nonaktif')),
  base_salary        bigint not null default 0 check (base_salary >= 0), -- gaji pokok per bulan
  location_id        uuid,
  work_schedule_id   uuid,
  joined_on          date,
  activated_at       timestamptz,
  deactivated_at     timestamptz,
  invite_token_hash  text unique,
  invite_expires_at  timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (id, company_id),
  unique (company_id, phone),
  unique (company_id, user_id),
  foreign key (location_id, company_id)
    references public.locations (id, company_id) on delete set null (location_id),
  foreign key (work_schedule_id, company_id)
    references public.work_schedules (id, company_id) on delete set null (work_schedule_id)
);

comment on column public.employees.invite_token_hash is 'Hash SHA-256 token undangan. Token asli hanya ada di link.';

create index employees_user_id_idx on public.employees (user_id);
create index employees_company_status_idx on public.employees (company_id, status);

create trigger employees_updated_at before update on public.employees
  for each row execute function public.set_updated_at();


-- -----------------------------------------------------------------------------
-- Absensi
-- -----------------------------------------------------------------------------

create table public.attendances (
  id                       uuid primary key default gen_random_uuid(),
  company_id               uuid not null references public.companies (id) on delete cascade,
  employee_id              uuid not null,
  location_id              uuid,
  work_date                date not null,                                -- tanggal kerja di zona usaha
  status                   text not null default 'hadir'
                           check (status in ('hadir', 'izin', 'sakit', 'alpa', 'libur')),
  scheduled_start          timestamptz,
  scheduled_end            timestamptz,

  clock_in_at              timestamptz,                                  -- dari now() server
  clock_in_lat             double precision check (clock_in_lat between -90 and 90),
  clock_in_lng             double precision check (clock_in_lng between -180 and 180),
  clock_in_accuracy_m      integer check (clock_in_accuracy_m >= 0),
  clock_in_distance_m      integer check (clock_in_distance_m >= 0),
  clock_in_photo_path      text,

  clock_out_at             timestamptz,
  clock_out_lat            double precision check (clock_out_lat between -90 and 90),
  clock_out_lng            double precision check (clock_out_lng between -180 and 180),
  clock_out_accuracy_m     integer check (clock_out_accuracy_m >= 0),
  clock_out_distance_m     integer check (clock_out_distance_m >= 0),
  clock_out_photo_path     text,

  mock_location_suspected  boolean not null default false,
  device_captured_at       timestamptz,                                  -- jam HP, hanya info (absen offline)

  late_minutes             integer not null default 0 check (late_minutes >= 0),
  early_leave_minutes      integer not null default 0 check (early_leave_minutes >= 0),
  overtime_minutes         integer not null default 0 check (overtime_minutes >= 0),

  corrected_at             timestamptz,
  corrected_by             uuid references auth.users (id) on delete set null,
  correction_reason        text,
  photos_deleted_at        timestamptz,

  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),

  unique (employee_id, work_date),
  check (clock_out_at is null or clock_in_at is null or clock_out_at >= clock_in_at),
  check (corrected_at is null or length(trim(correction_reason)) > 0),
  foreign key (employee_id, company_id)
    references public.employees (id, company_id) on delete restrict,
  foreign key (location_id, company_id)
    references public.locations (id, company_id) on delete set null (location_id)
);

comment on column public.attendances.device_captured_at is 'Jam di HP saat absen offline. Hanya info; waktu resmi = clock_in_at/clock_out_at dari server.';
comment on column public.attendances.correction_reason is 'Wajib saat koreksi. Nilai sebelum/sesudah di audit_logs.';

create index attendances_company_date_idx on public.attendances (company_id, work_date);

create trigger attendances_updated_at before update on public.attendances
  for each row execute function public.set_updated_at();


-- -----------------------------------------------------------------------------
-- Penggajian
-- -----------------------------------------------------------------------------

create table public.payroll_rules (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references public.companies (id) on delete cascade,
  employee_id    uuid,                                                    -- null = semua karyawan
  kind           text not null check (kind in ('tunjangan', 'potongan', 'lembur')),
  name           text not null check (length(trim(name)) > 0),
  calc           text not null check (calc in (
                   'tetap_bulanan',            -- nominal per bulan
                   'per_hari_hadir',           -- nominal x hari hadir
                   'per_jam',                  -- nominal x jam (lembur)
                   'per_menit',                -- nominal x menit (telat / pulang cepat)
                   'per_kejadian',             -- nominal x jumlah kejadian
                   'proporsional_gaji_harian'  -- gaji pokok / hari kerja, dikali kejadian
                 )),
  amount         bigint check (amount >= 0),
  trigger_event  text check (trigger_event in ('telat', 'pulang_cepat', 'alpa')),
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check ((calc = 'proporsional_gaji_harian') = (amount is null)),
  foreign key (employee_id, company_id)
    references public.employees (id, company_id) on delete cascade
);

comment on table public.payroll_rules is 'Komponen gaji per usaha (atau per karyawan). Perubahan lewat RPC + audit_logs.';

create index payroll_rules_company_id_idx on public.payroll_rules (company_id);

create trigger payroll_rules_updated_at before update on public.payroll_rules
  for each row execute function public.set_updated_at();

create table public.payroll_runs (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references public.companies (id) on delete cascade,
  period_start      date not null,
  period_end        date not null,
  status            text not null default 'draft' check (status in ('draft', 'dikunci')),
  locked_at         timestamptz,
  locked_by         uuid references auth.users (id) on delete set null,
  employee_count    integer not null default 0 check (employee_count >= 0),
  total_gross       bigint not null default 0,
  total_deductions  bigint not null default 0,
  total_net         bigint not null default 0,
  created_by        uuid references auth.users (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (id, company_id),
  unique (company_id, period_start),
  check (period_end >= period_start),
  check ((status = 'dikunci') = (locked_at is not null))
);

create trigger payroll_runs_updated_at before update on public.payroll_runs
  for each row execute function public.set_updated_at();

create table public.payslips (
  id                      uuid primary key default gen_random_uuid(),
  company_id              uuid not null references public.companies (id) on delete cascade,
  payroll_run_id          uuid not null,
  employee_id             uuid not null,
  base_salary             bigint not null default 0,
  total_allowances        bigint not null default 0,
  total_overtime          bigint not null default 0,
  total_deductions        bigint not null default 0,
  cash_advance_deduction  bigint not null default 0,
  adjustment              bigint not null default 0,                    -- penyesuaian dari periode terkunci sebelumnya
  net_pay                 bigint not null default 0,
  lines                   jsonb not null default '[]'::jsonb,           -- rincian per komponen
  attendance_summary      jsonb not null default '{}'::jsonb,
  pdf_path                text,
  wa_sent_at              timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique (payroll_run_id, employee_id),
  foreign key (payroll_run_id, company_id)
    references public.payroll_runs (id, company_id) on delete cascade,
  foreign key (employee_id, company_id)
    references public.employees (id, company_id) on delete restrict
);

create index payslips_employee_id_idx on public.payslips (employee_id);

create trigger payslips_updated_at before update on public.payslips
  for each row execute function public.set_updated_at();

create table public.cash_advances (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references public.companies (id) on delete cascade,
  employee_id         uuid not null,
  amount              bigint not null check (amount > 0),
  installment_amount  bigint not null check (installment_amount > 0),
  balance             bigint not null check (balance >= 0),              -- sisa; dikurangi saat gajian dikunci
  status              text not null default 'aktif' check (status in ('aktif', 'lunas', 'dibatalkan')),
  given_on            date not null default current_date,
  note                text,
  created_by          uuid default auth.uid() references auth.users (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  check (installment_amount <= amount),
  check (balance <= amount),
  foreign key (employee_id, company_id)
    references public.employees (id, company_id) on delete restrict
);

create index cash_advances_company_employee_idx on public.cash_advances (company_id, employee_id);

create trigger cash_advances_updated_at before update on public.cash_advances
  for each row execute function public.set_updated_at();

-- Saldo awal kasbon = nominal, tidak bisa diisi client.
create function public.cash_advance_init_balance()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.balance := new.amount;
  return new;
end;
$$;

create trigger cash_advances_init_balance before insert on public.cash_advances
  for each row execute function public.cash_advance_init_balance();


-- -----------------------------------------------------------------------------
-- Langganan dan tagihan
-- -----------------------------------------------------------------------------

create table public.subscriptions (
  id                    uuid primary key default gen_random_uuid(),
  company_id            uuid not null references public.companies (id) on delete cascade,
  plan_code             text not null references public.plans (code),
  status                text not null check (status in ('trialing', 'active', 'past_due', 'canceled', 'expired')),
  billing_cycle         text not null default 'bulanan' check (billing_cycle in ('bulanan', 'tahunan')),
  trial_ends_at         timestamptz,
  current_period_start  timestamptz,
  current_period_end    timestamptz,
  cancel_at_period_end  boolean not null default false,
  price_override        bigint check (price_override >= 0),             -- diskon atau harga Hutan
  provider              text check (provider in ('midtrans', 'xendit', 'manual')),
  provider_ref          text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (id, company_id),
  check (status <> 'trialing' or trial_ends_at is not null)
);

-- Maksimal satu langganan berjalan per usaha.
create unique index subscriptions_one_current_idx on public.subscriptions (company_id)
  where status in ('trialing', 'active', 'past_due');

create trigger subscriptions_updated_at before update on public.subscriptions
  for each row execute function public.set_updated_at();

create table public.invoices (
  id                   uuid primary key default gen_random_uuid(),
  company_id           uuid not null references public.companies (id) on delete cascade,
  subscription_id      uuid,
  number               text not null unique,
  amount               bigint not null check (amount >= 0),
  status               text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'expired', 'void')),
  period_start         timestamptz,
  period_end           timestamptz,
  due_at               timestamptz,
  paid_at              timestamptz,
  provider             text check (provider in ('midtrans', 'xendit', 'manual')),
  provider_invoice_id  text,
  payment_method       text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  check ((status = 'paid') = (paid_at is not null)),
  foreign key (subscription_id, company_id)
    references public.subscriptions (id, company_id) on delete set null (subscription_id)
);

create index invoices_company_id_idx on public.invoices (company_id, created_at desc);

create trigger invoices_updated_at before update on public.invoices
  for each row execute function public.set_updated_at();


-- -----------------------------------------------------------------------------
-- Audit dan izin support
-- -----------------------------------------------------------------------------

-- company_id sengaja tanpa foreign key: log tetap ada walau usaha dihapus.
create table public.audit_logs (
  id             bigint generated always as identity primary key,
  company_id     uuid,
  actor_user_id  uuid,
  actor_role     text not null check (actor_role in ('owner', 'admin', 'employee', 'platform_admin', 'system')),
  action         text not null check (action ~ '^[a-z0-9_]+\.[a-z0-9_]+$'),     -- contoh attendance.correct
  entity_table   text,
  entity_id      uuid,
  reason         text,
  before         jsonb,
  after          jsonb,
  created_at     timestamptz not null default now()
);

create index audit_logs_company_created_idx on public.audit_logs (company_id, created_at desc);
create index audit_logs_entity_idx on public.audit_logs (entity_table, entity_id);

create table public.support_access_grants (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id) on delete cascade,
  granted_by  uuid not null default auth.uid() references auth.users (id) on delete cascade,
  scope       text[] not null check (cardinality(scope) > 0 and scope <@ '{foto,lokasi,gaji}'::text[]),
  reason      text not null check (length(trim(reason)) > 0),
  expires_at  timestamptz not null default (now() + interval '24 hours'),
  revoked_at  timestamptz,
  created_at  timestamptz not null default now(),
  check (expires_at > created_at and expires_at <= created_at + interval '24 hours')
);

create index support_access_grants_company_idx on public.support_access_grants (company_id, expires_at desc);


-- -----------------------------------------------------------------------------
-- Fungsi akses dan paket
-- Semua security definer dengan search_path kosong; dipakai di RLS dan RPC.
-- -----------------------------------------------------------------------------

create function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.is_platform_admin from public.profiles p where p.id = (select auth.uid())),
    false
  );
$$;

create function public.is_company_member(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.company_members m
    where m.company_id = p_company_id and m.user_id = (select auth.uid())
  );
$$;

create function public.is_company_owner(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.company_members m
    where m.company_id = p_company_id and m.user_id = (select auth.uid()) and m.role = 'owner'
  );
$$;

-- Karyawan aktif di usaha ini (bukan owner/admin).
create function public.is_company_employee(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.employees e
    where e.company_id = p_company_id and e.user_id = (select auth.uid()) and e.status = 'aktif'
  );
$$;

-- Semua baris employees milik user ini yang masih aktif (bisa lebih dari satu usaha).
create function public.my_employee_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select e.id from public.employees e
  where e.user_id = (select auth.uid()) and e.status = 'aktif';
$$;

-- Dipakai policy slip karyawan (karyawan tidak punya akses baca payroll_runs).
create function public.is_payroll_run_locked(p_payroll_run_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.payroll_runs r
    where r.id = p_payroll_run_id and r.status = 'dikunci'
  );
$$;

-- Level efektif usaha. Tanpa langganan berjalan = benih.
create function public.company_level(p_company_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select p.level
      from public.subscriptions s
      join public.plans p on p.code = s.plan_code
      where s.company_id = p_company_id
        and (
          s.status in ('active', 'past_due')
          or (s.status = 'trialing' and s.trial_ends_at > now())
        )
      order by s.created_at desc
      limit 1
    ),
    'benih'
  );
$$;

create function public.has_feature(p_company_id uuid, p_feature_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select f.enabled from public.plan_features f
      where f.level = public.company_level(p_company_id) and f.feature_key = p_feature_key
    ),
    false
  );
$$;

-- Batas angka paket. null = tanpa batas. Key tidak dikenal = error.
create function public.plan_limit(p_company_id uuid, p_limit_key text)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_found boolean;
  v_limit integer;
begin
  select true, f.limit_value into v_found, v_limit
  from public.plan_features f
  where f.level = public.company_level(p_company_id) and f.feature_key = p_limit_key;

  if v_found is null then
    raise exception 'Batas paket "%" tidak dikenal.', p_limit_key;
  end if;

  return v_limit;
end;
$$;

-- Izin support aktif untuk scope tertentu (foto, lokasi, gaji).
create function public.has_support_access(p_company_id uuid, p_scope text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_platform_admin() and exists (
    select 1 from public.support_access_grants g
    where g.company_id = p_company_id
      and p_scope = any (g.scope)
      and g.revoked_at is null
      and now() < g.expires_at
  );
$$;

-- Catat audit. Hanya dipanggil dari RPC security definer lain, bukan dari client.
create function public.log_audit(
  p_company_id    uuid,
  p_actor_role    text,
  p_action        text,
  p_entity_table  text,
  p_entity_id     uuid,
  p_reason        text,
  p_before        jsonb,
  p_after         jsonb
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id bigint;
begin
  insert into public.audit_logs (company_id, actor_user_id, actor_role, action, entity_table, entity_id, reason, before, after)
  values (p_company_id, auth.uid(), p_actor_role, p_action, p_entity_table, p_entity_id, p_reason, p_before, p_after)
  returning id into v_id;
  return v_id;
end;
$$;


-- -----------------------------------------------------------------------------
-- Trigger aturan bisnis
-- -----------------------------------------------------------------------------

-- Batas lokasi aktif sesuai paket (lokasi_maks).
create function public.enforce_location_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit integer;
  v_count integer;
begin
  if not new.is_active then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.is_active then
    return new;
  end if;
  -- Bukan anggota usaha ini: biarkan RLS yang menolak, jangan bocorkan jumlah
  -- lokasi usaha lain lewat pesan error. auth.uid() null = service role / RPC.
  if auth.uid() is not null and not public.is_company_member(new.company_id) then
    return new;
  end if;

  -- Kunci baris usaha supaya dua insert bersamaan tidak lolos batas.
  perform 1 from public.companies c where c.id = new.company_id for update;

  v_limit := public.plan_limit(new.company_id, 'lokasi_maks');
  if v_limit is null then
    return new;
  end if;

  select count(*) into v_count
  from public.locations l
  where l.company_id = new.company_id and l.is_active and l.id <> new.id;

  if v_count >= v_limit then
    raise exception 'Paket kamu hanya bisa punya % lokasi absen aktif. Nonaktifkan lokasi lain atau upgrade ke Plus untuk menambah lokasi.', v_limit
      using errcode = 'P0001', hint = 'lokasi_maks';
  end if;

  return new;
end;
$$;

create trigger locations_enforce_limit before insert or update of is_active on public.locations
  for each row execute function public.enforce_location_limit();

-- Gajian yang sudah dikunci tidak bisa diubah atau dihapus.
create function public.prevent_locked_payroll_run_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'dikunci' then
    raise exception 'Gajian periode ini sudah dikunci dan tidak bisa diubah. Catat perubahan sebagai penyesuaian di periode berikutnya.'
      using errcode = 'P0001';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger payroll_runs_locked before update or delete on public.payroll_runs
  for each row execute function public.prevent_locked_payroll_run_change();

-- Slip di gajian terkunci: hanya pdf_path dan wa_sent_at yang boleh diisi.
create function public.prevent_locked_payslip_change()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_run_id uuid;
  v_locked boolean;
begin
  v_run_id := case when tg_op = 'INSERT' then new.payroll_run_id else old.payroll_run_id end;
  select r.status = 'dikunci' into v_locked from public.payroll_runs r where r.id = v_run_id;

  if not coalesce(v_locked, false) then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if tg_op = 'UPDATE'
     and (to_jsonb(new) - '{pdf_path,wa_sent_at,updated_at}'::text[])
       = (to_jsonb(old) - '{pdf_path,wa_sent_at,updated_at}'::text[]) then
    return new;
  end if;

  raise exception 'Slip gaji di gajian yang sudah dikunci tidak bisa diubah. Catat perubahan sebagai penyesuaian di periode berikutnya.'
    using errcode = 'P0001';
end;
$$;

create trigger payslips_locked before insert or update or delete on public.payslips
  for each row execute function public.prevent_locked_payslip_change();

-- Audit log tidak bisa diubah atau dihapus.
create function public.prevent_audit_log_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Audit log tidak bisa diubah atau dihapus.' using errcode = 'P0001';
end;
$$;

create trigger audit_logs_immutable before update or delete on public.audit_logs
  for each row execute function public.prevent_audit_log_change();


-- -----------------------------------------------------------------------------
-- Hak akses tabel (GRANT)
-- Supabase memberi anon/authenticated akses penuh secara default. Kita cabut
-- lalu beri yang diperlukan saja; RLS di bawah membatasi barisnya.
-- -----------------------------------------------------------------------------

revoke all on all tables in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

grant select on public.plans, public.plan_features to anon, authenticated;

grant select on
  public.profiles, public.companies, public.company_members, public.locations,
  public.work_schedules, public.employees, public.attendances, public.payroll_rules,
  public.payroll_runs, public.payslips, public.cash_advances, public.subscriptions,
  public.invoices, public.audit_logs, public.support_access_grants
to authenticated;

-- Profil: hanya nama dan nomor; is_platform_admin tidak bisa diubah sendiri.
grant update (full_name, phone) on public.profiles to authenticated;

-- Usaha: data onboarding saja. Suspend/arsip lewat RPC super admin.
grant update (name, business_type, city, timezone, employee_range, branch_count, onboarding, onboarding_completed_at)
  on public.companies to authenticated;

grant insert, delete on public.company_members to authenticated;

grant insert, update, delete on public.locations, public.work_schedules to authenticated;

-- Karyawan: gaji pokok hanya diisi saat tambah; perubahannya lewat RPC + audit.
grant insert (company_id, full_name, phone, position, base_salary, location_id, work_schedule_id, joined_on)
  on public.employees to authenticated;
grant update (full_name, phone, position, status, location_id, work_schedule_id, joined_on, deactivated_at)
  on public.employees to authenticated;
grant delete on public.employees to authenticated;

grant insert (company_id, employee_id, amount, installment_amount, given_on, note)
  on public.cash_advances to authenticated;
grant update (note) on public.cash_advances to authenticated;

grant insert (company_id, scope, reason, expires_at) on public.support_access_grants to authenticated;
grant update (revoked_at) on public.support_access_grants to authenticated;

-- Fungsi yang dipakai RLS dan app.
grant execute on function
  public.is_platform_admin(),
  public.is_company_member(uuid),
  public.is_company_owner(uuid),
  public.is_company_employee(uuid),
  public.my_employee_ids(),
  public.is_payroll_run_locked(uuid),
  public.company_level(uuid),
  public.has_feature(uuid, text),
  public.plan_limit(uuid, text)
to authenticated;
-- log_audit, has_support_access, dan fungsi trigger sengaja tidak di-grant.


-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------

alter table public.plans                 enable row level security;
alter table public.plan_features         enable row level security;
alter table public.profiles              enable row level security;
alter table public.companies             enable row level security;
alter table public.company_members       enable row level security;
alter table public.locations             enable row level security;
alter table public.work_schedules        enable row level security;
alter table public.employees             enable row level security;
alter table public.attendances           enable row level security;
alter table public.payroll_rules         enable row level security;
alter table public.payroll_runs          enable row level security;
alter table public.payslips              enable row level security;
alter table public.cash_advances         enable row level security;
alter table public.subscriptions         enable row level security;
alter table public.invoices              enable row level security;
alter table public.audit_logs            enable row level security;
alter table public.support_access_grants enable row level security;

-- Paket: publik.
create policy "Paket bisa dilihat semua orang" on public.plans
  for select to anon, authenticated using (is_active);
create policy "Fitur paket bisa dilihat semua orang" on public.plan_features
  for select to anon, authenticated using (true);

-- Profil: hanya diri sendiri. Nama karyawan ada di tabel employees.
create policy "Lihat profil sendiri" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "Ubah profil sendiri" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Usaha.
create policy "Anggota dan karyawan melihat usahanya" on public.companies
  for select to authenticated
  using (
    public.is_company_member(id)
    or public.is_company_employee(id)
    or public.is_platform_admin()
  );
create policy "Owner mengubah usahanya" on public.companies
  for update to authenticated
  using (public.is_company_owner(id)) with check (public.is_company_owner(id));

-- Anggota usaha. Owner dibuat lewat RPC registrasi; owner hanya bisa menambah admin (Plus).
create policy "Anggota melihat sesama anggota" on public.company_members
  for select to authenticated
  using (public.is_company_member(company_id) or public.is_platform_admin());
create policy "Owner menambah admin (Plus)" on public.company_members
  for insert to authenticated
  with check (
    role = 'admin'
    and public.is_company_owner(company_id)
    and public.has_feature(company_id, 'admin_tambahan')
  );
create policy "Owner menghapus admin" on public.company_members
  for delete to authenticated
  using (role = 'admin' and public.is_company_owner(company_id));

-- Lokasi dan jam kerja: anggota kelola, karyawan lihat.
create policy "Anggota dan karyawan melihat lokasi" on public.locations
  for select to authenticated
  using (public.is_company_member(company_id) or public.is_company_employee(company_id));
create policy "Anggota menambah lokasi" on public.locations
  for insert to authenticated with check (public.is_company_member(company_id));
create policy "Anggota mengubah lokasi" on public.locations
  for update to authenticated
  using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
create policy "Anggota menghapus lokasi" on public.locations
  for delete to authenticated using (public.is_company_member(company_id));

create policy "Anggota dan karyawan melihat jam kerja" on public.work_schedules
  for select to authenticated
  using (public.is_company_member(company_id) or public.is_company_employee(company_id));
create policy "Anggota menambah jam kerja" on public.work_schedules
  for insert to authenticated with check (public.is_company_member(company_id));
create policy "Anggota mengubah jam kerja" on public.work_schedules
  for update to authenticated
  using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
create policy "Anggota menghapus jam kerja" on public.work_schedules
  for delete to authenticated using (public.is_company_member(company_id));

-- Karyawan.
create policy "Anggota melihat karyawan, karyawan melihat dirinya" on public.employees
  for select to authenticated
  using (public.is_company_member(company_id) or user_id = (select auth.uid()));
create policy "Anggota menambah karyawan" on public.employees
  for insert to authenticated with check (public.is_company_member(company_id));
create policy "Anggota mengubah data karyawan" on public.employees
  for update to authenticated
  using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
create policy "Anggota menghapus undangan yang belum aktif" on public.employees
  for delete to authenticated
  using (public.is_company_member(company_id) and status = 'diundang');

-- Absen: hanya baca. Clock-in/out dan koreksi lewat RPC.
create policy "Anggota melihat absen, karyawan melihat absennya" on public.attendances
  for select to authenticated
  using (
    public.is_company_member(company_id)
    or employee_id in (select public.my_employee_ids())
  );

-- Aturan gaji: hanya baca. Perubahan lewat RPC + audit.
create policy "Anggota melihat aturan gaji" on public.payroll_rules
  for select to authenticated using (public.is_company_member(company_id));

-- Gajian: hanya baca. Proses dan kunci lewat RPC.
create policy "Anggota melihat gajian" on public.payroll_runs
  for select to authenticated using (public.is_company_member(company_id));

create policy "Anggota melihat slip, karyawan melihat slip terkuncinya" on public.payslips
  for select to authenticated
  using (
    public.is_company_member(company_id)
    or (
      employee_id in (select public.my_employee_ids())
      and public.is_payroll_run_locked(payroll_run_id)
    )
  );

-- Kasbon (Dasar ke atas).
create policy "Anggota melihat kasbon, karyawan melihat kasbonnya" on public.cash_advances
  for select to authenticated
  using (
    public.is_company_member(company_id)
    or employee_id in (select public.my_employee_ids())
  );
create policy "Anggota mencatat kasbon (Dasar)" on public.cash_advances
  for insert to authenticated
  with check (public.is_company_member(company_id) and public.has_feature(company_id, 'kasbon'));
create policy "Anggota mengubah catatan kasbon" on public.cash_advances
  for update to authenticated
  using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));

-- Langganan dan tagihan: hanya baca. Ditulis webhook pembayaran (service role) dan RPC super admin.
create policy "Owner dan super admin melihat langganan" on public.subscriptions
  for select to authenticated
  using (public.is_company_owner(company_id) or public.is_platform_admin());

create policy "Owner dan super admin melihat tagihan" on public.invoices
  for select to authenticated
  using (public.is_company_owner(company_id) or public.is_platform_admin());

-- Audit: owner melihat log usahanya.
create policy "Owner melihat audit usahanya" on public.audit_logs
  for select to authenticated using (public.is_company_owner(company_id));

-- Izin support: owner memberi dan mencabut; super admin melihat izin yang masih berlaku.
create policy "Owner dan super admin melihat izin support" on public.support_access_grants
  for select to authenticated
  using (
    public.is_company_owner(company_id)
    or (public.is_platform_admin() and revoked_at is null and now() < expires_at)
  );
create policy "Owner memberi izin support" on public.support_access_grants
  for insert to authenticated
  with check (public.is_company_owner(company_id) and granted_by = (select auth.uid()));
create policy "Owner mencabut izin support" on public.support_access_grants
  for update to authenticated
  using (public.is_company_owner(company_id)) with check (public.is_company_owner(company_id));


-- -----------------------------------------------------------------------------
-- Seed paket
-- Tahunan = 10 x bulanan (gratis 2 bulan). Hutan = harga custom.
-- -----------------------------------------------------------------------------

insert into public.plans (code, tier, level, name, min_employees, max_employees, price_monthly, price_yearly, sort_order) values
  ('benih',           'benih',      'benih', 'Benih',             1,  5,    0,      0,       10),
  ('tunas_dasar',     'tunas',      'dasar', 'Tunas Dasar',       2,  5,    39000,  390000,  20),
  ('tunas_plus',      'tunas',      'plus',  'Tunas Plus',        2,  5,    79000,  790000,  21),
  ('tumbuh_dasar',    'tumbuh',     'dasar', 'Tumbuh Dasar',      6,  15,   69000,  690000,  30),
  ('tumbuh_plus',     'tumbuh',     'plus',  'Tumbuh Plus',       6,  15,   149000, 1490000, 31),
  ('berkembang_dasar','berkembang', 'dasar', 'Berkembang Dasar',  16, 30,   129000, 1290000, 40),
  ('berkembang_plus', 'berkembang', 'plus',  'Berkembang Plus',   16, 30,   249000, 2490000, 41),
  ('rindang_dasar',   'rindang',    'dasar', 'Rindang Dasar',     31, 50,   199000, 1990000, 50),
  ('rindang_plus',    'rindang',    'plus',  'Rindang Plus',      31, 50,   399000, 3990000, 51),
  ('hutan_dasar',     'hutan',      'dasar', 'Hutan Dasar',       51, null, null,   null,    60),
  ('hutan_plus',      'hutan',      'plus',  'Hutan Plus',        51, null, null,   null,    61);

-- Fitur sesuai matriks PRD bagian 6.
insert into public.plan_features (level, feature_key, enabled) values
  ('benih', 'kasbon',               false),
  ('benih', 'shift',                false),
  ('benih', 'cuti',                 false),
  ('benih', 'multi_lokasi',         false),
  ('benih', 'wa_auto',              false),
  ('benih', 'export',               false),
  ('benih', 'import_excel',         false),
  ('benih', 'bpjs_pph21',           false),
  ('benih', 'thr',                  false),
  ('benih', 'admin_tambahan',       false),
  ('benih', 'slip_tanpa_watermark', false),

  ('dasar', 'kasbon',               true),
  ('dasar', 'shift',                false),
  ('dasar', 'cuti',                 false),
  ('dasar', 'multi_lokasi',         false),
  ('dasar', 'wa_auto',              false),
  ('dasar', 'export',               false),
  ('dasar', 'import_excel',         false),
  ('dasar', 'bpjs_pph21',           false),
  ('dasar', 'thr',                  false),
  ('dasar', 'admin_tambahan',       false),
  ('dasar', 'slip_tanpa_watermark', true),

  ('plus',  'kasbon',               true),
  ('plus',  'shift',                true),
  ('plus',  'cuti',                 true),
  ('plus',  'multi_lokasi',         true),
  ('plus',  'wa_auto',              true),
  ('plus',  'export',               true),
  ('plus',  'import_excel',         true),
  ('plus',  'bpjs_pph21',           true),
  ('plus',  'thr',                  true),
  ('plus',  'admin_tambahan',       true),
  ('plus',  'slip_tanpa_watermark', true);

-- Batas angka per level. limit_value null = tanpa batas.
insert into public.plan_features (level, feature_key, enabled, limit_value) values
  ('benih', 'lokasi_maks',      true, 1),
  ('dasar', 'lokasi_maks',      true, 1),
  ('plus',  'lokasi_maks',      true, null),
  ('benih', 'simpan_foto_hari', true, 30),
  ('dasar', 'simpan_foto_hari', true, 365),
  ('plus',  'simpan_foto_hari', true, 730),
  ('benih', 'riwayat_bulan',    true, 3),
  ('dasar', 'riwayat_bulan',    true, null),
  ('plus',  'riwayat_bulan',    true, null);
