-- =============================================================================
-- Semai · Satu harga per paket
--
-- Keputusan baru (menggantikan pilihan Dasar/Plus per paket):
--   Benih       1–5    Gratis (tetap)
--   Tunas       2–5    Rp39.000/bulan
--   Tumbuh      6–15   Rp69.000/bulan
--   Berkembang  16–30  Rp129.000/bulan
--   Rindang     31–50  Rp199.000/bulan
--   Hutan       51+    Hubungi kami
-- Semua paket berbayar membuka semua fitur. Tahunan = 10 x bulanan.
--
-- - Paket berbayar memakai baris {tier}_plus (level plus = semua fitur), jadi
--   trial, has_feature(), dan plan_features tidak berubah.
-- - Baris {tier}_dasar dinonaktifkan (tidak dihapus, dirujuk langganan lama).
-- - Langganan berjalan di {tier}_dasar dipindah ke {tier}_plus, tercatat di
--   audit_logs.
-- - Aman dijalankan ulang.
-- =============================================================================

update public.plans p
set name = v.name, price_monthly = v.monthly, price_yearly = v.monthly * 10
from (values
  ('tunas_plus',      'Tunas',      39000::bigint),
  ('tumbuh_plus',     'Tumbuh',     69000::bigint),
  ('berkembang_plus', 'Berkembang', 129000::bigint),
  ('rindang_plus',    'Rindang',    199000::bigint)
) as v (code, name, monthly)
where p.code = v.code;

update public.plans p set name = 'Hutan' where p.code = 'hutan_plus';

update public.plans p set is_active = false where p.level = 'dasar' and p.is_active;

-- Langganan berjalan di paket Dasar lama pindah ke paket berbayar tier yang sama.
do $$
declare
  v_sub public.subscriptions;
  v_new text;
begin
  perform set_config('semai.system_write', 'on', true);
  for v_sub in
    select s.* from public.subscriptions s
    join public.plans p on p.code = s.plan_code
    where p.level = 'dasar' and s.status in ('trialing', 'active', 'past_due')
  loop
    v_new := replace(v_sub.plan_code, '_dasar', '_plus');
    update public.subscriptions s set plan_code = v_new where s.id = v_sub.id;
    perform public.log_audit(
      v_sub.company_id, 'system', 'subscription.plan_migrated', 'subscriptions', v_sub.id,
      'Satu harga per paket: Dasar digabung ke paket berbayar',
      jsonb_build_object('plan_code', v_sub.plan_code),
      jsonb_build_object('plan_code', v_new)
    );
  end loop;
  perform set_config('semai.system_write', 'off', true);
end;
$$;


-- -----------------------------------------------------------------------------
-- Pesan error yang masih menyebut Dasar/Plus. Definisi fungsi diambil dari
-- database lalu hanya teks pesannya yang diganti, supaya isi fungsi lain
-- tidak ikut berubah.
-- -----------------------------------------------------------------------------

do $$
declare
  v_fix record;
  v_def text;
begin
  for v_fix in
    select * from (values
      ('public.add_cash_advance(uuid, uuid, bigint, bigint, date, text)',
       'Kasbon tersedia mulai paket Dasar.',
       'Kasbon tersedia di paket berbayar. Upgrade di menu Paket.'),
      ('public.set_employee_remote(uuid, boolean)',
       'Absen remote hanya untuk paket Dasar dan Plus.',
       'Absen remote hanya untuk paket berbayar.'),
      ('public.start_trial_plus(uuid)',
       'Trial Plus hanya bisa dipakai sekali per usaha.',
       'Trial gratis hanya bisa dipakai sekali per usaha.'),
      ('public.start_trial_plus(uuid)',
       'Paket Plus belum tersedia.',
       'Paket berbayar belum tersedia.')
    ) as t (fn, old_text, new_text)
  loop
    v_def := pg_get_functiondef(v_fix.fn::regprocedure);
    if position(v_fix.old_text in v_def) > 0 then
      execute replace(v_def, v_fix.old_text, v_fix.new_text);
    end if;
  end loop;
end;
$$;
