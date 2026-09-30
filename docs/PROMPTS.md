# Prompt build Semai

Pakai berurutan, satu prompt per sesi. Setelah setiap langkah: tes di HP, lalu commit. Jangan lanjut kalau langkah sebelumnya belum jalan.

Setiap prompt diawali "Baca CLAUDE.md" supaya Claude selalu memakai konteks dan aturan proyek.

---

## Langkah 0 — Kerangka proyek

```
Baca CLAUDE.md dan docs/PRD.md.

Tugas: siapkan kerangka proyek Semai.
- Next.js (App Router) + TypeScript strict + Tailwind, dengan design tokens dari CLAUDE.md (termasuk mode gelap)
- Font: Onest 300 untuk judul, Inter 400/500 untuk teks, Geist Mono untuk ID
- Struktur folder sesuai CLAUDE.md, dengan halaman placeholder: /, /masuk, /daftar, /owner, /app, /admin
- Supabase client untuk server dan browser pakai @supabase/ssr, middleware untuk refresh session
- Komponen dasar di components/ui: Button (primary lime, secondary outline), Input, Card, Tag
- .env.example berisi variabel Supabase
- Script npm: dev, build, lint

Jelaskan rencananya dulu sebelum menulis kode.
```

**Selesai jika:** `npm run build` sukses, halaman placeholder terbuka, tombol lime tampil sesuai design, deploy pertama ke Vercel berhasil.

---

## Langkah 1 — Skema database inti

```
Baca CLAUDE.md dan bagian 12 docs/PRD.md.

Tugas: buat migration SQL pertama di supabase/migrations untuk tabel inti MVP:
companies, company_members, employees, locations, work_schedules, attendances,
payroll_rules, payroll_runs, payslips, cash_advances, plans, plan_features,
subscriptions, invoices, audit_logs, support_access_grants.

Aturan:
- Setiap tabel data usaha punya company_id + RLS aktif
- Uang dalam bigint rupiah, waktu dalam timestamptz
- Fungsi SQL has_feature(company_id, feature_key) dan is_company_member(company_id)
- Seed data plans dan plan_features sesuai tabel paket dan matriks fitur di PRD
- Kolom is_platform_admin untuk super admin

Tampilkan dulu daftar tabel dan kolomnya untuk saya setujui, baru tulis migration.
Setelah itu generate types Supabase ke lib/supabase/types.ts.
```

**Selesai jika:** migration jalan di Supabase, seed paket masuk, types ter-generate.

---

## Langkah 2 — Registrasi owner

```
Baca CLAUDE.md dan OWN-01 di docs/PRD.md.

Tugas: registrasi dan login owner.
- /daftar: tombol "Daftar dengan Google" + form nama, email, nomor WA, password
- Verifikasi email untuk pendaftaran manual
- /masuk: Google atau email + password, lupa password
- Setelah daftar pertama kali: buat record companies (kosong) + company_members role owner, lalu arahkan ke /owner/onboarding
- Proteksi route: /owner hanya untuk member usaha, /admin hanya untuk is_platform_admin
- Copy dalam Bahasa Indonesia, pesan error yang jelas
```

**Selesai jika:** bisa daftar via Google dan email, langsung masuk onboarding, logout/login lagi berjalan.

---

## Langkah 3 — Onboarding 6 langkah

```
Baca CLAUDE.md dan bagian 8 docs/PRD.md.

Tugas: onboarding owner di /owner/onboarding.
- 6 langkah, satu layar satu topik, progress bar, tombol kembali
- Langkah 4 pakai peta Leaflet + OpenStreetMap: pilih titik atau "Pakai lokasi saya", slider radius (default 100 m)
- Langkah 5 bisa dilewati (undang karyawan dikerjakan di langkah berikutnya, cukup tampilkan tombol lewati)
- Langkah 6: rekomendasi paket berdasarkan jumlah karyawan dan shift; pilihan trial Plus 14 hari, pilih paket, atau lanjut Benih
- Simpan jawaban ke companies, buat locations dan work_schedules
- Isi payroll_rules default sesuai bidang usaha (tabel default di PRD)
- Progress tersimpan per langkah, kalau owner keluar bisa lanjut dari langkah terakhir
```

**Selesai jika:** onboarding selesai < 3 menit di HP, data tersimpan, owner mendarat di dashboard.

---

## Langkah 4 — Undang dan aktivasi karyawan

```
Baca CLAUDE.md (bagian login karyawan) dan OWN-04, EMP-01 di docs/PRD.md.

Tugas: kelola karyawan.
- /owner/karyawan: daftar karyawan, tambah manual (nama, nomor WA, jabatan, gaji pokok), nonaktifkan
- Buat link undangan + QR per karyawan, tombol "Kirim via WA" pakai link wa.me dengan teks siap kirim
- /app/aktivasi/[token]: karyawan cek data, buat PIN 6 digit
- Login karyawan di /app/masuk: nomor HP + PIN (email sintetis di Supabase Auth, lihat CLAUDE.md)
- Batasi 5 percobaan PIN salah, lalu kunci 15 menit
- Owner bisa reset PIN
- Cek batas jumlah karyawan sesuai paket di database; kalau terlewati tampilkan layar upgrade
```

**Selesai jika:** owner bisa undang, karyawan aktivasi dari HP lain dan login dengan PIN.

---

## Langkah 5 — Absen karyawan (inti produk)

```
Baca CLAUDE.md dan EMP-02, EMP-03, aturan bisnis di docs/PRD.md.

Tugas: fitur absen di /app.
- Halaman utama karyawan: tombol besar "Absen masuk" / "Absen pulang", status hari ini
- Alur: ambil selfie (kamera depan) → ambil GPS → kompres foto ±50 KB di browser → kirim
- RPC Postgres clock_in / clock_out (security definer): pakai now() server, hitung jarak ke lokasi (haversine), tolak jika di luar radius dengan pesan jarak, tandai telat sesuai jadwal + toleransi
- Foto ke bucket privat Supabase Storage, path per company
- Kalau offline: simpan antrean di perangkat, kirim saat online
- PWA: manifest, ikon, service worker, bisa dipasang ke layar utama
- Riwayat absen karyawan (EMP-04)

Jelaskan rencananya dulu.
```

**Selesai jika:** absen jalan di HP Android asli, ditolak di luar radius, tercatat dengan jam server.

---

## Langkah 6 — Dashboard owner

```
Baca CLAUDE.md dan OWN-03, OWN-06 di docs/PRD.md.

Tugas: dashboard owner di /owner.
- Ringkasan hari ini: sudah masuk, telat, belum absen (dengan status yang terlihat sekilas)
- Daftar absen hari ini dengan foto (signed URL) dan jarak dari lokasi
- Rekap bulanan per karyawan: hadir, telat, tidak masuk, jam lembur
- Koreksi absen manual dengan alasan wajib, tercatat di audit_logs dan terlihat karyawan
- Menu samping berisi semua fitur; fitur di luar paket tampil dengan gembok + label paket
```

**Selesai jika:** owner melihat absen karyawan real-time dan bisa koreksi dengan alasan.

---

## Langkah 7 — Penggajian dan slip

```
Baca CLAUDE.md dan OWN-07 sampai OWN-10 di docs/PRD.md.

Tugas: penggajian.
- lib/payroll: fungsi murni hitung gaji (gaji pokok + tunjangan + lembur − potongan telat/tidak masuk − cicilan kasbon), semua integer rupiah, lengkap dengan unit test
- /owner/gaji/pengaturan: atur tunjangan, aturan potongan, tarif lembur
- /owner/gaji: proses gajian per periode → pratinjau per karyawan → kunci
- Kasbon (hanya jika has_feature kasbon): catat, cicilan otomatis
- Slip gaji PDF (@react-pdf/renderer); paket Benih diberi watermark "Dibuat dengan Semai"
- Tombol "Kirim via WA" per karyawan (wa.me) dengan link slip
- Karyawan melihat dan unduh slip di /app/slip
- Gajian terkunci tidak bisa diubah
```

**Selesai jika:** unit test lulus, satu periode gajian bisa diproses dan slip terkirim manual via WA.

---

## Langkah 8 — Fitur terkunci dan langganan

```
Baca CLAUDE.md dan bagian 5, 9, 10 docs/PRD.md.

Tugas: paket dan tagihan.
- Halaman pratinjau untuk setiap fitur terkunci: contoh data diburamkan + satu kartu ajakan upgrade
- Peringatan kuota karyawan ("4 dari 5 karyawan terpakai")
- /owner/paket: paket aktif, pilih/ubah paket, bulanan atau tahunan
- Trial Plus 14 hari; saat habis turun ke Benih, data di luar batas disembunyikan bukan dihapus
- Integrasi Midtrans (sandbox dulu): buat tagihan VA/QRIS, webhook update subscriptions dan invoices, verifikasi signature webhook
- Tagihan belum dibayar: tenggang 7 hari, lalu fitur owner baca saja; absen karyawan tetap jalan
```

**Selesai jika:** alur upgrade berjalan di mode sandbox dan status paket berubah otomatis dari webhook.

---

## Langkah 9 — Super admin

```
Baca CLAUDE.md dan ADM-01 sampai ADM-04 di docs/PRD.md.

Tugas: area /admin.
- Dashboard: usaha terdaftar, aktif mingguan, per paket, MRR, churn, konversi gratis → berbayar
- Daftar usaha dengan filter bidang, kota, paket, terakhir aktif
- Detail usaha: paket, tagihan, pemakaian (jumlah absen, gajian). Tanpa data pribadi karyawan
- Aksi: ubah paket, perpanjang trial, diskon, suspend/aktifkan, semua tercatat di audit_logs
- Daftar invoice dan pembayaran gagal
```

**Selesai jika:** lo bisa melihat semua usaha pilot tanpa bisa membuka foto atau gaji karyawan mereka.

---

## Setelah setiap langkah: cek keamanan

```
Baca CLAUDE.md. Audit fitur yang baru dibuat:
1. Apakah semua tabel yang disentuh punya RLS yang benar?
2. Coba jelaskan skenario owner usaha A membaca/menulis data usaha B. Apakah bisa?
3. Apakah karyawan bisa membaca data karyawan lain atau data gaji orang lain?
4. Apakah ada pengecekan paket yang hanya di UI dan belum di database?
5. Apakah ada secret yang ikut ter-commit?
Tulis temuan dan perbaiki yang bermasalah.
```

---

## Tips

- Kalau Claude mulai berputar di bug yang sama: hentikan, kembali ke commit terakhir yang jalan, jelaskan ulang masalahnya dengan contoh spesifik (pesan error, langkah reproduksi).
- Minta screenshot atau langkah tes setelah fitur UI selesai.
- Tes absen selalu di HP asli, bukan hanya browser laptop.
- Update docs/PRD.md kalau ada keputusan baru, supaya sesi berikutnya ikut tahu.
