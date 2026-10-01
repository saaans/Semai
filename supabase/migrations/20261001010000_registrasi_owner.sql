-- =============================================================================
-- Semai · Registrasi owner (OWN-01)
--
-- Setelah owner daftar (Google atau email terverifikasi), app memanggil
-- ensure_owner_company() untuk membuat usaha kosong + keanggotaan owner.
-- Fungsi ini idempoten: aman dipanggil berulang (callback dobel, refresh).
-- =============================================================================

create function public.ensure_owner_company()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id     uuid := auth.uid();
  v_email       text;
  v_confirmed   timestamptz;
  v_company_id  uuid;
begin
  if v_user_id is null then
    raise exception 'Belum masuk.' using errcode = '28000';
  end if;

  -- Cegah dua usaha terbentuk dari request bersamaan untuk user yang sama.
  perform pg_advisory_xact_lock(hashtextextended('ensure_owner_company:' || v_user_id::text, 0));

  -- Sudah jadi anggota usaha (owner atau admin): kembalikan usaha yang ada.
  select m.company_id into v_company_id
  from public.company_members m
  where m.user_id = v_user_id
  order by (m.role = 'owner') desc, m.created_at
  limit 1;

  if v_company_id is not null then
    return v_company_id;
  end if;

  select u.email, u.email_confirmed_at into v_email, v_confirmed
  from auth.users u
  where u.id = v_user_id;

  -- Akun karyawan (email sintetis) tidak boleh membuat usaha.
  if v_email like '%@karyawan.semai.internal' then
    raise exception 'Akun karyawan tidak bisa membuat usaha.' using errcode = '42501';
  end if;

  -- Pendaftaran manual wajib verifikasi email dulu.
  if v_confirmed is null then
    raise exception 'Email belum diverifikasi.' using errcode = '42501';
  end if;

  insert into public.companies (created_by)
  values (v_user_id)
  returning id into v_company_id;

  insert into public.company_members (company_id, user_id, role)
  values (v_company_id, v_user_id, 'owner');

  perform public.log_audit(
    v_company_id, 'owner', 'company.create', 'companies', v_company_id,
    'Registrasi owner', null, jsonb_build_object('created_by', v_user_id)
  );

  return v_company_id;
end;
$$;

comment on function public.ensure_owner_company() is
  'Buat usaha kosong + company_members role owner untuk user yang login, atau kembalikan usaha yang sudah ada.';

revoke execute on function public.ensure_owner_company() from public, anon;
grant execute on function public.ensure_owner_company() to authenticated;
