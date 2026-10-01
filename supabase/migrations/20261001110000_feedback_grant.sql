-- =============================================================================
-- Semai · Perbaikan hak akses tabel feedbacks
--
-- Supabase memberi anon/authenticated akses penuh ke tabel baru (default
-- privileges), jadi grant per kolom di migration feedback tidak berlaku.
-- Cabut dulu, lalu beri yang diperlukan saja:
-- - owner hanya mengisi kategori, isi, dan halaman (status/prioritas default),
-- - super admin hanya mengubah status dan prioritas (dibatasi RLS).
-- Aman dijalankan ulang.
-- =============================================================================

revoke all on public.feedbacks from anon, authenticated;

grant select on public.feedbacks to authenticated;
grant insert (company_id, category, message, page_path) on public.feedbacks to authenticated;
grant update (status, priority) on public.feedbacks to authenticated;
