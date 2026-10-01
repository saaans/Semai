-- =============================================================================
-- Semai · Absen remote per karyawan
--
-- - Owner/admin menandai karyawan "kerja remote" (employees.is_remote).
--   Karyawan remote tetap absen dengan selfie + GPS (lokasi dicatat), tapi
--   tanpa cek radius dan tanpa wajib punya lokasi absen.
-- - Hanya paket berbayar: feature key absen_remote (Dasar dan Plus).
-- - Usaha turun ke Benih: absen remote tetap jalan 14 hari (masa tenggang)
--   dihitung dari berakhirnya langganan terakhir, lalu kembali wajib radius.
--   Absen tidak pernah diblokir karena langganan; yang berubah hanya aturan
--   lokasinya, dan owner + karyawan diberi peringatan selama tenggang.
-- - Mengubah status remote lewat RPC set_employee_remote, tercatat di audit.
-- - clock_in / clock_out tidak berubah: aturan remote ada di
--   check_attendance_position yang mereka panggil.
-- - Aman dijalankan ulang.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Kolom dan fitur paket
-- -----------------------------------------------------------------------------

alter table public.employees
  add column if not exists is_remote boolean not null default false;

comment on column public.employees.is_remote is 'Kerja remote: absen tanpa cek radius (paket berbayar). Diubah lewat RPC set_employee_remote.';

insert into public.plan_features (level, feature_key, enabled) values
  ('benih', 'absen_remote', false),
  ('dasar', 'absen_remote', true),
  ('plus',  'absen_remote', true)
on conflict (level, feature_key) do update set enabled = excluded.enabled;


-- -----------------------------------------------------------------------------
-- Status absen remote per usaha
-- -----------------------------------------------------------------------------

-- allowed = absen remote berlaku. grace_until terisi selama masa tenggang
-- setelah turun ke Benih. Hanya untuk anggota atau karyawan usaha ini.
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

  -- Kapan langganan terakhir berakhir: trial = trial_ends_at, selain itu
  -- saat status berubah jadi canceled/expired.
  select max(case when s.status = 'trialing' then s.trial_ends_at else s.updated_at end)
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

-- Karyawan ini boleh absen tanpa radius sekarang.
create or replace function public.remote_attendance_allowed(p_company_id uuid, p_employee_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select e.is_remote from public.employees e where e.id = p_employee_id and e.company_id = p_company_id),
    false
  ) and coalesce((select s.allowed from public.remote_attendance_status(p_company_id) s), false);
$$;


-- -----------------------------------------------------------------------------
-- Validasi posisi absen (dipanggil clock_in / clock_out)
-- -----------------------------------------------------------------------------

create or replace function public.check_attendance_position(
  p_company_id     uuid,
  p_employee_id    uuid,
  p_location_id    uuid,
  p_location_name  text,
  p_loc_lat        double precision,
  p_loc_lng        double precision,
  p_radius_m       integer,
  p_lat            double precision,
  p_lng            double precision,
  p_photo_path     text
)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_distance  integer;
  v_remote    boolean := public.remote_attendance_allowed(p_company_id, p_employee_id);
  v_was_remote boolean;
begin
  if p_location_id is null and not v_remote then
    select e.is_remote into v_was_remote from public.employees e where e.id = p_employee_id;
    if v_was_remote then
      raise exception 'Absen remote tidak aktif karena paket usaha sudah turun ke Benih. Minta pemilik usaha mengatur lokasi absenmu atau upgrade paket.'
        using errcode = 'P0001', hint = 'remote_berakhir';
    end if;
    raise exception 'Lokasi absenmu belum diatur. Minta pemilik usaha mengatur lokasi absen.'
      using errcode = 'P0001', hint = 'lokasi_belum_diatur';
  end if;

  -- GPS tetap wajib untuk remote: lokasi dicatat untuk owner.
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'Lokasi HP tidak terbaca. Nyalakan GPS lalu coba lagi.'
      using errcode = 'P0001', hint = 'gps_tidak_valid';
  end if;

  if p_location_id is not null then
    v_distance := public.distance_m(p_lat, p_lng, p_loc_lat, p_loc_lng);
  end if;

  if not v_remote and v_distance > p_radius_m then
    raise exception 'Kamu berada % m dari lokasi %. Absen hanya bisa dalam radius % m.',
      v_distance, p_location_name, p_radius_m
      using errcode = 'P0001', hint = 'di_luar_radius';
  end if;

  if p_photo_path is null
     or p_photo_path not like p_company_id::text || '/' || p_employee_id::text || '/%'
     or not exists (
       select 1 from storage.objects o where o.bucket_id = 'absen-foto' and o.name = p_photo_path
     ) then
    raise exception 'Foto absen belum terkirim. Ambil foto lagi lalu kirim ulang.'
      using errcode = 'P0001', hint = 'foto_tidak_ada';
  end if;

  -- Remote tanpa lokasi absen: jarak tidak ada (null).
  return v_distance;
end;
$$;


-- -----------------------------------------------------------------------------
-- Ubah status remote karyawan
-- -----------------------------------------------------------------------------

create or replace function public.set_employee_remote(p_employee_id uuid, p_remote boolean)
returns setof public.employees
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old   public.employees;
  v_new   public.employees;
  v_role  text;
begin
  select * into v_old from public.employees e where e.id = p_employee_id for update;
  v_role := public.member_role(v_old.company_id);
  if v_old.id is null or v_role is null then
    raise exception 'Karyawan tidak ditemukan.'
      using errcode = 'P0001', hint = 'karyawan_tidak_ada';
  end if;

  if p_remote is null then
    raise exception 'Pilih kerja remote atau di lokasi.'
      using errcode = 'P0001', hint = 'pilihan_kosong';
  end if;

  -- Mematikan remote selalu boleh; menyalakan butuh paket berbayar.
  if p_remote and not public.has_feature(v_old.company_id, 'absen_remote') then
    raise exception 'Absen remote hanya untuk paket Dasar dan Plus. Upgrade paket untuk mengaktifkannya.'
      using errcode = 'P0001', hint = 'fitur_terkunci';
  end if;

  update public.employees e set is_remote = p_remote where e.id = v_old.id
  returning * into v_new;

  if v_old.is_remote is distinct from v_new.is_remote then
    perform public.log_audit(
      v_old.company_id, v_role, 'employee.set_remote', 'employees', v_old.id, null,
      jsonb_build_object('is_remote', v_old.is_remote), jsonb_build_object('is_remote', v_new.is_remote)
    );
  end if;

  return next v_new;
end;
$$;


-- -----------------------------------------------------------------------------
-- Hak akses fungsi
-- -----------------------------------------------------------------------------

revoke execute on function
  public.remote_attendance_status(uuid),
  public.remote_attendance_allowed(uuid, uuid),
  public.check_attendance_position(uuid, uuid, uuid, text, double precision, double precision, integer, double precision, double precision, text),
  public.set_employee_remote(uuid, boolean)
from public, anon, authenticated;

grant execute on function
  public.remote_attendance_status(uuid),
  public.set_employee_remote(uuid, boolean)
to authenticated;
