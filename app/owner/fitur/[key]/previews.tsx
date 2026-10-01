import type { FeatureKey } from "@/lib/plans";

type Sample = { title: string; columns: string[]; rows: string[][] };

/** Contoh data untuk pratinjau fitur terkunci. Bukan data usaha mana pun. */
const SAMPLES: Partial<Record<FeatureKey, Sample>> = {
  kasbon: {
    title: "Kasbon berjalan",
    columns: ["Karyawan", "Kasbon", "Cicilan", "Sisa"],
    rows: [
      ["Dewi Lestari", "Rp1.000.000", "Rp250.000", "Rp500.000"],
      ["Agus Saputra", "Rp600.000", "Rp200.000", "Rp400.000"],
      ["Rina Marlina", "Rp300.000", "Rp150.000", "Rp150.000"],
    ],
  },
  shift: {
    title: "Jadwal minggu ini",
    columns: ["Karyawan", "Sen", "Sel", "Rab", "Kam"],
    rows: [
      ["Dewi Lestari", "Pagi", "Pagi", "Libur", "Sore"],
      ["Agus Saputra", "Sore", "Sore", "Pagi", "Pagi"],
      ["Rina Marlina", "Libur", "Pagi", "Sore", "Sore"],
      ["Budi Santoso", "Pagi", "Libur", "Pagi", "Pagi"],
    ],
  },
  cuti: {
    title: "Pengajuan cuti & izin",
    columns: ["Karyawan", "Jenis", "Tanggal", "Status"],
    rows: [
      ["Dewi Lestari", "Cuti tahunan", "12–14 Okt 2026", "Menunggu"],
      ["Agus Saputra", "Izin sakit", "8 Okt 2026", "Disetujui"],
      ["Rina Marlina", "Cuti tahunan", "20 Okt 2026", "Menunggu"],
    ],
  },
  multi_lokasi: {
    title: "Cabang",
    columns: ["Cabang", "Radius", "Karyawan", "Hadir hari ini"],
    rows: [
      ["Pusat · Jl. Merdeka", "100 m", "8", "7"],
      ["Cabang Dago", "80 m", "5", "5"],
      ["Cabang Antapani", "100 m", "4", "3"],
    ],
  },
  export: {
    title: "Unduh laporan",
    columns: ["Laporan", "Periode", "Format"],
    rows: [
      ["Rekap absen", "Sep 2026", "Excel"],
      ["Gajian", "Sep 2026", "Excel"],
      ["Slip gaji semua karyawan", "Sep 2026", "PDF"],
    ],
  },
  import_excel: {
    title: "Pratinjau import",
    columns: ["Nama", "Nomor HP", "Jabatan", "Gaji pokok"],
    rows: [
      ["Dewi Lestari", "0812••••321", "Kasir", "Rp3.200.000"],
      ["Agus Saputra", "0813••••654", "Barista", "Rp3.000.000"],
      ["Rina Marlina", "0857••••987", "Pelayan", "Rp2.900.000"],
    ],
  },
  bpjs_pph21: {
    title: "Potongan BPJS & PPh 21",
    columns: ["Karyawan", "BPJS Kesehatan", "BPJS TK", "PPh 21"],
    rows: [
      ["Dewi Lestari", "Rp32.000", "Rp96.000", "Rp0"],
      ["Agus Saputra", "Rp30.000", "Rp90.000", "Rp0"],
      ["Budi Santoso", "Rp48.000", "Rp144.000", "Rp36.000"],
    ],
  },
  thr: {
    title: "THR 2027",
    columns: ["Karyawan", "Masa kerja", "THR"],
    rows: [
      ["Dewi Lestari", "2 tahun", "Rp3.200.000"],
      ["Agus Saputra", "8 bulan", "Rp2.000.000"],
      ["Rina Marlina", "3 bulan", "Rp725.000"],
    ],
  },
  admin_tambahan: {
    title: "Admin",
    columns: ["Nama", "Peran", "Akses"],
    rows: [
      ["Kamu", "Owner", "Semua"],
      ["Sari Wulandari", "Admin", "Absen, karyawan"],
      ["Joko Prasetyo", "Supervisor", "Absen"],
    ],
  },
  absen_remote: {
    title: "Absen remote hari ini",
    columns: ["Karyawan", "Masuk", "Lokasi"],
    rows: [
      ["Dewi Lestari", "08.02", "Rumah · Bandung"],
      ["Agus Saputra", "08.15", "Klien · Cimahi"],
      ["Rina Marlina", "07.58", "Rumah · Bandung"],
    ],
  },
  wa_auto: {
    title: "Pengiriman slip September 2026",
    columns: ["Karyawan", "Nomor WA", "Status"],
    rows: [
      ["Dewi Lestari", "0812••••321", "Terkirim 08.00"],
      ["Agus Saputra", "0813••••654", "Terkirim 08.00"],
      ["Rina Marlina", "0857••••987", "Dibaca 08.12"],
    ],
  },
  slip_tanpa_watermark: {
    title: "Slip gaji September 2026",
    columns: ["Komponen", "Jumlah"],
    rows: [
      ["Gaji pokok", "Rp3.200.000"],
      ["Tunjangan makan", "Rp400.000"],
      ["Potongan telat", "-Rp50.000"],
      ["Diterima", "Rp3.550.000"],
    ],
  },
};

/** Contoh tampilan fitur, diburamkan dan tidak bisa diklik. */
export function FeaturePreview({ featureKey }: { featureKey: FeatureKey }) {
  const sample = SAMPLES[featureKey];
  if (!sample) return null;
  return (
    <div aria-hidden className="pointer-events-none select-none">
      <p className="mb-2 text-sm text-ash">Contoh tampilan</p>
      <div className="overflow-hidden rounded-card bg-taupe p-5 blur-[3px] sm:p-6">
        <p className="font-display text-xl text-ink">{sample.title}</p>
        <table className="mt-4 w-full text-left text-sm">
          <thead>
            <tr className="text-smoke">
              {sample.columns.map((column) => (
                <th key={column} className="pb-2 font-normal">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone">
            {sample.rows.map((row, index) => (
              <tr key={index}>
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="py-2.5 text-ink">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
