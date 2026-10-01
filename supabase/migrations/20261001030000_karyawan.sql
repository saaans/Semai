-- =============================================================================
-- Semai · Undang dan aktivasi karyawan (OWN-04, EMP-01)
--
-- - Owner menambah karyawan lewat add_employee(): insert + token undangan +
--   audit (gaji pokok awal) dalam satu transaksi.
-- - Token undangan hanya dikembalikan sekali; database menyimpan hash SHA-256.
-- - Batas jumlah karyawan per paket dijaga trigger di tabel employees.
--   Yang dihitung: karyawan aktif + diundang.
-- - Akun Auth karyawan dibuat app dengan service role (email sintetis
--   {nomor}@karyawan.semai.internal). Password = HMAC(PIN) dengan secret
--   server, jadi PIN tidak bisa ditebak langsung lewat API Supabase.
-- - Percobaan PIN salah dicatat di employee_login_attempts (hanya service role).
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Paket aktif dan batas karyawan
-- -----------------------------------------------------------------------------

-- Kode paket efektif usaha. Tanpa langganan berjalan = benih.
create function public.current_plan_code(p_company_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select s.plan_code
      from public.subscriptions s
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

-- Batas karyawan (aktif + diundang) sesuai paket. null = tanpa batas.
create function public.employee_limit(p_company_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select p.max_employees from public.plans p where p.code = public.current_plan_code(p_company_id);
$$;

create function public.enforce_employee_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit integer;
  v_count integer;
begin
  -- Hanya penambahan kursi: karyawan baru, atau nonaktif yang diaktifkan lagi.
  if new.status = 'nonaktif' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status <> 'nonaktif' then
    return new;
  end if;
  -- Bukan anggota usaha ini: biarkan RLS yang menolak, jangan bocorkan jumlah.
  if auth.uid() is not null and not public.is_company_member(new.company_id) then
    return new;
  end if;

  -- Kunci baris usaha supaya dua penambahan bersamaan tidak lolos batas.
  perform 1 from public.companies c where c.id = new.company_id for update;

  v_limit := public.employee_limit(new.company_id);
  if v_limit is null then
    return new;
  end if;

  select count(*) into v_count
  from public.employees e
  where e.company_id = new.company_id and e.status in ('aktif', 'diundang') and e.id <> new.id;

  if v_count >= v_limit then
    raise exception 'Paket kamu hanya untuk % karyawan (aktif dan diundang). Upgrade paket untuk menambah karyawan.', v_limit
      using errcode = 'P0001', hint = 'karyawan_maks';
  end if;

  return new;
end;
$$;

create trigger employees_enforce_limit before insert or update of status on public.employees
  for each row execute function public.enforce_employee_limit();


-- -----------------------------------------------------------------------------
-- Undangan
-- -----------------------------------------------------------------------------

create function public.hash_invite_token(p_token text)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(sha256(convert_to(p_token, 'UTF8')), 'hex');
$$;

-- Buat token undangan baru (link lama tidak berlaku). Berlaku 7 hari.
-- Hanya dipanggil dari RPC lain yang sudah mengecek hak akses.
create function public.issue_employee_invite(p_employee_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
begin
  update public.employees e
  set invite_token_hash = public.hash_invite_token(v_token),
      invite_expires_at = now() + interval '7 days'
  where e.id = p_employee_id;
  return v_token;
end;
$$;

-- Tambah karyawan + token undangan. Gaji pokok awal tercatat di audit_logs.
create function public.add_employee(
  p_company_id   uuid,
  p_full_name    text,
  p_phone        text,
  p_position     text,
  p_base_salary  bigint
)
returns table (employee_id uuid, token text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id     uuid;
  v_role   text;
  v_token  text;
begin
  select m.role into v_role
  from public.company_members m
  where m.company_id = p_company_id and m.user_id = auth.uid();
  if v_role is null then
    raise exception 'Kamu bukan pengelola usaha ini.' using errcode = '42501';
  end if;

  begin
    insert into public.employees (company_id, full_name, phone, position, base_salary, location_id, work_schedule_id)
    values (
      p_company_id,
      trim(p_full_name),
      p_phone,
      nullif(trim(coalesce(p_position, '')), ''),
      coalesce(p_base_salary, 0),
      (select l.id from public.locations l where l.company_id = p_company_id and l.is_active order by l.created_at limit 1),
      (select w.id from public.work_schedules w where w.company_id = p_company_id and w.is_default limit 1)
    )
    returning id into v_id;
  exception when unique_violation then
    raise exception 'Nomor ini sudah terdaftar sebagai karyawan di usahamu. Cek daftar karyawan.'
      using errcode = 'P0001', hint = 'nomor_terdaftar';
  end;

  v_token := public.issue_employee_invite(v_id);

  perform public.log_audit(
    p_company_id, v_role, 'employee.create', 'employees', v_id,
    'Tambah karyawan', null,
    jsonb_build_object('full_name', trim(p_full_name), 'base_salary', coalesce(p_base_salary, 0))
  );

  return query
    select v_id, v_token, e.invite_expires_at from public.employees e where e.id = v_id;
end;
$$;

-- Link undangan baru untuk karyawan yang belum aktivasi.
create function public.renew_employee_invite(p_employee_id uuid)
returns table (token text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company_id  uuid;
  v_status      text;
  v_token       text;
begin
  select e.company_id, e.status into v_company_id, v_status
  from public.employees e where e.id = p_employee_id for update;
  if v_company_id is null or not public.is_company_member(v_company_id) then
    raise exception 'Karyawan tidak ditemukan.' using errcode = '42501';
  end if;
  if v_status <> 'diundang' then
    raise exception 'Karyawan ini sudah aktif atau nonaktif. Pakai Reset PIN kalau dia lupa PIN.'
      using errcode = 'P0001';
  end if;

  v_token := public.issue_employee_invite(p_employee_id);
  return query select v_token, e.invite_expires_at from public.employees e where e.id = p_employee_id;
end;
$$;

-- Reset PIN: link aktivasi baru untuk karyawan aktif. App lalu mengganti
-- password Auth lewat service role (PIN lama langsung tidak berlaku).
create function public.reset_employee_pin(p_employee_id uuid)
returns table (token text, expires_at timestamptz, user_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company_id  uuid;
  v_status      text;
  v_user_id     uuid;
  v_role        text;
  v_token       text;
begin
  select e.company_id, e.status, e.user_id into v_company_id, v_status, v_user_id
  from public.employees e where e.id = p_employee_id for update;

  select m.role into v_role
  from public.company_members m
  where m.company_id = v_company_id and m.user_id = auth.uid();
  if v_company_id is null or v_role is null then
    raise exception 'Karyawan tidak ditemukan.' using errcode = '42501';
  end if;
  if v_status <> 'aktif' or v_user_id is null then
    raise exception 'Reset PIN hanya untuk karyawan aktif. Untuk yang belum aktivasi, buat link baru.'
      using errcode = 'P0001';
  end if;

  v_token := public.issue_employee_invite(p_employee_id);

  perform public.log_audit(
    v_company_id, v_role, 'employee.reset_pin', 'employees', p_employee_id,
    'Reset PIN oleh pengelola', null, null
  );

  return query
    select v_token, e.invite_expires_at, v_user_id from public.employees e where e.id = p_employee_id;
end;
$$;

-- Data untuk halaman aktivasi publik. Kosong kalau token salah/kedaluwarsa.
create function public.get_invitation(p_token text)
returns table (
  company_name        text,
  employee_name       text,
  phone_masked        text,
  needs_existing_pin  boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce(c.name, 'Usaha'),
    e.full_name,
    -- 6281234567890 → 0812••••890
    '0' || substr(e.phone, 3, 3) || '••••' || right(e.phone, 3),
    exists (
      select 1 from auth.users u
      where u.email = e.phone || '@karyawan.semai.internal'
        and coalesce((u.raw_app_meta_data ->> 'pin_reset')::boolean, false) = false
    )
  from public.employees e
  join public.companies c on c.id = e.company_id
  where e.invite_token_hash = public.hash_invite_token(p_token)
    and e.invite_expires_at > now()
    and e.status <> 'nonaktif';
$$;

-- Untuk server (service role): akun Auth untuk nomor ini, kalau sudah ada.
create function public.employee_auth_account(p_phone text)
returns table (user_id uuid, pin_reset boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select u.id, coalesce((u.raw_app_meta_data ->> 'pin_reset')::boolean, false)
  from auth.users u
  where u.email = p_phone || '@karyawan.semai.internal';
$$;


-- -----------------------------------------------------------------------------
-- Batas percobaan PIN: 5 kali salah, kunci 15 menit (per nomor HP)
-- -----------------------------------------------------------------------------

create table public.employee_login_attempts (
  phone         text primary key check (phone ~ '^62[0-9]{8,13}$'),
  failed_count  integer not null default 0,
  locked_until  timestamptz,
  updated_at    timestamptz not null default now()
);

comment on table public.employee_login_attempts is 'Hitungan PIN salah per nomor. Hanya diakses service role.';

alter table public.employee_login_attempts enable row level security;
-- Tanpa policy dan tanpa grant: client tidak bisa membaca atau menulis.
-- (Supabase memberi grant otomatis ke tabel baru, jadi dicabut eksplisit.)
revoke all on public.employee_login_attempts from anon, authenticated;

-- Kembalikan waktu kunci kalau nomor sedang dikunci, null kalau boleh mencoba.
create function public.employee_login_locked_until(p_phone text)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select a.locked_until from public.employee_login_attempts a
  where a.phone = p_phone and a.locked_until > now();
$$;

-- Catat PIN salah. Kembalikan sisa percobaan (0 = baru saja dikunci).
create function public.employee_login_failed(p_phone text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  insert into public.employee_login_attempts as a (phone, failed_count, updated_at)
  values (p_phone, 1, now())
  on conflict (phone) do update
    set failed_count = case
          when a.locked_until is not null and a.locked_until <= now() then 1
          else a.failed_count + 1
        end,
        locked_until = case
          when a.locked_until is not null and a.locked_until <= now() then null
          else a.locked_until
        end,
        updated_at = now()
  returning failed_count into v_count;

  if v_count >= 5 then
    update public.employee_login_attempts
    set failed_count = 0, locked_until = now() + interval '15 minutes'
    where phone = p_phone;
    return 0;
  end if;
  return 5 - v_count;
end;
$$;

create function public.employee_login_succeeded(p_phone text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.employee_login_attempts where phone = p_phone;
$$;


-- -----------------------------------------------------------------------------
-- Hak akses fungsi
-- -----------------------------------------------------------------------------

revoke execute on function
  public.current_plan_code(uuid),
  public.employee_limit(uuid),
  public.enforce_employee_limit(),
  public.hash_invite_token(text),
  public.issue_employee_invite(uuid),
  public.add_employee(uuid, text, text, text, bigint),
  public.renew_employee_invite(uuid),
  public.reset_employee_pin(uuid),
  public.get_invitation(text),
  public.employee_auth_account(text),
  public.employee_login_locked_until(text),
  public.employee_login_failed(text),
  public.employee_login_succeeded(text)
from public, anon, authenticated;

grant execute on function
  public.current_plan_code(uuid),
  public.employee_limit(uuid),
  public.add_employee(uuid, text, text, text, bigint),
  public.renew_employee_invite(uuid),
  public.reset_employee_pin(uuid)
to authenticated;

-- Halaman aktivasi dibuka karyawan yang belum login.
grant execute on function public.get_invitation(text) to anon, authenticated;

grant execute on function
  public.employee_auth_account(text),
  public.employee_login_locked_until(text),
  public.employee_login_failed(text),
  public.employee_login_succeeded(text),
  public.get_invitation(text)
to service_role;
