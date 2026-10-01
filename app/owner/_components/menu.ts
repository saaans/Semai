import { hasFeature, minLevelLabel, type CompanyPlan, type FeatureKey } from "@/lib/plans";

export type MenuItem = {
  label: string;
  href: string;
  /** aktif = bisa dibuka, segera = belum dibuat, terkunci = di luar paket. */
  state: "aktif" | "segera" | "terkunci";
  /** Label paket minimum untuk fitur terkunci, contoh "Plus". */
  planLabel?: string;
};

/** Penjelasan fitur berbayar, dipakai menu dan halaman fitur terkunci. */
export const FEATURE_INFO: Partial<Record<FeatureKey, { label: string; benefit: string }>> = {
  kasbon: {
    label: "Kasbon",
    benefit: "Catat kasbon karyawan dan potong otomatis dari gajian berikutnya, lengkap dengan sisa cicilan.",
  },
  shift: {
    label: "Shift & jadwal",
    benefit: "Atur shift bergilir, rotasi mingguan, dan setujui tukar shift antar karyawan.",
  },
  cuti: {
    label: "Cuti & izin",
    benefit: "Karyawan mengajukan cuti dan izin dari HP, kamu tinggal setujui. Saldo cuti terhitung otomatis.",
  },
  multi_lokasi: {
    label: "Multi-cabang",
    benefit: "Kelola beberapa cabang dengan lokasi absen dan radius masing-masing dalam satu akun.",
  },
  slip_tanpa_watermark: {
    label: "Slip tanpa watermark",
    benefit: "Slip gaji PDF tampil bersih dengan nama dan logo usahamu, tanpa tulisan \"Dibuat dengan Semai\".",
  },
  wa_auto: {
    label: "Kirim slip otomatis",
    benefit: "Slip gaji terkirim otomatis ke WA setiap karyawan begitu gajian dikunci, tanpa buka WA satu per satu.",
  },
  export: {
    label: "Export",
    benefit: "Unduh rekap absen dan gajian ke Excel atau PDF untuk pembukuan.",
  },
  import_excel: {
    label: "Import Excel",
    benefit: "Tambah banyak karyawan sekaligus dari file Excel.",
  },
  bpjs_pph21: {
    label: "BPJS & PPh 21",
    benefit: "Hitung potongan BPJS dan PPh 21 (TER) otomatis di setiap gajian.",
  },
  thr: {
    label: "THR",
    benefit: "Hitung THR proporsional sesuai masa kerja setiap karyawan.",
  },
  absen_remote: {
    label: "Absen remote",
    benefit: "Karyawan yang kerja dari luar kantor bisa absen dari mana saja, tetap dengan selfie dan lokasi tercatat.",
  },
  admin_tambahan: {
    label: "Admin tambahan",
    benefit: "Tambah admin atau supervisor untuk mengelola absen, tanpa akses nominal gaji.",
  },
};

/** Fitur berbayar yang tampil di menu, berurutan. */
const FEATURE_MENU: FeatureKey[] = [
  "kasbon",
  "shift",
  "cuti",
  "multi_lokasi",
  "export",
  "import_excel",
  "bpjs_pph21",
  "thr",
  "admin_tambahan",
];

/** Halaman fitur yang sudah dibuat. */
export const FEATURE_PAGE: Partial<Record<FeatureKey, string>> = {
  kasbon: "/owner/kasbon",
};

function featureItem(plan: CompanyPlan, key: FeatureKey): MenuItem {
  const label = FEATURE_INFO[key]?.label ?? key;
  if (hasFeature(plan, key)) {
    const page = FEATURE_PAGE[key];
    if (page) return { label, href: page, state: "aktif" };
    // Fitur termasuk paket tapi halamannya belum dibuat.
    return { label, href: `/owner/fitur/${key}`, state: "segera" };
  }
  return {
    label,
    href: `/owner/fitur/${key}`,
    state: "terkunci",
    planLabel: minLevelLabel(plan, key) ?? undefined,
  };
}

/** Semua menu owner. Fitur di luar paket tetap terlihat dengan gembok. */
export function buildOwnerMenu(plan: CompanyPlan): MenuItem[][] {
  return [
    [
      { label: "Hari ini", href: "/owner", state: "aktif" },
      { label: "Rekap absen", href: "/owner/absen", state: "aktif" },
      { label: "Karyawan", href: "/owner/karyawan", state: "aktif" },
      { label: "Gajian", href: "/owner/gaji", state: "aktif" },
    ],
    FEATURE_MENU.map((key) => featureItem(plan, key)),
    [
      { label: "Paket", href: "/owner/paket", state: "aktif" },
      { label: "Pengaturan", href: "/owner/pengaturan", state: "aktif" },
    ],
  ];
}
