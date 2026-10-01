/**
 * Data penyelenggara dan angka yang dikutip di /privasi dan /syarat.
 * Ubah di sini, bukan di halaman. Placeholder dalam kurung siku wajib diisi
 * sebelum peluncuran (badan usaha belum berdiri).
 */
export const LEGAL = {
  /** Tanggal mulai berlaku, format ISO. Ganti setiap kali isi kebijakan berubah. */
  berlakuSejak: "2026-10-01",
  penyelenggara: "[NAMA PT PERORANGAN]",
  alamat: "[ALAMAT LENGKAP PENYELENGGARA]",
  /** Domain belum final (teamsemai.com atau teamsemai.id). */
  emailPrivasi: "privasi@teamsemai.com",
  emailBantuan: "bantuan@teamsemai.com",
  lokasiServer: "Singapura",
  /** Hari sampai data usaha dihapus permanen setelah owner minta hapus akun. */
  hapusSetelahHari: 30,
  /** Tahun penyimpanan data tagihan untuk kewajiban pajak. */
  simpanTagihanTahun: 10,
} as const;

/**
 * Masa simpan per paket. Sumber kebenaran tetap tabel plan_features
 * (simpan_foto_hari, riwayat_bulan); samakan teks ini kalau nilainya berubah.
 */
export const MASA_SIMPAN = {
  fotoBenih: "30 hari",
  fotoBerbayar: "24 bulan",
  riwayatBenih: "3 bulan",
  riwayatBerbayar: "selama akun aktif",
} as const;
