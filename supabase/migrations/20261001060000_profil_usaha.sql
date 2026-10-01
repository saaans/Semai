-- =============================================================================
-- Semai · Profil usaha
--
-- - Kolom baru: logo, alamat, nomor WA usaha.
-- - Semua anggota usaha (owner dan admin) bisa mengubah profil lewat RPC
--   update_company_profile / set_company_logo. Policy update tabel companies
--   tetap khusus owner (pengaturan lain, misalnya mode absen).
-- - Zona waktu boleh diubah kapan saja. Data absen disimpan timestamptz,
--   jadi hanya tampilannya yang ikut zona baru.
-- - Logo di bucket publik logo-usaha (bukan data pribadi), path
--   {company_id}/logo-{waktu}.webp supaya cache CDN tidak menampilkan logo lama.
-- - Perubahan profil tercatat di audit_logs.
-- - Aman dijalankan ulang.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Kolom
-- -----------------------------------------------------------------------------

alter table public.companies
  add column if not exists logo_path  text,
  add column if not exists address    text,
  add column if not exists phone      text;

alter table public.companies drop constraint if exists companies_address_length;
alter table public.companies add constraint companies_address_length
  check (address is null or length(address) <= 200);

alter table public.companies drop constraint if exists companies_phone_format;
alter table public.companies add constraint companies_phone_format
  check (phone is null or phone ~ '^62[0-9]{8,13}$');

alter table public.companies drop constraint if exists companies_logo_path_format;
alter table public.companies add constraint companies_logo_path_format
  check (logo_path is null or logo_path like id::text || '/%');

comment on column public.companies.logo_path is 'Path logo di bucket publik logo-usaha. Diubah lewat RPC set_company_logo.';
comment on column public.companies.phone is 'Nomor WA usaha (format 62...), opsional. Beda dengan nomor WA owner di profiles.';


-- -----------------------------------------------------------------------------
-- Bucket logo (publik)
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('logo-usaha', 'logo-usaha', true, 204800, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Baca: publik lewat URL bucket (tanpa policy select, daftar file tidak terbuka).
-- Tulis/hapus: anggota usaha, hanya di folder usahanya.
drop policy if exists "Anggota mengunggah logo usahanya" on storage.objects;
create policy "Anggota mengunggah logo usahanya" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'logo-usaha'
    and public.is_company_member(public.storage_company_id(name))
  );

drop policy if exists "Anggota menghapus logo usahanya" on storage.objects;
create policy "Anggota menghapus logo usahanya" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'logo-usaha'
    and public.is_company_member(public.storage_company_id(name))
  );

-- Supabase Storage membaca baris dulu sebelum menghapus.
drop policy if exists "Anggota melihat logo usahanya" on storage.objects;
create policy "Anggota melihat logo usahanya" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'logo-usaha'
    and public.is_company_member(public.storage_company_id(name))
  );


-- -----------------------------------------------------------------------------
-- RPC profil
-- -----------------------------------------------------------------------------

create or replace function public.company_profile_snapshot(p_company public.companies)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'name',          p_company.name,
    'business_type', p_company.business_type,
    'city',          p_company.city,
    'timezone',      p_company.timezone,
    'address',       p_company.address,
    'phone',         p_company.phone,
    'logo_path',     p_company.logo_path
  );
$$;

create or replace function public.update_company_profile(
  p_company_id     uuid,
  p_name           text,
  p_business_type  text,
  p_city           text,
  p_timezone       text,
  p_address        text,
  p_phone          text
)
returns setof public.companies
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role  text := public.member_role(p_company_id);
  v_old   public.companies;
  v_new   public.companies;
begin
  if v_role is null then
    raise exception 'Kamu tidak punya akses ke usaha ini.'
      using errcode = '42501', hint = 'bukan_anggota';
  end if;

  if length(trim(coalesce(p_name, ''))) < 2 or length(trim(p_name)) > 80 then
    raise exception 'Nama usaha wajib diisi, 2 sampai 80 karakter.'
      using errcode = 'P0001', hint = 'nama_tidak_valid';
  end if;
  if length(trim(coalesce(p_city, ''))) < 2 or length(trim(p_city)) > 60 then
    raise exception 'Kota wajib diisi, 2 sampai 60 karakter.'
      using errcode = 'P0001', hint = 'kota_tidak_valid';
  end if;

  select * into v_old from public.companies c where c.id = p_company_id for update;

  begin
    update public.companies c
    set name = trim(p_name),
        business_type = p_business_type,
        city = trim(p_city),
        timezone = p_timezone,
        address = nullif(trim(p_address), ''),
        phone = nullif(trim(p_phone), '')
    where c.id = p_company_id
    returning * into v_new;
  exception when check_violation then
    raise exception 'Data profil belum benar. Periksa bidang usaha, zona waktu, alamat, dan nomor WA.'
      using errcode = 'P0001', hint = 'profil_tidak_valid';
  end;

  if public.company_profile_snapshot(v_old) is distinct from public.company_profile_snapshot(v_new) then
    perform public.log_audit(
      p_company_id, v_role, 'company.update_profile', 'companies', p_company_id, null,
      public.company_profile_snapshot(v_old), public.company_profile_snapshot(v_new)
    );
  end if;

  return next v_new;
end;
$$;

-- Pasang logo yang sudah diunggah (null = hapus logo). Mengembalikan path
-- lama supaya file lama bisa dihapus dari storage.
create or replace function public.set_company_logo(p_company_id uuid, p_logo_path text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role  text := public.member_role(p_company_id);
  v_old   text;
begin
  if v_role is null then
    raise exception 'Kamu tidak punya akses ke usaha ini.'
      using errcode = '42501', hint = 'bukan_anggota';
  end if;

  if p_logo_path is not null and (
    p_logo_path not like p_company_id::text || '/%'
    or not exists (
      select 1 from storage.objects o where o.bucket_id = 'logo-usaha' and o.name = p_logo_path
    )
  ) then
    raise exception 'Logo belum terunggah. Pilih gambar lagi lalu simpan.'
      using errcode = 'P0001', hint = 'logo_tidak_ada';
  end if;

  select c.logo_path into v_old from public.companies c where c.id = p_company_id for update;

  update public.companies c set logo_path = p_logo_path where c.id = p_company_id;

  if v_old is distinct from p_logo_path then
    perform public.log_audit(
      p_company_id, v_role, 'company.update_logo', 'companies', p_company_id, null,
      jsonb_build_object('logo_path', v_old), jsonb_build_object('logo_path', p_logo_path)
    );
  end if;

  return v_old;
end;
$$;


-- -----------------------------------------------------------------------------
-- Hak akses fungsi
-- -----------------------------------------------------------------------------

revoke execute on function
  public.company_profile_snapshot(public.companies),
  public.update_company_profile(uuid, text, text, text, text, text, text),
  public.set_company_logo(uuid, text)
from public, anon, authenticated;

grant execute on function
  public.update_company_profile(uuid, text, text, text, text, text, text),
  public.set_company_logo(uuid, text)
to authenticated;
