# PRD Semai

Draf v0.1 · 30 September 2026 · Penyusun: Sandy Syahbana

Semai adalah aplikasi absensi dan penggajian untuk usaha kecil di Indonesia dengan 2 sampai 50 karyawan: resto, kafe, toko, klinik, salon, bengkel, dan laundry yang hari ini masih absen di buku dan hitung gaji di Excel.

---

## 1. Ringkasan produk

| | |
|---|---|
| **Masalah** | Absen di buku atau grup WA, bisa titip absen, rekap memakan waktu berjam-jam, hitungan gaji sering diperdebatkan. |
| **Solusi** | Karyawan absen dari HP dengan selfie dan GPS. Sistem menghitung telat, lembur, potongan, kasbon, lalu membuat slip gaji yang bisa dikirim ke WA karyawan. |
| **Target pasar** | Usaha 2–50 karyawan. Pemain besar (Talenta, Gadjian) fokus ke perusahaan menengah dan terasa berat untuk usaha sekecil ini. |
| **Model bisnis** | Freemium. Paket gratis tanpa biaya variabel. Paket berbayar per rentang karyawan dengan level Dasar dan Plus. Fitur berbiaya per pesan hanya di Plus. |

## 2. Pengguna

Satu codebase multi-tenant, tampilan menyesuaikan peran. Setiap data terikat ke satu usaha lewat `company_id`.

**Owner — Bu Rina, pemilik kafe.** 9 karyawan, 2 shift. Setiap tanggal 25 menghabiskan satu malam merekap absen dan lembur di Excel. Ingin tahu siapa yang telat hari ini, ingin gajian selesai dalam 10 menit, tidak mau belajar istilah HR.

**Karyawan — Dimas, barista.** HP Android kelas menengah, kuota terbatas, jarang cek email. Ingin absen cepat tanpa install aplikasi berat, bisa cek sendiri lembur dan potongan, terima slip gaji yang jelas.

**Super admin — tim Semai.** Memantau usaha aktif, paket, MRR, churn. Mengelola langganan dan tagihan. Akses data detail hanya dengan izin owner.

## 3. Tujuan & metrik (target 90 hari setelah peluncuran)

| Metrik | Definisi | Target |
|---|---|---|
| **Usaha aktif mingguan** (north star) | Absen tercatat minimal 5 dari 7 hari terakhir | 40 |
| Usaha terdaftar | Owner menyelesaikan registrasi | 100 |
| Aktivasi | Absen karyawan pertama < 24 jam setelah owner daftar | 40% |
| Selesai onboarding | Owner menyelesaikan 6 langkah | 70% |
| Usaha berbayar | Langganan Dasar atau Plus aktif | 10 |
| Konversi trial | Trial Plus 14 hari lanjut berbayar | 15% |
| Gajian pertama | Usaha menyelesaikan proses gaji pertama | 25 |

Momen paling penting adalah **absen pertama**. Seluruh onboarding diarahkan ke sana.

## 4. Ruang lingkup

**Masuk MVP (Benih + Dasar)**
- Registrasi Google dan email, onboarding 6 langkah
- Absen HP dengan selfie, GPS, radius lokasi
- Deteksi telat dan pulang cepat
- Gaji pokok, tunjangan tetap, lembur, potongan
- Kasbon (Dasar)
- Slip gaji PDF + tombol kirim manual via wa.me
- Dashboard harian dan rekap bulanan
- Fitur terkunci terlihat di menu
- Tagihan langganan via payment gateway
- Super admin: daftar usaha, paket, tagihan

**Di luar MVP (Plus dan setelahnya)**
- Shift, rotasi, tukar shift
- Cuti dan izin, saldo cuti
- Multi-cabang
- WhatsApp otomatis
- Export Excel/PDF, import karyawan dari Excel
- BPJS, PPh 21, THR otomatis
- Transfer gaji massal, aplikasi native, komisi karyawan

## 5. Paket & harga

Satu harga per paket (keputusan Langkah 8, menggantikan pilihan Dasar/Plus). Benih gratis; semua paket berbayar membuka semua fitur. Harga per bulan, bayar tahunan gratis 2 bulan. Trial semua fitur 14 hari tanpa kartu kredit.

| Paket | Karyawan aktif | Per bulan | Per tahun |
|---|---|---|---|
| Benih | 1–5 | Gratis | – |
| Tunas | 2–5 | Rp39.000 | Rp390.000 |
| Tumbuh | 6–15 | Rp69.000 | Rp690.000 |
| Berkembang | 16–30 | Rp129.000 | Rp1.290.000 |
| Rindang | 31–50 | Rp199.000 | Rp1.990.000 |
| Hutan | 51+ | Hubungi kami | Custom |

**Prinsip biaya:** Benih tidak boleh menimbulkan biaya variabel. Semua yang ditagih per pemakaian (WA API, email massal, AI) hanya di paket berbayar.

Di bawah ini "Dasar" dan "Plus" adalah rancangan awal. Sekarang kolom **Plus = paket berbayar**; kolom Dasar tidak dijual lagi.

## 6. Matriks fitur

| Fitur | Benih | Dasar | Plus |
|---|---|---|---|
| **Absensi** | | | |
| Absen HP selfie + GPS | Ya | Ya | Ya |
| Lokasi absen | 1 | 1 | Tanpa batas |
| Deteksi telat & pulang cepat | Ya | Ya | Ya |
| Reminder absen (push notification) | Ya | Ya | Ya |
| Penyimpanan foto absen | 30 hari | 12 bulan | 24 bulan |
| Riwayat data absen | 3 bulan | Tanpa batas | Tanpa batas |
| **Karyawan & jadwal** | | | |
| Jam kerja tetap | Ya | Ya | Ya |
| Shift, rotasi, tukar shift | – | – | Ya |
| Cuti & izin, saldo cuti | – | – | Ya |
| Import karyawan Excel | – | – | Ya |
| **Penggajian** | | | |
| Gaji pokok, tunjangan, lembur, potongan | Ya | Ya | Ya |
| Kasbon | – | Ya | Ya |
| Slip gaji PDF | Dengan watermark | Ya | Ya |
| Kirim slip via WA | Manual (wa.me) | Manual (wa.me) | Otomatis |
| BPJS, PPh 21, THR | – | – | Ya |
| **Laporan & akun** | | | |
| Dashboard harian & rekap bulanan | Ya | Ya | Ya |
| Export Excel/PDF | – | – | Ya |
| Multi-cabang | – | – | Ya |
| Ringkasan mingguan owner | Dashboard | Email | WA |
| Akun admin | 1 owner | 1 owner | Owner + admin |
| Bantuan | Pusat bantuan | Chat/email | Prioritas WA |

## 7. Kebutuhan fungsional

P0 = wajib saat MVP. P1 = fase Plus. P2 = setelah ada data pemakaian.

### Owner

| ID | Kebutuhan | Level | Prioritas |
|---|---|---|---|
| OWN-01 | Daftar dengan Google atau email + password (verifikasi email) | Semua | P0 |
| OWN-02 | Onboarding 6 langkah, isi default sesuai bidang usaha | Semua | P0 |
| OWN-03 | Dashboard hari ini: masuk, telat, izin, belum absen | Semua | P0 |
| OWN-04 | Tambah karyawan manual, atau link/QR undangan | Semua | P0 |
| OWN-05 | Atur lokasi absen di peta + radius (default 100 m) | Semua | P0 |
| OWN-06 | Lihat foto & lokasi absen, koreksi manual dengan alasan | Semua | P0 |
| OWN-07 | Atur gaji pokok, tunjangan, aturan potongan, tarif lembur | Semua | P0 |
| OWN-08 | Proses gajian bulanan dengan pratinjau sebelum dikunci | Semua | P0 |
| OWN-09 | Catat kasbon, potong otomatis di gajian berikutnya | Dasar | P0 |
| OWN-10 | Slip gaji PDF + tombol kirim wa.me per karyawan | Semua | P0 |
| OWN-11 | Lihat paket, tagihan, upgrade, riwayat pembayaran | Semua | P0 |
| OWN-12 | Izin sementara (24 jam) untuk tim support | Semua | P1 |
| OWN-13 | Jadwal shift, setujui tukar shift | Plus | P1 |
| OWN-14 | Setujui cuti & izin, lihat saldo cuti | Plus | P1 |
| OWN-15 | Kelola beberapa cabang | Plus | P1 |
| OWN-16 | Kirim slip otomatis via WA | Plus | P1 |
| OWN-17 | Admin/supervisor tanpa akses nominal gaji | Plus | P1 |
| OWN-18 | Hitung BPJS, PPh 21 (TER), THR proporsional | Plus | P2 |

### Karyawan

| ID | Kebutuhan | Level | Prioritas |
|---|---|---|---|
| EMP-01 | Aktivasi via link undangan, login nomor HP + PIN | Semua | P0 |
| EMP-02 | Clock-in/out selfie + GPS, ditolak di luar radius | Semua | P0 |
| EMP-03 | Pasang PWA ke layar utama, terima push notification | Semua | P0 |
| EMP-04 | Riwayat absen sendiri: telat, lembur, tidak masuk | Semua | P0 |
| EMP-05 | Lihat dan unduh slip gaji | Semua | P0 |
| EMP-06 | Lihat saldo kasbon | Dasar | P1 |
| EMP-07 | Ajukan cuti & izin | Plus | P1 |
| EMP-08 | Lihat jadwal shift, ajukan tukar shift | Plus | P1 |

### Super admin

| ID | Kebutuhan | Prioritas |
|---|---|---|
| ADM-01 | Dashboard bisnis: usaha terdaftar, aktif, per paket, MRR, churn, konversi | P0 |
| ADM-02 | Daftar usaha: bidang, kota, paket, jumlah karyawan, tanggal daftar, terakhir aktif | P0 |
| ADM-03 | Ubah paket, perpanjang trial, diskon, suspend/aktifkan | P0 |
| ADM-04 | Invoice, status bayar, pembayaran gagal, pengingat | P0 |
| ADM-05 | Pemakaian WA per usaha Plus | P1 |
| ADM-06 | Pengumuman ke semua owner | P1 |
| ADM-07 | Lihat data detail hanya dengan izin owner, tercatat di log | P1 |

## 8. Registrasi & onboarding

Owner langsung masuk onboarding setelah daftar. Satu layar satu topik, progress bar, target < 3 menit.

0. **Daftar** — Google, atau nama + email + nomor WA + password dengan verifikasi email
1. **Profil usaha** — nama, bidang (Kuliner, Retail/Toko, Salon & Barbershop, Klinik, Bengkel, Laundry, Jasa lainnya), kota
2. **Ukuran usaha** — jumlah karyawan (1–5, 6–15, 16–30, 31–50, 51+), jumlah cabang
3. **Jam kerja** — tetap atau shift, jam masuk/pulang default, toleransi telat
4. **Lokasi absen** — titik di peta atau lokasi saat ini, radius
5. **Undang karyawan** — manual atau link/QR. Bisa dilewati
6. **Rekomendasi paket** — trial Plus 14 hari, pilih berbayar, atau lanjut Benih

**Default otomatis per bidang**

| Bidang | Default |
|---|---|
| Kuliner | Shift aktif, lembur per jam, tunjangan makan |
| Retail/Toko | Jam tetap, toleransi telat 10 menit |
| Salon & Barbershop | Shift fleksibel, siap untuk komisi |
| Klinik | Shift pagi & sore, cuti & izin aktif |
| Bengkel | Jam tetap, lembur harian |
| Laundry | Jam tetap, lembur per jam |

**Login karyawan tanpa OTP berbayar:** aktivasi lewat link undangan, buat PIN 6 digit, login nomor HP + PIN. Reset PIN oleh owner.

## 9. Fitur terkunci

- Semua menu selalu terlihat. Fitur di luar paket diberi gembok + label paket minimum ("Shift & Jadwal · Berbayar").
- Klik membuka halaman pratinjau berisi contoh data yang diburamkan + satu kartu: manfaat, harga mulai dari, tombol "Coba gratis 14 hari" dan "Lihat paket".
- Tombol fitur terkunci muncul di sebelah versi gratisnya (kirim slip otomatis di sebelah kirim manual).
- Maksimal satu ajakan upgrade per halaman. Kartu promosi bisa ditutup, tidak muncul lagi 7 hari.
- Absen, data karyawan, hitung gaji dasar tidak pernah diganggu popup.
- Peringatan kuota sebelum batas ("4 dari 5 karyawan terpakai").
- Semua pengecekan diulang di server.

## 10. Aturan bisnis

| Pemicu | Perilaku |
|---|---|
| Karyawan melewati batas paket | Layar upgrade. Masa tenggang 14 hari |
| Karyawan berkurang | Turun paket di periode tagihan berikutnya |
| Hitungan karyawan | Hanya karyawan aktif |
| Trial Plus berakhir | Pilih paket, atau turun ke Benih. Data di luar batas disembunyikan (tidak dihapus) 90 hari |
| Tagihan belum dibayar | Tenggang 7 hari, lalu fitur owner baca saja. **Absen tetap jalan** |
| Akun Benih tidak aktif | 60 hari: email peringatan. 90 hari: arsip |
| Foto absen | Kompres ±50 KB di perangkat. Hapus otomatis sesuai masa simpan |
| Koreksi absen | Wajib alasan, nilai sebelum/sesudah tercatat, terlihat karyawan |
| Gajian dikunci | Slip terkirim tidak bisa diubah. Perubahan jadi penyesuaian periode berikutnya |

**Keputusan Langkah 8 (paket dan langganan)**

- Karyawan di atas batas paket (setelah trial habis atau turun paket): tenggang 14 hari sejak usaha melewati batas, lalu karyawan aktif + diundang yang paling baru ditambahkan disembunyikan dari owner (daftar, rekap, gajian). Tidak dihapus, tetap bisa absen, dan muncul lagi setelah upgrade atau setelah karyawan lain dinonaktifkan. Lewat 90 hari tetap disimpan; penghapusan diputuskan belakangan.
- Menambah karyawan saat kuota penuh langsung ditolak dan diarahkan ke halaman Paket (tidak ada tenggang untuk penambahan).
- Upgrade di tengah periode: sisa nilai paket lama dipotong prorata dari tagihan baru, periode baru mulai saat bayar. Turun paket berlaku di periode berikutnya.
- Mode baca saja (tagihan lewat 7 hari): owner boleh keluar dengan pindah ke Benih tanpa melunasi; data di atas batas Benih mengikuti aturan karyawan di atas.

## 11. Non-fungsional

**Keamanan & privasi**
- RLS di setiap tabel berdasarkan `company_id`
- Foto di storage privat, signed URL berbatas waktu
- Kebijakan Privasi dan S&K sesuai UU Pelindungan Data Pribadi
- Audit log untuk koreksi absen, perubahan gaji, akses support

**Kinerja**
- Halaman absen terbuka < 3 detik di 4G
- Absen selesai dalam 3 ketukan
- Unggahan per absen < 100 KB
- Absen tersimpan sementara saat sinyal hilang, dikirim saat online

**Keandalan**
- Waktu absen dari server
- Deteksi lokasi palsu sebagai sinyal, selfie sebagai lapisan kedua
- Backup database harian
- Bahasa Indonesia, zona WIB/WITA/WIT

## 12. Stack & model data

| Lapisan | Pilihan | Catatan |
|---|---|---|
| Frontend | Next.js + PWA | Satu codebase, tiga peran |
| Backend | Supabase (Postgres) | Auth, Storage, RLS, Edge Functions |
| Hosting | Vercel atau VPS | Gratis sampai ada pelanggan berbayar |
| Notifikasi | Web Push | Reminder absen semua paket |
| WhatsApp | Meta WhatsApp Cloud API | Plus saja, template Utility, tanpa BSP |
| Email | Layanan email transaksional | Verifikasi, tagihan, ringkasan Dasar |
| Pembayaran | Midtrans atau Xendit | VA dan QRIS, dorong tahunan |

**Tabel utama**

| Tabel | Isi |
|---|---|
| `companies` | Profil usaha, bidang, kota, zona waktu, jawaban onboarding |
| `company_members` | Owner dan admin + peran |
| `employees` | Data karyawan, jabatan, gaji pokok, status aktif |
| `locations` | Titik lokasi + radius per cabang |
| `work_schedules`, `shifts` | Jam kerja tetap dan shift |
| `attendances` | Masuk/pulang, koordinat, path foto, status telat, koreksi |
| `leave_requests` | Cuti & izin + status |
| `payroll_rules` | Tunjangan, potongan, tarif lembur |
| `payroll_runs`, `payslips` | Gajian per periode + slip per karyawan |
| `cash_advances` | Kasbon + cicilan potongan |
| `plans`, `plan_features` | Level, rentang, harga, fitur, batas |
| `subscriptions`, `invoices` | Langganan, periode, status bayar |
| `support_access_grants` | Izin sementara untuk support |
| `audit_logs` | Jejak perubahan data sensitif |
| `wa_message_logs` | Pesan WA per usaha (biaya) |

## 13. Biaya operasional

Kurs ±Rp16.500/USD, dibangun sendiri.

| Sekali bayar | Perkiraan |
|---|---|
| Domain | Rp150–400rb / tahun |
| Logo & aset | Rp0–1,5 jt |
| NIB + PT Perorangan | Rp0–1 jt |
| PSE Komdigi | Gratis |

| Bulanan | Tahap gratis | Setelah berbayar |
|---|---|---|
| Supabase | Rp0 | ± Rp415rb |
| Hosting | Rp0 | ± Rp330rb |
| Email | Rp0 | Rp0–330rb |
| WhatsApp (Plus) | Rp0 | ± Rp400 / pesan |
| Payment gateway | Rp0 | ± Rp4.400 / tagihan VA |

Reminder absen via WA untuk 15 karyawan × 22 hari ≈ Rp117.000/bulan, hampir 80% harga Tumbuh Plus. Karena itu reminder memakai push notification, dan WA hanya untuk slip gaji serta ringkasan owner di Plus.

## 14. Roadmap

| Waktu | Fase | Isi |
|---|---|---|
| Minggu 1–2 | Validasi | Wawancara 10 owner, uji harga, cek merek di PDKI, amankan domain |
| Minggu 3–8 | MVP | Benih + Dasar, onboarding, absen, gaji, kasbon, slip, tagihan, admin dasar, pilot 5 usaha |
| Bulan 3–4 | Plus | Shift, cuti, multi-cabang, WA otomatis, export, admin tambahan, trial Plus |
| Bulan 5–6 | Kepatuhan | BPJS, PPh 21 (TER), THR, import Excel, laporan biaya gaji |

## 15. Risiko & mitigasi

| Risiko | Mitigasi |
|---|---|
| Aplikasi lokasi palsu | Selfie wajib, deteksi mock location, owner meninjau foto & lokasi |
| Salah hitung BPJS/pajak | Fase terakhir, validasi konsultan pajak, pratinjau sebelum dikunci |
| Biaya WA > pendapatan | Plus saja, template Utility, tanpa BSP, pantau per usaha |
| Owner berhenti di tengah setup | Onboarding < 3 menit, default per bidang, arahkan ke absen pertama |
| Betah di Benih selamanya | Watermark, masa simpan terbatas, kasbon di Dasar, fitur terkunci terlihat |
| Sengketa merek "Semai" | Cek kelas 9 & 42 di PDKI, siapkan "Semai Tim" |
| Pemain besar turun ke mikro | Fokus kesederhanaan, harga rendah, alur berbasis WhatsApp |

## 16. Pertanyaan terbuka

1. **Benih dan Tunas tumpang tindih** (1–5 karyawan). Cukupkah kasbon, riwayat tanpa batas, dan slip tanpa watermark, atau Benih dibatasi 3 karyawan?
2. **Nama merek final**: Semai (setelah cek PDKI) atau Semai Tim (semaitim.id)?
3. **Rumus potongan telat**: nominal tetap, per menit, atau proporsional gaji harian?
4. **Aplikasi native**: kapan dibutuhkan, misalnya jika push notification di sebagian Android tidak andal?
