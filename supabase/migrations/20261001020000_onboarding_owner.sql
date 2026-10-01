-- =============================================================================
-- Semai · Onboarding owner (OWN-02)
--
-- Langkah 1–5 ditulis app langsung ke companies, locations, dan work_schedules
-- (dijaga RLS). Langkah terakhir memanggil complete_onboarding() yang:
-- - memastikan data wajib sudah lengkap,
-- - mengisi payroll_rules default sesuai bidang (nominal Rp0, nonaktif),
-- - memulai trial Plus 14 hari kalau dipilih,
-- - mengunci onboarding_completed_at.
-- Semua dalam satu transaksi, dan idempoten kalau dipanggil ulang.
-- =============================================================================

create function public.complete_onboarding(
  p_company_id  uuid,
  p_choice      text,            -- 'trial_plus' | 'berbayar' | 'benih'
  p_plan_code   text default null -- wajib untuk 'berbayar'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company     public.companies%rowtype;
  v_tier        text;
  v_plan_code   text;
  v_flags       text[] := '{}';
begin
  if auth.uid() is null then
    raise exception 'Belum masuk.' using errcode = '28000';
  end if;

  if not public.is_company_owner(p_company_id) then
    raise exception 'Hanya owner yang bisa menyelesaikan onboarding.' using errcode = '42501';
  end if;

  if p_choice is null or p_choice not in ('trial_plus', 'berbayar', 'benih') then
    raise exception 'Pilihan paket tidak dikenal.' using errcode = '22023';
  end if;

  select * into v_company from public.companies c where c.id = p_company_id for update;

  -- Sudah selesai sebelumnya (klik dobel, refresh): tidak ada yang diubah.
  if v_company.onboarding_completed_at is not null then
    return;
  end if;

  if v_company.name is null or v_company.business_type is null then
    raise exception 'Profil usaha belum lengkap. Isi langkah 1 dulu.' using errcode = 'P0001';
  end if;
  if v_company.employee_range is null then
    raise exception 'Jumlah karyawan belum diisi. Isi langkah 2 dulu.' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.work_schedules w where w.company_id = p_company_id and w.is_default
  ) then
    raise exception 'Jam kerja belum diatur. Isi langkah 3 dulu.' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.locations l where l.company_id = p_company_id and l.is_active
  ) then
    raise exception 'Lokasi absen belum dipilih. Isi langkah 4 dulu.' using errcode = 'P0001';
  end if;

  v_tier := case v_company.employee_range
    when '1-5'   then 'tunas'
    when '6-15'  then 'tumbuh'
    when '16-30' then 'berkembang'
    when '31-50' then 'rindang'
    else 'hutan'
  end;

  -- Aturan gaji default per bidang (PRD bagian 8). Nominal Rp0 dan nonaktif:
  -- owner mengisi nominal sendiri di menu gaji.
  if not exists (select 1 from public.payroll_rules r where r.company_id = p_company_id) then
    case v_company.business_type
      when 'kuliner' then
        insert into public.payroll_rules (company_id, kind, name, calc, amount, is_active) values
          (p_company_id, 'lembur',    'Lembur per jam',  'per_jam',        0, false),
          (p_company_id, 'tunjangan', 'Tunjangan makan', 'per_hari_hadir', 0, false);
      when 'bengkel' then
        insert into public.payroll_rules (company_id, kind, name, calc, amount, is_active) values
          (p_company_id, 'lembur',    'Lembur harian',   'per_kejadian',   0, false);
      when 'laundry' then
        insert into public.payroll_rules (company_id, kind, name, calc, amount, is_active) values
          (p_company_id, 'lembur',    'Lembur per jam',  'per_jam',        0, false);
      else
        null;
    end case;
  end if;

  -- Penanda untuk fitur yang belum ada datanya (komisi) atau butuh Plus (cuti).
  if v_company.business_type = 'salon' then
    v_flags := array_append(v_flags, 'komisi');
  elsif v_company.business_type = 'klinik' then
    v_flags := array_append(v_flags, 'cuti');
  end if;

  if p_choice = 'trial_plus' then
    v_plan_code := v_tier || '_plus';
    -- Trial hanya sekali per usaha.
    if not exists (select 1 from public.subscriptions s where s.company_id = p_company_id) then
      insert into public.subscriptions (company_id, plan_code, status, trial_ends_at, current_period_start, current_period_end)
      values (p_company_id, v_plan_code, 'trialing', now() + interval '14 days', now(), now() + interval '14 days');
    end if;
  elsif p_choice = 'berbayar' then
    select p.code into v_plan_code
    from public.plans p
    where p.code = p_plan_code and p.level <> 'benih' and p.is_active;
    if v_plan_code is null then
      raise exception 'Paket yang dipilih tidak tersedia. Pilih paket lain.' using errcode = '22023';
    end if;
    -- Pembayaran dikerjakan di langkah langganan; sementara usaha tetap di Benih.
  else
    v_plan_code := 'benih';
  end if;

  update public.companies c
  set onboarding = c.onboarding || jsonb_build_object(
        'step', 6,
        'plan_choice', p_choice,
        'plan_code', v_plan_code,
        'flags', to_jsonb(v_flags)
      ),
      onboarding_completed_at = now()
  where c.id = p_company_id;

  perform public.log_audit(
    p_company_id, 'owner', 'company.onboarding_complete', 'companies', p_company_id,
    'Onboarding selesai', null,
    jsonb_build_object('plan_choice', p_choice, 'plan_code', v_plan_code)
  );
end;
$$;

comment on function public.complete_onboarding(uuid, text, text) is
  'Selesaikan onboarding owner: cek data wajib, isi payroll_rules default, trial Plus opsional.';

revoke execute on function public.complete_onboarding(uuid, text, text) from public, anon;
grant execute on function public.complete_onboarding(uuid, text, text) to authenticated;
