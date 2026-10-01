const TANYA = [
  {
    q: "Karyawan perlu install aplikasi?",
    a: "Tidak. Karyawan buka link undangan dari kamu di browser HP, buat PIN 6 digit, lalu bisa memasang Semai ke layar utama seperti aplikasi.",
  },
  {
    q: "Karyawan masuk pakai apa?",
    a: "Nomor HP dan PIN 6 digit. Tidak perlu email atau kode OTP. Kalau lupa PIN, kamu bisa reset dari dashboard.",
  },
  {
    q: "Kalau langganan berhenti, absen ikut berhenti?",
    a: "Tidak. Absen karyawan selalu jalan. Yang terkunci hanya fitur owner sampai tagihan dibayar atau kamu pindah ke paket Benih.",
  },
  {
    q: "Foto dan data karyawan aman?",
    a: "Data setiap usaha terpisah dan hanya bisa dibuka oleh usaha itu. Foto absen disimpan privat dan terhapus otomatis sesuai masa simpan paket.",
  },
];

/** Pertanyaan yang sering ditanyakan, pakai <details> supaya ringan tanpa JS. */
export function Faq() {
  return (
    <ul className="flex flex-col divide-y divide-stone border-y border-stone">
      {TANYA.map((t) => (
        <li key={t.q}>
          <details className="group py-1">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 text-lg [&::-webkit-details-marker]:hidden">
              {t.q}
              <span
                aria-hidden
                className="flex size-8 shrink-0 items-center justify-center rounded-full border border-stone text-graphite transition-transform duration-200 group-open:rotate-45"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </span>
            </summary>
            <p className="max-w-2xl pb-5 text-smoke">{t.a}</p>
          </details>
        </li>
      ))}
    </ul>
  );
}
