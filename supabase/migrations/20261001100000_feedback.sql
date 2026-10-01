-- =============================================================================
-- Semai · Feedback owner ke tim Semai
--
-- - Owner/admin usaha mengirim masukan lewat tombol mengambang di /owner.
-- - Super admin melihat semua masukan di /admin/feedback dan hanya bisa
--   mengubah status dan prioritas.
-- - Isi masukan ditulis owner sendiri, bukan data pribadi karyawan, jadi tidak
--   lewat support_access_grants.
-- - Tanpa notifikasi email/WA (Benih nol biaya variabel).
-- =============================================================================

create table public.feedbacks (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id) on delete cascade,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category    text not null check (category in ('saran_fitur', 'bug', 'pertanyaan', 'lainnya')),
  message     text not null check (length(trim(message)) between 5 and 2000),
  page_path   text check (page_path is null or (page_path ~ '^/' and length(page_path) <= 200)),
  status      text not null default 'baru'
              check (status in ('baru', 'ditinjau', 'direncanakan', 'selesai', 'ditolak')),
  priority    text check (priority in ('rendah', 'sedang', 'tinggi')),           -- null = belum diset
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.feedbacks is 'Masukan owner/admin usaha untuk tim Semai. Status dan prioritas diatur super admin.';

create index feedbacks_created_idx on public.feedbacks (created_at desc);
create index feedbacks_status_created_idx on public.feedbacks (status, created_at desc);
create index feedbacks_company_idx on public.feedbacks (company_id);

create trigger feedbacks_updated_at before update on public.feedbacks
  for each row execute function public.set_updated_at();


-- Hak akses: owner hanya isi kategori/isi/halaman; status dan prioritas pakai
-- default. Super admin hanya bisa mengubah status dan prioritas.
grant select on public.feedbacks to authenticated;
grant insert (company_id, category, message, page_path) on public.feedbacks to authenticated;
grant update (status, priority) on public.feedbacks to authenticated;

alter table public.feedbacks enable row level security;

create policy "Anggota melihat masukan usahanya" on public.feedbacks
  for select to authenticated
  using (public.is_company_member(company_id) or public.is_platform_admin());

create policy "Anggota mengirim masukan" on public.feedbacks
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.is_company_member(company_id));

create policy "Super admin mengubah status masukan" on public.feedbacks
  for update to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());


-- Daftar masukan untuk super admin, lengkap dengan nama pengirim dan usaha.
-- profiles hanya bisa dibaca pemiliknya, jadi nama diambil lewat fungsi ini.
create function public.admin_list_feedbacks(p_status text default null)
returns table (
  id            uuid,
  created_at    timestamptz,
  category      text,
  message       text,
  page_path     text,
  status        text,
  priority      text,
  sender_name   text,
  sender_email  text,
  company_id    uuid,
  company_name  text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Halaman ini khusus tim Semai.' using errcode = '42501';
  end if;

  return query
  select
    f.id, f.created_at, f.category, f.message, f.page_path, f.status, f.priority,
    coalesce(nullif(trim(p.full_name), ''), split_part(u.email::text, '@', 1)),
    u.email::text,
    f.company_id,
    c.name
  from public.feedbacks f
  left join public.profiles p on p.id = f.user_id
  left join auth.users u on u.id = f.user_id
  left join public.companies c on c.id = f.company_id
  where p_status is null or f.status = p_status
  order by f.created_at desc
  limit 500;
end;
$$;

revoke execute on function public.admin_list_feedbacks(text) from public, anon;
grant execute on function public.admin_list_feedbacks(text) to authenticated;
