# Semai

Aplikasi absensi dan penggajian untuk usaha kecil di Indonesia (2–50 karyawan): resto, kafe, toko, klinik, salon, bengkel, laundry. PRD lengkap ada di `docs/PRD.md`. Baca bagian yang relevan sebelum mengerjakan fitur.

## Cara kerja di repo ini

- Kerjakan **satu fitur per sesi**. Jangan ubah file di luar lingkup tugas.
- Untuk fitur besar, **jelaskan rencana dulu** (file yang dibuat/diubah, tabel, alur) dan tunggu persetujuan sebelum menulis kode.
- Setelah selesai: jalankan `npm run lint` dan `npm run build`, perbaiki error, lalu ringkas apa yang berubah dan cara mengetesnya di HP.
- Jangan pernah menaruh API key, password, atau secret di kode. Semua lewat `.env.local` (tidak di-commit). Update `.env.example` kalau ada variabel baru.
- Kalau ragu soal aturan bisnis, tanya. Jangan menebak.

## Stack

- **Next.js** (App Router) + **TypeScript** strict
- **Tailwind CSS** dengan design tokens di bawah
- **Supabase**: Postgres, Auth, Storage, Row Level Security, Edge Functions. Client pakai `@supabase/ssr`
- **PWA** untuk area karyawan: `manifest.webmanifest` + service worker, bisa dipasang ke layar utama, Web Push untuk reminder
- **Peta**: Leaflet + OpenStreetMap (gratis, tanpa API key)
- **Slip gaji PDF**: `@react-pdf/renderer` di server
- **Kompres foto**: di browser sebelum upload (target ±50 KB)
- **Validasi**: Zod di form dan di server action
- **Pembayaran langganan**: Midtrans atau Xendit (fase akhir MVP)
- **WhatsApp otomatis**: Meta WhatsApp Cloud API, **hanya paket Plus**, bukan bagian MVP

## Struktur

```
app/
  (marketing)/          landing, harga
  (auth)/               daftar, masuk, verifikasi
  owner/                dashboard pemilik usaha
    onboarding/
  app/                  PWA karyawan (mobile-first)
  admin/                super admin (tim Semai)
components/
  ui/                   tombol, input, kartu, tabel
lib/
  supabase/             client server/browser, types hasil generate
  plans.ts              helper fitur per paket
  payroll/              perhitungan gaji (fungsi murni + test)
supabase/
  migrations/           semua perubahan skema lewat migration SQL
docs/
  PRD.md
  PROMPTS.md
```

## Tiga peran

| Peran | Area | Login |
|---|---|---|
| Owner (+ admin di Plus) | `/owner` | Google atau email + password |
| Karyawan | `/app` | Nomor HP + PIN 6 digit |
| Super admin | `/admin` | Email tim Semai, flag `is_platform_admin` |

**Login karyawan tanpa OTP** (OTP via SMS/WA berbayar). Karyawan aktivasi lewat link undangan dari owner, lalu buat PIN. Implementasi: buat user Supabase Auth dengan email sintetis `{nomor_hp}@karyawan.semai.internal` dan PIN sebagai password. Batasi percobaan login (5 kali, lalu kunci 15 menit). Owner bisa reset PIN dari dashboard.

## Aturan data yang tidak boleh dilanggar

1. **Multi-tenant**: setiap tabel data usaha punya `company_id` dan **RLS aktif**. Owner A tidak boleh bisa membaca atau menulis data owner B. Setiap fitur baru wajib menyertakan RLS policy dan dicek dengan dua akun berbeda.
2. **Absen tidak pernah diblokir** karena status langganan owner. Yang dikunci hanya fitur owner.
3. **Waktu absen dari server** (`now()` di Postgres lewat RPC), bukan jam HP. Simpan `timestamptz`, tampilkan sesuai zona waktu usaha (WIB/WITA/WIT).
4. **Validasi radius dan batas paket di database** (RPC `security definer`), bukan hanya di UI.
5. **Uang disimpan sebagai integer rupiah** (`bigint`). Tidak ada float untuk uang.
6. **Foto absen** di bucket privat, akses lewat signed URL berbatas waktu. Hapus otomatis sesuai masa simpan paket.
7. **Koreksi absen dan perubahan gaji** wajib punya alasan dan tercatat di `audit_logs`.
8. **Gajian yang sudah dikunci tidak bisa diubah**. Perubahan jadi penyesuaian di periode berikutnya.
9. **Super admin tidak melihat data pribadi karyawan** (foto, lokasi, nominal gaji) kecuali ada izin aktif di `support_access_grants`. Setiap akses tercatat.
10. **Paket Benih nol biaya variabel**: tidak ada WA API, email massal, atau AI untuk akun gratis.
11. Semua perubahan skema lewat file di `supabase/migrations/`. Setelah migration, generate ulang types Supabase.

## Paket

Fitur ditentukan oleh **level** (`benih`, `dasar`, `plus`). Rentang karyawan hanya menentukan harga dan batas jumlah karyawan aktif. Semua dibaca dari tabel `plans` dan `plan_features`, jangan di-hardcode di komponen. Gunakan helper `hasFeature(company, key)` di app dan fungsi SQL `has_feature(company_id, key)` di RLS/RPC.

| Paket | Karyawan | Dasar | Plus |
|---|---|---|---|
| Benih | 1–5 | Gratis | – |
| Tunas | 2–5 | Rp39.000 | Rp79.000 |
| Tumbuh | 6–15 | Rp69.000 | Rp149.000 |
| Berkembang | 16–30 | Rp129.000 | Rp249.000 |
| Rindang | 31–50 | Rp199.000 | Rp399.000 |
| Hutan | 51+ | Custom | Custom |

Feature keys: `kasbon`, `shift`, `cuti`, `multi_lokasi`, `wa_auto`, `export`, `import_excel`, `bpjs_pph21`, `thr`, `admin_tambahan`, `slip_tanpa_watermark`.

**Fitur terkunci selalu terlihat** di menu dengan ikon gembok + label paket minimum. Klik membuka halaman pratinjau (contoh data diburamkan) dengan satu kartu ajakan upgrade. Maksimal satu ajakan per halaman. Jangan pernah popup di alur absen.

## Design system

Gaya: editorial tenang di atas kanvas krem hangat, teks hitam, satu aksen lime.

```css
--canvas: #fdfcfc;     /* latar halaman */
--taupe: #f5f3f1;      /* kartu dan panel */
--stone: #ebe8e4;      /* garis tipis, divider */
--ink: #000000;        /* teks utama, tombol hitam */
--graphite: #44403b;   /* teks sekunder kuat */
--smoke: #777169;      /* teks isi, deskripsi */
--ash: #a59f97;        /* teks bantuan */
--accent: #beff50;     /* lime: tombol utama, label P0, penanda penting */
--on-accent: #0b0b0a;  /* teks di atas lime */
```

- **Font**: Onest weight 300 untuk judul (letter-spacing -0.02em), Inter 400/500 untuk semua teks lain, Geist Mono untuk ID dan angka teknis.
- **Tombol**: sudut 10px, tinggi minimal 44px. Tombol utama lime dengan gradien tipis dan chip panah hitam di kanan. Tombol sekunder outline.
- **Kartu**: latar taupe, sudut 20px, tanpa bayangan. Tag status tetap bulat penuh.
- **Ikon**: outline hitam, tanpa isian warna. Paket memakai ikon tahap tumbuh: benih, tunas, tanaman, pohon kecil, pohon rindang, hutan.
- **Lime tidak pernah dipakai sebagai warna teks** di atas latar terang (kontras kurang).
- Dukung mode gelap lewat token yang sama.
- Mobile-first untuk `/app`; `/owner` harus nyaman di HP maupun laptop.

## Bahasa dan copy

- UI dalam **Bahasa Indonesia** yang santai dan jelas, sentence case.
- Pakai istilah yang dikenal owner: "absen", "gajian", "kasbon", "slip gaji", "lembur", bukan istilah HR teknis.
- Tombol menyebut aksinya: "Proses gajian", lalu notifikasi "Gajian diproses".
- Pesan error menjelaskan apa yang salah dan cara memperbaikinya, contoh: "Kamu berada 240 m dari lokasi toko. Absen hanya bisa dalam radius 100 m."
- Format rupiah `Rp1.250.000`, tanggal `30 Sep 2026`.
