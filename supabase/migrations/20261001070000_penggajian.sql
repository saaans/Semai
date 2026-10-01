-- =============================================================================
-- Semai · Penggajian dan slip (OWN-07 sampai OWN-10, EMP-05)
--
-- - Periode gajian = bulan kalender. Pratinjau dihitung ulang setiap dibuka
--   (lib/payroll), tidak disimpan sebagai draft, jadi tidak pernah basi.
-- - Kunci gajian lewat RPC lock_payroll_run dalam satu transaksi: buat
--   payroll_runs + payslips, kurangi saldo kasbon, catat audit_logs.
--   RPC memeriksa ulang angka yang bisa diperiksa di database: persamaan gaji
--   bersih, penyesuaian, dan cicilan kasbon.
-- - Hanya owner yang bisa mengatur gaji dan memproses gajian (admin di
--   paket Plus tidak, lihat OWN-17).
-- - Aturan gaji, gaji pokok, penyesuaian, dan kasbon diubah lewat RPC,
--   wajib alasan saat mengubah/menghapus, tercatat di audit_logs.
-- - Gaji harian (potongan proporsional) bisa dari hari kerja terjadwal atau
--   jumlah hari tetap per usaha.
-- - Slip menyimpan snapshot nama karyawan, profil usaha, dan watermark paket
--   saat dikunci, supaya slip lama tidak ikut berubah.
-- - Aman dijalankan ulang.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Kolom
-- -----------------------------------------------------------------------------

alter table public.companies
  add column if not exists payroll_day_basis  text not null default 'jadwal',
  add column if not exists payroll_fixed_days smallint not null default 26;

alter table public.companies drop constraint if exists companies_payroll_day_basis;
alter table public.companies add constraint companies_payroll_day_basis
  check (payroll_day_basis in ('jadwal', 'tetap'));
alter table public.companies drop constraint if exists companies_payroll_fixed_days;
alter table public.companies add constraint companies_payroll_fixed_days
  check (payroll_fixed_days between 20 and 31);

comment on column public.companies.payroll_day_basis is
  'Pembagi gaji harian: jadwal = hari kerja terjadwal di bulan itu, tetap = payroll_fixed_days.';

alter table public.payroll_runs
  add column if not exists company_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists watermark        boolean not null default true;

comment on column public.payroll_runs.company_snapshot is 'Nama, alamat, nomor WA, logo, zona waktu usaha saat dikunci.';
comment on column public.payroll_runs.watermark is 'Slip diberi watermark "Dibuat dengan Semai" (paket tanpa slip_tanpa_watermark saat dikunci).';

alter table public.payslips
  add column if not exists employee_name     text,
  add column if not exists employee_position text;


-- -----------------------------------------------------------------------------
-- Penyesuaian gaji per periode
-- -----------------------------------------------------------------------------

create table if not exists public.payroll_adjustments (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies (id) on delete cascade,
  employee_id   uuid not null,
  period_start  date not null check (extract(day from period_start) = 1),
  amount        bigint not null check (amount <> 0),          -- plus = tambahan, minus = potongan
  reason        text not null check (length(trim(reason)) between 5 and 300),
  created_by    uuid default auth.uid() references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  foreign key (employee_id, company_id)
    references public.employees (id, company_id) on delete restrict
);

comment on table public.payroll_adjustments is
  'Penyesuaian manual (+/-) untuk gajian satu bulan, misalnya koreksi dari periode yang sudah dikunci. Lewat RPC.';

create index if not exists payroll_adjustments_company_period_idx
  on public.payroll_adjustments (company_id, period_start);

alter table public.payroll_adjustments enable row level security;

revoke all on public.payroll_adjustments from anon, authenticated;
grant select on public.payroll_adjustments to authenticated;

drop policy if exists "Anggota melihat penyesuaian gaji" on public.payroll_adjustments;
create policy "Anggota melihat penyesuaian gaji" on public.payroll_adjustments
  for select to authenticated using (public.is_company_member(company_id));


-- -----------------------------------------------------------------------------
-- Kasbon: tulis hanya lewat RPC (audit)
-- -----------------------------------------------------------------------------

revoke insert, update on public.cash_advances from authenticated;
drop policy if exists "Anggota mencatat kasbon (Dasar)" on public.cash_advances;
drop policy if exists "Anggota mengubah catatan kasbon" on public.cash_advances;


-- -----------------------------------------------------------------------------
-- Helper
-- -----------------------------------------------------------------------------

-- Wajib owner usaha ini. Mengembalikan peran untuk audit_logs.
create or replace function public.require_payroll_owner(p_company_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role text := public.member_role(p_company_id);
begin
  if v_role is null then
    raise exception 'Kamu tidak punya akses ke usaha ini.'
      using errcode = '42501', hint = 'bukan_anggota';
  end if;
  if v_role <> 'owner' then
    raise exception 'Hanya pemilik usaha yang bisa mengatur gaji dan memproses gajian.'
      using errcode = '42501', hint = 'bukan_owner';
  end if;
  return v_role;
end;
$$;

-- Alasan wajib 5–300 huruf. Mengembalikan alasan yang sudah dirapikan.
create or replace function public.require_reason(p_reason text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_reason text := nullif(trim(p_reason), '');
begin
  if v_reason is null or length(v_reason) < 5 then
    raise exception 'Tulis alasan minimal 5 huruf, misalnya "Naik gaji setelah 1 tahun".'
      using errcode = 'P0001', hint = 'alasan_kosong';
  end if;
  if length(v_reason) > 300 then
    raise exception 'Alasan terlalu panjang. Maksimal 300 huruf.'
      using errcode = 'P0001', hint = 'alasan_panjang';
  end if;
  return v_reason;
end;
$$;

-- Bulan ini sudah dikunci untuk usaha ini.
create or replace function public.is_payroll_period_locked(p_company_id uuid, p_period_start date)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.payroll_runs r
    where r.company_id = p_company_id and r.period_start = p_period_start and r.status = 'dikunci'
  );
$$;


-- -----------------------------------------------------------------------------
-- Pengaturan gaji
-- -----------------------------------------------------------------------------

create or replace function public.update_payroll_settings(
  p_company_id  uuid,
  p_day_basis   text,
  p_fixed_days  integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role  text := public.require_payroll_owner(p_company_id);
  v_old   public.companies;
begin
  if p_day_basis is null or p_day_basis not in ('jadwal', 'tetap') then
    raise exception 'Pilih cara hitung gaji harian: hari kerja terjadwal atau jumlah hari tetap.'
      using errcode = 'P0001', hint = 'basis_tidak_valid';
  end if;
  if p_fixed_days is null or p_fixed_days not between 20 and 31 then
    raise exception 'Jumlah hari tetap harus antara 20 dan 31.'
      using errcode = 'P0001', hint = 'hari_tidak_valid';
  end if;

  select * into v_old from public.companies c where c.id = p_company_id for update;

  if v_old.payroll_day_basis = p_day_basis and v_old.payroll_fixed_days = p_fixed_days then
    return;
  end if;

  update public.companies c
  set payroll_day_basis = p_day_basis, payroll_fixed_days = p_fixed_days
  where c.id = p_company_id;

  perform public.log_audit(
    p_company_id, v_role, 'payroll.settings', 'companies', p_company_id, null,
    jsonb_build_object('payroll_day_basis', v_old.payroll_day_basis, 'payroll_fixed_days', v_old.payroll_fixed_days),
    jsonb_build_object('payroll_day_basis', p_day_basis, 'payroll_fixed_days', p_fixed_days)
  );
end;
$$;

-- Gaji pokok karyawan. Wajib alasan.
create or replace function public.set_base_salary(
  p_employee_id  uuid,
  p_amount       bigint,
  p_reason       text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_emp     public.employees;
  v_role    text;
  v_reason  text;
begin
  select * into v_emp from public.employees e where e.id = p_employee_id for update;
  if v_emp.id is null or public.member_role(v_emp.company_id) is null then
    raise exception 'Karyawan tidak ditemukan.'
      using errcode = 'P0001', hint = 'karyawan_tidak_ada';
  end if;
  v_role := public.require_payroll_owner(v_emp.company_id);

  if p_amount is null or p_amount < 0 or p_amount > 1000000000 then
    raise exception 'Gaji pokok harus antara Rp0 dan Rp1.000.000.000.'
      using errcode = 'P0001', hint = 'nominal_tidak_valid';
  end if;
  if p_amount = v_emp.base_salary then
    raise exception 'Gaji pokok tidak berubah.'
      using errcode = 'P0001', hint = 'tidak_berubah';
  end if;
  v_reason := public.require_reason(p_reason);

  update public.employees e set base_salary = p_amount where e.id = p_employee_id;

  perform public.log_audit(
    v_emp.company_id, v_role, 'payroll.base_salary', 'employees', p_employee_id, v_reason,
    jsonb_build_object('base_salary', v_emp.base_salary),
    jsonb_build_object('base_salary', p_amount)
  );
end;
$$;

-- Validasi kombinasi aturan gaji. Sama dengan lib/payroll/rules.ts.
create or replace function public.validate_payroll_rule(
  p_kind           text,
  p_calc           text,
  p_amount         bigint,
  p_trigger_event  text
)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_kind = 'tunjangan' then
    if p_calc not in ('tetap_bulanan', 'per_hari_hadir') or p_trigger_event is not null then
      raise exception 'Tunjangan dihitung per bulan atau per hari hadir.'
        using errcode = 'P0001', hint = 'aturan_tidak_valid';
    end if;
  elsif p_kind = 'lembur' then
    if p_calc not in ('per_jam', 'per_kejadian') or p_trigger_event is not null then
      raise exception 'Lembur dihitung per jam atau per hari lembur.'
        using errcode = 'P0001', hint = 'aturan_tidak_valid';
    end if;
  elsif p_kind = 'potongan' then
    if p_trigger_event is null or p_trigger_event not in ('telat', 'pulang_cepat', 'alpa') then
      raise exception 'Pilih potongan untuk telat, pulang cepat, atau tidak masuk.'
        using errcode = 'P0001', hint = 'aturan_tidak_valid';
    end if;
    if p_calc not in ('per_menit', 'per_kejadian', 'proporsional_gaji_harian')
       or (p_calc = 'per_menit' and p_trigger_event = 'alpa') then
      raise exception 'Cara hitung potongan tidak cocok. Tidak masuk dipotong per hari atau proporsional gaji harian.'
        using errcode = 'P0001', hint = 'aturan_tidak_valid';
    end if;
  else
    raise exception 'Jenis aturan gaji tidak dikenal.'
      using errcode = 'P0001', hint = 'aturan_tidak_valid';
  end if;

  if p_calc = 'proporsional_gaji_harian' then
    if p_amount is not null then
      raise exception 'Potongan proporsional tidak memakai nominal.'
        using errcode = 'P0001', hint = 'aturan_tidak_valid';
    end if;
  elsif p_amount is null or p_amount < 0 or p_amount > 100000000 then
    raise exception 'Isi nominal antara Rp0 dan Rp100.000.000.'
      using errcode = 'P0001', hint = 'nominal_tidak_valid';
  end if;
end;
$$;

-- Tambah (p_rule_id null) atau ubah aturan gaji. Mengubah wajib alasan.
create or replace function public.save_payroll_rule(
  p_company_id     uuid,
  p_rule_id        uuid,
  p_employee_id    uuid,
  p_kind           text,
  p_name           text,
  p_calc           text,
  p_amount         bigint,
  p_trigger_event  text,
  p_is_active      boolean,
  p_reason         text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role    text := public.require_payroll_owner(p_company_id);
  v_name    text := nullif(trim(p_name), '');
  v_old     public.payroll_rules;
  v_new     public.payroll_rules;
  v_reason  text;
begin
  if v_name is null or length(v_name) > 60 then
    raise exception 'Isi nama komponen, maksimal 60 huruf. Contoh: "Uang makan".'
      using errcode = 'P0001', hint = 'nama_kosong';
  end if;
  perform public.validate_payroll_rule(p_kind, p_calc, p_amount, p_trigger_event);

  if p_employee_id is not null and not exists (
    select 1 from public.employees e where e.id = p_employee_id and e.company_id = p_company_id
  ) then
    raise exception 'Karyawan tidak ditemukan.'
      using errcode = 'P0001', hint = 'karyawan_tidak_ada';
  end if;

  if p_rule_id is null then
    insert into public.payroll_rules (company_id, employee_id, kind, name, calc, amount, trigger_event, is_active)
    values (p_company_id, p_employee_id, p_kind, v_name, p_calc, p_amount, p_trigger_event, coalesce(p_is_active, true))
    returning * into v_new;

    perform public.log_audit(
      p_company_id, v_role, 'payroll.rule_create', 'payroll_rules', v_new.id, nullif(trim(p_reason), ''),
      null, to_jsonb(v_new) - '{created_at,updated_at}'::text[]
    );
    return v_new.id;
  end if;

  select * into v_old from public.payroll_rules r
  where r.id = p_rule_id and r.company_id = p_company_id
  for update;
  if v_old.id is null then
    raise exception 'Aturan gaji tidak ditemukan. Muat ulang halaman.'
      using errcode = 'P0001', hint = 'aturan_tidak_ada';
  end if;
  v_reason := public.require_reason(p_reason);

  update public.payroll_rules r
  set employee_id = p_employee_id, kind = p_kind, name = v_name, calc = p_calc,
      amount = p_amount, trigger_event = p_trigger_event, is_active = coalesce(p_is_active, true)
  where r.id = p_rule_id
  returning * into v_new;

  perform public.log_audit(
    p_company_id, v_role, 'payroll.rule_update', 'payroll_rules', p_rule_id, v_reason,
    to_jsonb(v_old) - '{created_at,updated_at}'::text[],
    to_jsonb(v_new) - '{created_at,updated_at}'::text[]
  );
  return p_rule_id;
end;
$$;

create or replace function public.delete_payroll_rule(p_rule_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old     public.payroll_rules;
  v_role    text;
  v_reason  text;
begin
  select * into v_old from public.payroll_rules r where r.id = p_rule_id for update;
  if v_old.id is null or public.member_role(v_old.company_id) is null then
    raise exception 'Aturan gaji tidak ditemukan. Muat ulang halaman.'
      using errcode = 'P0001', hint = 'aturan_tidak_ada';
  end if;
  v_role := public.require_payroll_owner(v_old.company_id);
  v_reason := public.require_reason(p_reason);

  delete from public.payroll_rules r where r.id = p_rule_id;

  perform public.log_audit(
    v_old.company_id, v_role, 'payroll.rule_delete', 'payroll_rules', p_rule_id, v_reason,
    to_jsonb(v_old) - '{created_at,updated_at}'::text[], null
  );
end;
$$;


-- -----------------------------------------------------------------------------
-- Penyesuaian
-- -----------------------------------------------------------------------------

create or replace function public.add_payroll_adjustment(
  p_company_id    uuid,
  p_employee_id   uuid,
  p_period_start  date,
  p_amount        bigint,
  p_reason        text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role    text := public.require_payroll_owner(p_company_id);
  v_reason  text := public.require_reason(p_reason);
  v_new     public.payroll_adjustments;
begin
  if p_period_start is null or extract(day from p_period_start) <> 1 then
    raise exception 'Periode gajian tidak valid. Muat ulang halaman.'
      using errcode = 'P0001', hint = 'periode_tidak_valid';
  end if;
  if public.is_payroll_period_locked(p_company_id, p_period_start) then
    raise exception 'Gajian bulan ini sudah dikunci. Tambahkan penyesuaian di gajian bulan berikutnya.'
      using errcode = 'P0001', hint = 'gajian_dikunci';
  end if;
  if p_amount is null or p_amount = 0 or abs(p_amount) > 100000000 then
    raise exception 'Isi nominal penyesuaian, maksimal Rp100.000.000.'
      using errcode = 'P0001', hint = 'nominal_tidak_valid';
  end if;
  if not exists (
    select 1 from public.employees e
    where e.id = p_employee_id and e.company_id = p_company_id and e.status <> 'diundang'
  ) then
    raise exception 'Karyawan tidak ditemukan atau belum aktivasi.'
      using errcode = 'P0001', hint = 'karyawan_tidak_ada';
  end if;

  insert into public.payroll_adjustments (company_id, employee_id, period_start, amount, reason)
  values (p_company_id, p_employee_id, p_period_start, p_amount, v_reason)
  returning * into v_new;

  perform public.log_audit(
    p_company_id, v_role, 'payroll.adjustment_add', 'payroll_adjustments', v_new.id, v_reason,
    null, jsonb_build_object('employee_id', p_employee_id, 'period_start', p_period_start, 'amount', p_amount)
  );
  return v_new.id;
end;
$$;

create or replace function public.delete_payroll_adjustment(p_adjustment_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old   public.payroll_adjustments;
  v_role  text;
begin
  select * into v_old from public.payroll_adjustments a where a.id = p_adjustment_id for update;
  if v_old.id is null or public.member_role(v_old.company_id) is null then
    raise exception 'Penyesuaian tidak ditemukan. Muat ulang halaman.'
      using errcode = 'P0001', hint = 'penyesuaian_tidak_ada';
  end if;
  v_role := public.require_payroll_owner(v_old.company_id);
  if public.is_payroll_period_locked(v_old.company_id, v_old.period_start) then
    raise exception 'Gajian bulan ini sudah dikunci, penyesuaian tidak bisa dihapus.'
      using errcode = 'P0001', hint = 'gajian_dikunci';
  end if;

  delete from public.payroll_adjustments a where a.id = p_adjustment_id;

  perform public.log_audit(
    v_old.company_id, v_role, 'payroll.adjustment_delete', 'payroll_adjustments', p_adjustment_id, v_old.reason,
    jsonb_build_object('employee_id', v_old.employee_id, 'period_start', v_old.period_start, 'amount', v_old.amount),
    null
  );
end;
$$;


-- -----------------------------------------------------------------------------
-- Kasbon (fitur kasbon, Dasar ke atas)
-- -----------------------------------------------------------------------------

create or replace function public.add_cash_advance(
  p_company_id   uuid,
  p_employee_id  uuid,
  p_amount       bigint,
  p_installment  bigint,
  p_given_on     date,
  p_note         text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role  text := public.require_payroll_owner(p_company_id);
  v_tz    text;
  v_note  text := nullif(trim(p_note), '');
  v_new   public.cash_advances;
begin
  if not public.has_feature(p_company_id, 'kasbon') then
    raise exception 'Kasbon tersedia mulai paket Dasar.'
      using errcode = 'P0001', hint = 'fitur_terkunci';
  end if;
  if not exists (
    select 1 from public.employees e
    where e.id = p_employee_id and e.company_id = p_company_id and e.status = 'aktif'
  ) then
    raise exception 'Karyawan tidak ditemukan atau tidak aktif.'
      using errcode = 'P0001', hint = 'karyawan_tidak_ada';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount > 100000000 then
    raise exception 'Isi nominal kasbon antara Rp1 dan Rp100.000.000.'
      using errcode = 'P0001', hint = 'nominal_tidak_valid';
  end if;
  if p_installment is null or p_installment <= 0 or p_installment > p_amount then
    raise exception 'Cicilan per gajian harus lebih dari Rp0 dan tidak lebih besar dari nominal kasbon.'
      using errcode = 'P0001', hint = 'cicilan_tidak_valid';
  end if;
  if v_note is not null and length(v_note) > 200 then
    raise exception 'Catatan terlalu panjang. Maksimal 200 huruf.'
      using errcode = 'P0001', hint = 'catatan_panjang';
  end if;

  select c.timezone into v_tz from public.companies c where c.id = p_company_id;
  if p_given_on is null or p_given_on > (now() at time zone v_tz)::date then
    raise exception 'Tanggal kasbon belum terjadi. Pilih hari ini atau tanggal sebelumnya.'
      using errcode = 'P0001', hint = 'tanggal_depan';
  end if;

  insert into public.cash_advances (company_id, employee_id, amount, installment_amount, given_on, note)
  values (p_company_id, p_employee_id, p_amount, p_installment, p_given_on, v_note)
  returning * into v_new;

  perform public.log_audit(
    p_company_id, v_role, 'cash_advance.create', 'cash_advances', v_new.id, v_note,
    null, jsonb_build_object('employee_id', p_employee_id, 'amount', p_amount, 'installment_amount', p_installment, 'given_on', p_given_on)
  );
  return v_new.id;
end;
$$;

create or replace function public.cancel_cash_advance(p_cash_advance_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old     public.cash_advances;
  v_role    text;
  v_reason  text;
begin
  select * into v_old from public.cash_advances a where a.id = p_cash_advance_id for update;
  if v_old.id is null or public.member_role(v_old.company_id) is null then
    raise exception 'Kasbon tidak ditemukan. Muat ulang halaman.'
      using errcode = 'P0001', hint = 'kasbon_tidak_ada';
  end if;
  v_role := public.require_payroll_owner(v_old.company_id);
  v_reason := public.require_reason(p_reason);
  if v_old.status <> 'aktif' then
    raise exception 'Kasbon ini sudah lunas atau dibatalkan.'
      using errcode = 'P0001', hint = 'kasbon_selesai';
  end if;

  update public.cash_advances a set status = 'dibatalkan' where a.id = p_cash_advance_id;

  perform public.log_audit(
    v_old.company_id, v_role, 'cash_advance.cancel', 'cash_advances', p_cash_advance_id, v_reason,
    jsonb_build_object('status', v_old.status, 'balance', v_old.balance),
    jsonb_build_object('status', 'dibatalkan', 'balance', v_old.balance)
  );
end;
$$;


-- -----------------------------------------------------------------------------
-- Kunci gajian
-- -----------------------------------------------------------------------------

-- p_slips: array slip hasil lib/payroll, satu per karyawan:
-- { employee_id, base_salary, total_allowances, total_overtime,
--   total_deductions, cash_advance_deduction, adjustment, net_pay,
--   lines: [...], attendance_summary: {...},
--   cash_advances: [{ id, amount }] }
create or replace function public.lock_payroll_run(
  p_company_id    uuid,
  p_period_start  date,
  p_slips         jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role        text := public.require_payroll_owner(p_company_id);
  v_company     public.companies;
  v_period_end  date;
  v_run_id      uuid;
  v_slip        jsonb;
  v_adv         jsonb;
  v_emp         public.employees;
  v_cash        public.cash_advances;
  v_seen        uuid[] := '{}';
  v_base        bigint;
  v_allow       bigint;
  v_ot          bigint;
  v_ded         bigint;
  v_kasbon      bigint;
  v_adj         bigint;
  v_net         bigint;
  v_adv_total   bigint;
  v_adv_amount  bigint;
  v_expected    bigint;
  v_gross       bigint := 0;
  v_deductions  bigint := 0;
  v_total_net   bigint := 0;
begin
  if p_period_start is null or extract(day from p_period_start) <> 1 then
    raise exception 'Periode gajian tidak valid. Muat ulang halaman.'
      using errcode = 'P0001', hint = 'periode_tidak_valid';
  end if;
  v_period_end := (p_period_start + interval '1 month' - interval '1 day')::date;

  select * into v_company from public.companies c where c.id = p_company_id;
  if p_period_start > (now() at time zone v_company.timezone)::date then
    raise exception 'Bulan ini belum dimulai. Gajian hanya bisa diproses untuk bulan berjalan atau sebelumnya.'
      using errcode = 'P0001', hint = 'periode_depan';
  end if;

  -- Kunci per usaha + periode supaya dua klik bersamaan tidak membuat dua gajian.
  perform pg_advisory_xact_lock(hashtextextended(p_company_id::text || p_period_start::text, 0));

  if public.is_payroll_period_locked(p_company_id, p_period_start) then
    raise exception 'Gajian bulan ini sudah dikunci.'
      using errcode = 'P0001', hint = 'gajian_dikunci';
  end if;
  if exists (
    select 1 from public.payroll_runs r
    where r.company_id = p_company_id and r.status = 'dikunci'
      and r.period_start <= v_period_end and r.period_end >= p_period_start
  ) then
    raise exception 'Ada gajian terkunci yang tumpang tindih dengan bulan ini.'
      using errcode = 'P0001', hint = 'periode_tumpang_tindih';
  end if;

  if p_slips is null or jsonb_typeof(p_slips) <> 'array' or jsonb_array_length(p_slips) = 0 then
    raise exception 'Belum ada karyawan untuk digaji bulan ini.'
      using errcode = 'P0001', hint = 'slip_kosong';
  end if;

  -- Draft lama (kalau ada) diganti.
  delete from public.payroll_runs r
  where r.company_id = p_company_id and r.period_start = p_period_start and r.status = 'draft';

  insert into public.payroll_runs (company_id, period_start, period_end, status, created_by, company_snapshot, watermark)
  values (
    p_company_id, p_period_start, v_period_end, 'draft', auth.uid(),
    jsonb_build_object(
      'name', v_company.name, 'address', v_company.address, 'phone', v_company.phone,
      'logo_path', v_company.logo_path, 'timezone', v_company.timezone
    ),
    not public.has_feature(p_company_id, 'slip_tanpa_watermark')
  )
  returning id into v_run_id;

  for v_slip in select * from jsonb_array_elements(p_slips) loop
    select * into v_emp from public.employees e
    where e.id = (v_slip ->> 'employee_id')::uuid and e.company_id = p_company_id and e.status <> 'diundang';
    if v_emp.id is null then
      raise exception 'Ada karyawan yang tidak dikenal di gajian ini. Muat ulang halaman.'
        using errcode = 'P0001', hint = 'karyawan_tidak_ada';
    end if;
    if v_emp.id = any (v_seen) then
      raise exception 'Karyawan % muncul dua kali di gajian ini.', v_emp.full_name
        using errcode = 'P0001', hint = 'karyawan_ganda';
    end if;
    v_seen := array_append(v_seen, v_emp.id);

    v_base   := (v_slip ->> 'base_salary')::bigint;
    v_allow  := (v_slip ->> 'total_allowances')::bigint;
    v_ot     := (v_slip ->> 'total_overtime')::bigint;
    v_ded    := (v_slip ->> 'total_deductions')::bigint;
    v_kasbon := (v_slip ->> 'cash_advance_deduction')::bigint;
    v_adj    := (v_slip ->> 'adjustment')::bigint;
    v_net    := (v_slip ->> 'net_pay')::bigint;

    if v_base is null or v_allow is null or v_ot is null or v_ded is null or v_kasbon is null
       or v_adj is null or v_net is null
       or v_base < 0 or v_allow < 0 or v_ot < 0 or v_ded < 0 or v_kasbon < 0 or v_net < 0 then
      raise exception 'Angka gaji % tidak valid. Muat ulang halaman.', v_emp.full_name
        using errcode = 'P0001', hint = 'angka_tidak_valid';
    end if;
    if v_base + v_allow + v_ot + v_adj - v_ded - v_kasbon <> v_net then
      raise exception 'Hitungan gaji bersih % tidak cocok. Muat ulang halaman.', v_emp.full_name
        using errcode = 'P0001', hint = 'angka_tidak_cocok';
    end if;

    select coalesce(sum(a.amount), 0) into v_expected from public.payroll_adjustments a
    where a.company_id = p_company_id and a.employee_id = v_emp.id and a.period_start = p_period_start;
    if v_adj <> v_expected then
      raise exception 'Penyesuaian % berubah. Muat ulang halaman untuk melihat angka terbaru.', v_emp.full_name
        using errcode = 'P0001', hint = 'angka_tidak_cocok';
    end if;

    -- Cicilan kasbon: tiap kasbon aktif milik karyawan ini, tidak melebihi cicilan dan sisa.
    v_adv_total := 0;
    for v_adv in select * from jsonb_array_elements(coalesce(v_slip -> 'cash_advances', '[]'::jsonb)) loop
      v_adv_amount := (v_adv ->> 'amount')::bigint;
      select * into v_cash from public.cash_advances a
      where a.id = (v_adv ->> 'id')::uuid and a.company_id = p_company_id and a.employee_id = v_emp.id
      for update;
      if v_cash.id is null or v_cash.status <> 'aktif' or v_cash.given_on > v_period_end then
        raise exception 'Kasbon % sudah berubah. Muat ulang halaman.', v_emp.full_name
          using errcode = 'P0001', hint = 'angka_tidak_cocok';
      end if;
      if v_adv_amount is null or v_adv_amount <= 0
         or v_adv_amount > least(v_cash.installment_amount, v_cash.balance) then
        raise exception 'Cicilan kasbon % tidak valid. Muat ulang halaman.', v_emp.full_name
          using errcode = 'P0001', hint = 'angka_tidak_cocok';
      end if;

      update public.cash_advances a
      set balance = a.balance - v_adv_amount,
          status = case when a.balance - v_adv_amount = 0 then 'lunas' else a.status end
      where a.id = v_cash.id;

      v_adv_total := v_adv_total + v_adv_amount;
    end loop;
    if v_adv_total <> v_kasbon then
      raise exception 'Total cicilan kasbon % tidak cocok. Muat ulang halaman.', v_emp.full_name
        using errcode = 'P0001', hint = 'angka_tidak_cocok';
    end if;

    insert into public.payslips (
      company_id, payroll_run_id, employee_id, employee_name, employee_position,
      base_salary, total_allowances, total_overtime, total_deductions,
      cash_advance_deduction, adjustment, net_pay, lines, attendance_summary
    )
    values (
      p_company_id, v_run_id, v_emp.id, v_emp.full_name, v_emp.position,
      v_base, v_allow, v_ot, v_ded,
      v_kasbon, v_adj, v_net,
      coalesce(v_slip -> 'lines', '[]'::jsonb),
      coalesce(v_slip -> 'attendance_summary', '{}'::jsonb)
    );

    v_gross := v_gross + v_base + v_allow + v_ot + greatest(v_adj, 0);
    v_deductions := v_deductions + v_ded + v_kasbon + greatest(-v_adj, 0);
    v_total_net := v_total_net + v_net;
  end loop;

  -- Semua penyesuaian bulan ini harus ikut ke slip.
  if exists (
    select 1 from public.payroll_adjustments a
    where a.company_id = p_company_id and a.period_start = p_period_start
      and not (a.employee_id = any (v_seen))
  ) then
    raise exception 'Ada penyesuaian untuk karyawan yang tidak ikut gajian ini. Hapus penyesuaiannya atau muat ulang halaman.'
      using errcode = 'P0001', hint = 'penyesuaian_tertinggal';
  end if;

  update public.payroll_runs r
  set status = 'dikunci', locked_at = now(), locked_by = auth.uid(),
      employee_count = cardinality(v_seen),
      total_gross = v_gross, total_deductions = v_deductions, total_net = v_total_net
  where r.id = v_run_id;

  perform public.log_audit(
    p_company_id, v_role, 'payroll.lock', 'payroll_runs', v_run_id, null,
    null,
    jsonb_build_object(
      'period_start', p_period_start, 'period_end', v_period_end,
      'employee_count', cardinality(v_seen), 'total_net', v_total_net
    )
  );

  return v_run_id;
end;
$$;

-- Tandai slip sudah dikirim lewat WA (wa.me). Boleh di gajian terkunci.
create or replace function public.mark_payslip_wa_sent(p_payslip_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company_id uuid;
begin
  select s.company_id into v_company_id from public.payslips s where s.id = p_payslip_id;
  if v_company_id is null or public.member_role(v_company_id) is null then
    raise exception 'Slip gaji tidak ditemukan.'
      using errcode = 'P0001', hint = 'slip_tidak_ada';
  end if;
  perform public.require_payroll_owner(v_company_id);

  update public.payslips s set wa_sent_at = now() where s.id = p_payslip_id;
end;
$$;

-- Data periode + profil usaha untuk satu slip. Karyawan tidak bisa membaca
-- payroll_runs, jadi slip miliknya (yang sudah dikunci) dibaca lewat sini.
create or replace function public.get_payslip_run(p_payslip_id uuid)
returns table (
  period_start      date,
  period_end        date,
  locked_at         timestamptz,
  company_snapshot  jsonb,
  watermark         boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.period_start, r.period_end, r.locked_at, r.company_snapshot, r.watermark
  from public.payslips s
  join public.payroll_runs r on r.id = s.payroll_run_id
  where s.id = p_payslip_id
    and r.status = 'dikunci'
    and (
      public.is_company_member(s.company_id)
      or s.employee_id in (select public.my_employee_ids())
    );
$$;


-- Slip terkunci milik karyawan yang login, terbaru dulu (untuk /app/slip).
create or replace function public.list_my_payslips(p_company_id uuid)
returns table (
  id            uuid,
  period_start  date,
  period_end    date,
  net_pay       bigint,
  locked_at     timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, r.period_start, r.period_end, s.net_pay, r.locked_at
  from public.payslips s
  join public.payroll_runs r on r.id = s.payroll_run_id
  where s.company_id = p_company_id
    and r.status = 'dikunci'
    and s.employee_id in (select public.my_employee_ids())
  order by r.period_start desc;
$$;


-- -----------------------------------------------------------------------------
-- Hak akses fungsi
-- -----------------------------------------------------------------------------

revoke execute on function
  public.require_payroll_owner(uuid),
  public.require_reason(text),
  public.is_payroll_period_locked(uuid, date),
  public.validate_payroll_rule(text, text, bigint, text),
  public.update_payroll_settings(uuid, text, integer),
  public.set_base_salary(uuid, bigint, text),
  public.save_payroll_rule(uuid, uuid, uuid, text, text, text, bigint, text, boolean, text),
  public.delete_payroll_rule(uuid, text),
  public.add_payroll_adjustment(uuid, uuid, date, bigint, text),
  public.delete_payroll_adjustment(uuid),
  public.add_cash_advance(uuid, uuid, bigint, bigint, date, text),
  public.cancel_cash_advance(uuid, text),
  public.lock_payroll_run(uuid, date, jsonb),
  public.mark_payslip_wa_sent(uuid),
  public.get_payslip_run(uuid),
  public.list_my_payslips(uuid)
from public, anon, authenticated;

grant execute on function
  public.update_payroll_settings(uuid, text, integer),
  public.set_base_salary(uuid, bigint, text),
  public.save_payroll_rule(uuid, uuid, uuid, text, text, text, bigint, text, boolean, text),
  public.delete_payroll_rule(uuid, text),
  public.add_payroll_adjustment(uuid, uuid, date, bigint, text),
  public.delete_payroll_adjustment(uuid),
  public.add_cash_advance(uuid, uuid, bigint, bigint, date, text),
  public.cancel_cash_advance(uuid, text),
  public.lock_payroll_run(uuid, date, jsonb),
  public.mark_payslip_wa_sent(uuid),
  public.get_payslip_run(uuid),
  public.list_my_payslips(uuid)
to authenticated;
