-- =============================================================================
-- Semai · Lokasi absen di pengaturan
--
-- - Owner/admin melihat dan mengubah lokasi absen (nama, titik, radius) dari
--   /owner/pengaturan lewat RPC save_location.
-- - Semua perubahan lokasi (dari onboarding, pengaturan, atau jalur lain)
--   tercatat di audit_logs lewat trigger, karena radius menentukan siapa yang
--   bisa absen.
-- - Karyawan aktif/diundang yang belum punya lokasi (dan bukan remote)
--   otomatis dihubungkan saat lokasi disimpan, kalau ini satu-satunya lokasi
--   aktif usaha.
-- - Batas jumlah lokasi (lokasi_maks) dan mode baca saja tetap dijaga
--   trigger yang sudah ada.
-- - Aman dijalankan ulang.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Audit perubahan lokasi
-- -----------------------------------------------------------------------------

create or replace function public.audit_location_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before jsonb;
  v_after  jsonb;
begin
  v_after := jsonb_build_object(
    'name', new.name, 'latitude', new.latitude, 'longitude', new.longitude,
    'radius_m', new.radius_m, 'is_active', new.is_active
  );
  if tg_op = 'UPDATE' then
    v_before := jsonb_build_object(
      'name', old.name, 'latitude', old.latitude, 'longitude', old.longitude,
      'radius_m', old.radius_m, 'is_active', old.is_active
    );
    if v_before = v_after then
      return new;
    end if;
  end if;

  perform public.log_audit(
    new.company_id,
    coalesce(public.member_role(new.company_id), 'system'),
    case when tg_op = 'INSERT' then 'location.create' else 'location.update' end,
    'locations', new.id, null, v_before, v_after
  );
  return new;
end;
$$;

drop trigger if exists locations_audit on public.locations;
create trigger locations_audit after insert or update on public.locations
  for each row execute function public.audit_location_change();


-- -----------------------------------------------------------------------------
-- Simpan lokasi dari pengaturan
-- -----------------------------------------------------------------------------

-- p_location_id null = buat lokasi baru (usaha yang belum punya lokasi).
create or replace function public.save_location(
  p_company_id   uuid,
  p_location_id  uuid,
  p_name         text,
  p_latitude     double precision,
  p_longitude    double precision,
  p_radius_m     integer
)
returns setof public.locations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row  public.locations;
begin
  if public.member_role(p_company_id) is null then
    raise exception 'Kamu tidak punya akses ke usaha ini.'
      using errcode = '42501', hint = 'bukan_anggota';
  end if;

  if length(trim(coalesce(p_name, ''))) = 0 or length(trim(p_name)) > 80 then
    raise exception 'Nama lokasi wajib diisi, maksimal 80 karakter. Contoh: Toko pusat.'
      using errcode = 'P0001', hint = 'nama_tidak_valid';
  end if;
  if p_latitude is null or p_longitude is null
     or p_latitude not between -90 and 90 or p_longitude not between -180 and 180 then
    raise exception 'Pilih titik lokasi di peta dulu, atau ketuk Pakai lokasi saya.'
      using errcode = 'P0001', hint = 'titik_tidak_valid';
  end if;
  if p_radius_m is null or p_radius_m not between 10 and 1000 then
    raise exception 'Radius absen harus antara 10 m dan 1.000 m.'
      using errcode = 'P0001', hint = 'radius_tidak_valid';
  end if;

  if p_location_id is null then
    insert into public.locations (company_id, name, latitude, longitude, radius_m, is_active)
    values (p_company_id, trim(p_name), p_latitude, p_longitude, p_radius_m, true)
    returning * into v_row;
  else
    update public.locations l
    set name = trim(p_name),
        latitude = p_latitude,
        longitude = p_longitude,
        radius_m = p_radius_m
    where l.id = p_location_id and l.company_id = p_company_id
    returning * into v_row;

    if v_row.id is null then
      raise exception 'Lokasi tidak ditemukan. Muat ulang halaman lalu coba lagi.'
        using errcode = 'P0001', hint = 'lokasi_tidak_ada';
    end if;
  end if;

  -- Satu-satunya lokasi aktif: hubungkan karyawan yang belum punya lokasi.
  if v_row.is_active and not exists (
    select 1 from public.locations l
    where l.company_id = p_company_id and l.is_active and l.id <> v_row.id
  ) then
    update public.employees e
    set location_id = v_row.id
    where e.company_id = p_company_id
      and e.location_id is null
      and not e.is_remote
      and e.status in ('aktif', 'diundang');
  end if;

  return next v_row;
end;
$$;


-- -----------------------------------------------------------------------------
-- Hak akses fungsi
-- -----------------------------------------------------------------------------

revoke execute on function
  public.audit_location_change(),
  public.save_location(uuid, uuid, text, double precision, double precision, integer)
from public, anon, authenticated;

grant execute on function
  public.save_location(uuid, uuid, text, double precision, double precision, integer)
to authenticated;
