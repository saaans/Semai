-- =============================================================================
-- Semai · Hapus otomatis foto absen sesuai masa simpan paket (PRD bagian 6 dan 10)
--
-- - Masa simpan dibaca dari plan_features key simpan_foto_hari untuk level
--   usaha (company_level). limit_value null = tanpa batas, tidak dihapus.
-- - Turun dari berbayar ke Benih: tenggang 14 hari sejak langganan berbayar
--   berakhir (ended_at). Selama tenggang dipakai masa simpan paket berbayar
--   itu; setelahnya masa simpan Benih. Trial bukan langganan berbayar.
-- - Usaha yang ditangguhkan tetap dihapus sesuai jadwal paketnya.
-- - File dihapus lewat Storage API oleh job harian (route /api/cron/hapus-foto,
--   service role). Fungsi di sini hanya memilih kandidat dan menandai absen
--   yang fotonya sudah dihapus: photos_deleted_at diisi, path foto
--   dikosongkan. Jam, status, telat, dan lembur tidak berubah.
-- - Ringkasan tiap jalan (foto dihapus per usaha) di photo_cleanup_runs dan
--   photo_cleanup_run_companies. Isinya hanya angka, dibaca super admin lewat
--   RPC admin_photo_cleanup_*.
-- - Aman dijalankan ulang.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Masa simpan
-- -----------------------------------------------------------------------------

-- Masa simpan foto (hari) untuk satu usaha. null = tanpa batas.
create or replace function public.photo_retention_days(p_company_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_found      boolean;
  v_days       integer;
  v_grace      boolean;
  v_grace_days integer;
begin
  select true, f.limit_value into v_found, v_days
  from public.plan_features f
  where f.level = public.company_level(p_company_id) and f.feature_key = 'simpan_foto_hari';

  if v_found is null then
    raise exception 'Batas paket "simpan_foto_hari" belum diatur.';
  end if;
  if v_days is null then
    return null;
  end if;

  -- Langganan berbayar (bukan trial) yang berakhir kurang dari 14 hari lalu.
  select true, f.limit_value into v_grace, v_grace_days
  from public.subscriptions s
  join public.plans p on p.code = s.plan_code
  join public.plan_features f on f.level = p.level and f.feature_key = 'simpan_foto_hari'
  where s.company_id = p_company_id
    and s.status in ('canceled', 'expired')
    and s.trial_ends_at is null
    and p.level <> 'benih'
    and coalesce(s.ended_at, s.updated_at) > now() - interval '14 days'
  order by f.limit_value desc nulls first
  limit 1;

  if v_grace then
    if v_grace_days is null then
      return null;
    end if;
    return greatest(v_days, v_grace_days);
  end if;

  return v_days;
end;
$$;


-- -----------------------------------------------------------------------------
-- Kandidat dan penandaan
-- -----------------------------------------------------------------------------

-- Absen yang masih punya foto, dicari per usaha lalu per umur.
create index if not exists attendances_photo_pending_idx
  on public.attendances (company_id, (coalesce(clock_in_at, clock_out_at, created_at)))
  where photos_deleted_at is null
    and (clock_in_photo_path is not null or clock_out_photo_path is not null);

-- Absen yang fotonya sudah lewat masa simpan, paling lama dulu.
-- p_exclude = absen yang gagal dihapus di jalan yang sama (dicoba lagi besok).
create or replace function public.photo_cleanup_candidates(
  p_limit   integer,
  p_exclude uuid[] default '{}'
)
returns table (
  id                    uuid,
  company_id            uuid,
  clock_in_photo_path   text,
  clock_out_photo_path  text
)
language sql
stable
security definer
set search_path = ''
as $$
  with pending as (
    select distinct a.company_id
    from public.attendances a
    where a.photos_deleted_at is null
      and (a.clock_in_photo_path is not null or a.clock_out_photo_path is not null)
  ),
  retention as (
    select p.company_id, public.photo_retention_days(p.company_id) as days
    from pending p
  )
  select a.id, a.company_id, a.clock_in_photo_path, a.clock_out_photo_path
  from retention r
  join public.attendances a on a.company_id = r.company_id
  where r.days is not null
    and a.photos_deleted_at is null
    and (a.clock_in_photo_path is not null or a.clock_out_photo_path is not null)
    and coalesce(a.clock_in_at, a.clock_out_at, a.created_at) < now() - make_interval(days => r.days)
    and not (a.id = any (coalesce(p_exclude, '{}')))
  order by coalesce(a.clock_in_at, a.clock_out_at, a.created_at), a.id
  limit least(greatest(coalesce(p_limit, 200), 1), 1000);
$$;

-- Tandai absen yang filenya sudah dihapus dari storage. Idempoten: baris yang
-- sudah ditandai dilewati. Mengembalikan id yang benar-benar diubah.
create or replace function public.mark_photos_deleted(p_ids uuid[])
returns setof uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform set_config('semai.system_write', 'on', true);

  return query
  update public.attendances a
  set photos_deleted_at = now(), clock_in_photo_path = null, clock_out_photo_path = null
  where a.id = any (coalesce(p_ids, '{}'))
    and a.photos_deleted_at is null
  returning a.id;

  perform set_config('semai.system_write', 'off', true);
end;
$$;


-- -----------------------------------------------------------------------------
-- Ringkasan tiap jalan
-- -----------------------------------------------------------------------------

create table if not exists public.photo_cleanup_runs (
  id                   bigint generated always as identity primary key,
  started_at           timestamptz not null default now(),
  finished_at          timestamptz,
  status               text not null default 'berjalan'
                       check (status in ('berjalan', 'selesai', 'sebagian', 'gagal')),
  photos_deleted       integer not null default 0 check (photos_deleted >= 0),
  attendances_cleared  integer not null default 0 check (attendances_cleared >= 0),
  companies_count      integer not null default 0 check (companies_count >= 0),
  failed_count         integer not null default 0 check (failed_count >= 0),
  error                text
);

comment on table public.photo_cleanup_runs is
  'Satu baris per jalan job hapus foto absen. selesai = semua kandidat diproses, sebagian = waktu habis atau ada yang gagal (dilanjut besok).';

-- Hanya satu jalan pada satu waktu.
create unique index if not exists photo_cleanup_runs_one_running_idx
  on public.photo_cleanup_runs ((true)) where status = 'berjalan';

create index if not exists photo_cleanup_runs_started_idx
  on public.photo_cleanup_runs (started_at desc);

create table if not exists public.photo_cleanup_run_companies (
  run_id               bigint not null references public.photo_cleanup_runs (id) on delete cascade,
  company_id           uuid not null references public.companies (id) on delete cascade,
  photos_deleted       integer not null default 0 check (photos_deleted >= 0),
  attendances_cleared  integer not null default 0 check (attendances_cleared >= 0),
  failed_count         integer not null default 0 check (failed_count >= 0),
  primary key (run_id, company_id)
);

comment on table public.photo_cleanup_run_companies is
  'Jumlah foto absen yang dihapus per usaha di satu jalan job. Tanpa data pribadi.';

create index if not exists photo_cleanup_run_companies_company_idx
  on public.photo_cleanup_run_companies (company_id);

-- Ditulis hanya oleh service role; dibaca super admin lewat RPC.
alter table public.photo_cleanup_runs enable row level security;
alter table public.photo_cleanup_run_companies enable row level security;

revoke all on public.photo_cleanup_runs, public.photo_cleanup_run_companies from anon, authenticated;
grant select, insert, update, delete on public.photo_cleanup_runs, public.photo_cleanup_run_companies to service_role;


-- -----------------------------------------------------------------------------
-- Baca untuk super admin
-- -----------------------------------------------------------------------------

create or replace function public.admin_photo_cleanup_runs(p_limit integer default 30)
returns table (
  id                   bigint,
  started_at           timestamptz,
  finished_at          timestamptz,
  status               text,
  photos_deleted       integer,
  attendances_cleared  integer,
  companies_count      integer,
  failed_count         integer,
  error                text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_platform_admin();
  return query
  select r.id, r.started_at, r.finished_at, r.status, r.photos_deleted, r.attendances_cleared,
         r.companies_count, r.failed_count, r.error
  from public.photo_cleanup_runs r
  order by r.started_at desc, r.id desc
  limit least(greatest(coalesce(p_limit, 30), 1), 200);
end;
$$;

create or replace function public.admin_photo_cleanup_run_detail(p_run_id bigint)
returns table (
  company_id           uuid,
  company_name         text,
  photos_deleted       integer,
  attendances_cleared  integer,
  failed_count         integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_platform_admin();
  return query
  select rc.company_id, c.name, rc.photos_deleted, rc.attendances_cleared, rc.failed_count
  from public.photo_cleanup_run_companies rc
  join public.companies c on c.id = rc.company_id
  where rc.run_id = p_run_id
  order by rc.photos_deleted desc, c.name;
end;
$$;


-- -----------------------------------------------------------------------------
-- Hak akses fungsi
-- -----------------------------------------------------------------------------

revoke execute on function
  public.photo_retention_days(uuid),
  public.photo_cleanup_candidates(integer, uuid[]),
  public.mark_photos_deleted(uuid[]),
  public.admin_photo_cleanup_runs(integer),
  public.admin_photo_cleanup_run_detail(bigint)
from public, anon, authenticated;

-- Job harian (service role).
grant execute on function
  public.photo_retention_days(uuid),
  public.photo_cleanup_candidates(integer, uuid[]),
  public.mark_photos_deleted(uuid[])
to service_role;

-- Fungsi admin_* mengecek is_platform_admin() sendiri.
grant execute on function
  public.admin_photo_cleanup_runs(integer),
  public.admin_photo_cleanup_run_detail(bigint)
to authenticated;
