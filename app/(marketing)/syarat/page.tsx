import type { Metadata } from "next";
import Link from "next/link";
import { LEGAL } from "@/lib/legal";
import { type BagianLegal, DokumenLegal } from "../_components/dokumen-legal";

export const metadata: Metadata = {
  title: "Syarat & Ketentuan",
  description: "Aturan pemakaian Semai: akun, paket dan tagihan, tanggung jawab owner, dan batas tanggung jawab kami.",
};

const email = (alamat: string) => <a href={`mailto:${alamat}`}>{alamat}</a>;

const bagian: BagianLegal[] = [
  {
    id: "layanan",
    judul: "Tentang layanan",
    isi: (
      <>
        <p>
          Semai adalah aplikasi absensi dan penggajian untuk usaha kecil, diselenggarakan oleh{" "}
          {LEGAL.penyelenggara} (&ldquo;Semai&rdquo;, &ldquo;kami&rdquo;). Dengan mendaftar atau
          memakai Semai, kamu setuju dengan syarat ini dan dengan{" "}
          <Link href="/privasi">Kebijakan Privasi</Link>.
        </p>
        <p>Layanan Semai mencakup:</p>
        <ul>
          <li>Absen dari HP dengan foto selfie dan lokasi GPS.</li>
          <li>Rekap kehadiran, telat, dan lembur.</li>
          <li>Hitung gaji, kasbon, dan slip gaji.</li>
          <li>Fitur lain sesuai paket yang dipilih.</li>
        </ul>
        <p>
          Kami terus memperbaiki Semai, jadi tampilan dan fitur bisa berubah. Kalau ada fitur
          berbayar yang dihapus, kami beri tahu dulu.
        </p>
      </>
    ),
  },
  {
    id: "akun",
    judul: "Akun",
    isi: (
      <ul>
        <li>Owner wajib berusia 18 tahun ke atas dan berwenang mewakili usahanya.</li>
        <li>Data pendaftaran harus benar: nama, email, nomor WA, dan profil usaha.</li>
        <li>
          Jaga password, PIN, dan akses ke email atau akun Google-mu. Semua aktivitas dari akunmu
          dianggap dilakukan olehmu.
        </li>
        <li>
          Kalau akunmu dipakai orang lain tanpa izin, segera kabari kami di{" "}
          {email(LEGAL.emailBantuan)}.
        </li>
        <li>
          Karyawan masuk dengan nomor HP dan PIN. Owner bisa mereset PIN dari dashboard.
        </li>
      </ul>
    ),
  },
  {
    id: "data-karyawan",
    judul: "Tanggung jawab owner atas data karyawan",
    intinya:
      "Owner yang memasukkan dan mengendalikan data karyawan, jadi owner juga yang wajib memberi tahu dan meminta persetujuan mereka.",
    isi: (
      <>
        <p>Menurut UU PDP, owner adalah pengendali data karyawannya. Artinya owner wajib:</p>
        <ul>
          <li>
            Memberi tahu karyawan bahwa absen di Semai merekam foto selfie dan lokasi GPS, sebelum
            mengundang mereka.
          </li>
          <li>Hanya memasukkan data karyawan yang benar-benar bekerja di usahanya.</li>
          <li>Menjaga data tetap benar, dan memperbaikinya kalau ada yang salah.</li>
          <li>
            Menanggapi permintaan karyawan untuk melihat, memperbaiki, atau menghapus datanya.
          </li>
          <li>Memakai data hanya untuk urusan kerja, bukan untuk memantau di luar jam kerja.</li>
          <li>Mendapat izin orang tua atau wali untuk karyawan di bawah 18 tahun.</li>
        </ul>
        <p>Semai memproses data karyawan atas perintah owner, sesuai Kebijakan Privasi.</p>
      </>
    ),
  },
  {
    id: "paket",
    judul: "Paket, trial, dan tagihan",
    isi: (
      <>
        <h3>Paket</h3>
        <ul>
          <li>Paket Benih gratis dengan fitur dasar, untuk 1–5 karyawan.</li>
          <li>
            Paket berbayar membuka semua fitur. Harga ditentukan jumlah karyawan aktif, sesuai
            daftar di <Link href="/#paket">halaman harga</Link>.
          </li>
          <li>Bayar tahunan cukup 10 kali harga bulanan.</li>
          <li>Yang dihitung hanya karyawan aktif.</li>
        </ul>
        <h3>Trial</h3>
        <ul>
          <li>Trial semua fitur 14 hari, sekali untuk setiap usaha.</li>
          <li>
            Setelah trial habis, pilih paket berbayar atau turun ke Benih. Data di luar batas Benih
            disembunyikan, tidak dihapus.
          </li>
        </ul>
        <h3>Tagihan</h3>
        <ul>
          <li>Tagihan dibayar di muka, per bulan atau per tahun, lewat penyedia pembayaran kami.</li>
          <li>
            Naik paket di tengah periode: sisa nilai paket lama dipotong dari tagihan baru, dan
            periode baru mulai saat dibayar.
          </li>
          <li>Turun ke paket berbayar yang lebih kecil berlaku di periode tagihan berikutnya.</li>
          <li>
            Kalau jumlah karyawan aktif melewati batas paket, ada masa tenggang 14 hari untuk naik
            paket atau menonaktifkan karyawan. Setelah itu karyawan yang paling baru ditambahkan
            disembunyikan dari dashboard, tapi tetap bisa absen.
          </li>
        </ul>
        <h3>Kalau tagihan belum dibayar</h3>
        <ul>
          <li>Ada masa tenggang 7 hari sejak jatuh tempo.</li>
          <li>
            Setelah itu fitur owner jadi <strong>baca saja</strong>: data bisa dilihat, tapi tidak
            bisa diubah.
          </li>
          <li>
            <strong>Absen karyawan tetap jalan</strong> apa pun status tagihannya.
          </li>
          <li>Owner bisa pindah ke Benih tanpa melunasi tagihan.</li>
        </ul>
        <p>Harga bisa berubah. Kami beri tahu sebelum harga baru berlaku untuk perpanjanganmu.</p>
      </>
    ),
  },
  {
    id: "larangan",
    judul: "Yang tidak boleh dilakukan",
    isi: (
      <>
        <p>Saat memakai Semai, kamu tidak boleh:</p>
        <ul>
          <li>Memasukkan data orang yang bukan karyawanmu, atau data yang kamu tahu palsu.</li>
          <li>Memakai aplikasi lokasi palsu atau foto orang lain untuk absen.</li>
          <li>Memakai Semai untuk melacak, mengancam, atau melecehkan orang.</li>
          <li>Mencoba membuka data usaha lain atau melewati batas paket dengan cara curang.</li>
          <li>Membongkar, menyalin, menyerang, atau membebani sistem Semai secara berlebihan.</li>
          <li>Menjual kembali akses Semai tanpa perjanjian tertulis dengan kami.</li>
          <li>Melanggar hukum Indonesia, termasuk hukum ketenagakerjaan dan pelindungan data.</li>
        </ul>
      </>
    ),
  },
  {
    id: "penangguhan",
    judul: "Penangguhan akun",
    isi: (
      <>
        <p>Kami bisa menangguhkan akun kalau:</p>
        <ul>
          <li>Ada pelanggaran syarat ini, terutama bagian larangan.</li>
          <li>Ada tanda penipuan, akun dibobol, atau perintah dari aparat yang berwenang.</li>
          <li>Pemakaian akun membahayakan keamanan sistem atau pengguna lain.</li>
        </ul>
        <p>
          Kami jelaskan alasannya lewat email dan beri kesempatan untuk menanggapi, kecuali kalau
          harus segera ditangguhkan demi keamanan. Selama ditangguhkan, data tidak dihapus.
        </p>
      </>
    ),
  },
  {
    id: "batas-tanggung-jawab",
    judul: "Batas tanggung jawab",
    intinya:
      "Semai membantu menghitung gaji, tapi owner tetap memeriksa hasilnya sebelum gajian dikunci dan dibayar.",
    isi: (
      <>
        <ul>
          <li>
            Hitungan gaji, lembur, potongan, BPJS, PPh 21, dan THR dibuat dari data dan aturan yang
            diisi owner. <strong>Owner wajib memeriksa hasilnya</strong> sebelum gajian dikunci.
          </li>
          <li>
            Kepatuhan pada aturan ketenagakerjaan dan pajak, seperti upah minimum, lembur, dan
            pelaporan pajak, tetap tanggung jawab owner.
          </li>
          <li>
            Gajian yang sudah dikunci tidak bisa diubah. Kesalahan diperbaiki lewat penyesuaian di
            periode berikutnya.
          </li>
          <li>
            Deteksi lokasi palsu dan foto selfie adalah alat bantu, bukan jaminan. Owner tetap
            meninjau absen yang mencurigakan.
          </li>
          <li>
            Kami berusaha agar Semai selalu bisa dipakai, tapi bisa ada gangguan karena perawatan,
            jaringan, atau penyedia pihak ketiga.
          </li>
          <li>
            Sejauh diizinkan hukum, kami tidak bertanggung jawab atas kerugian tidak langsung,
            seperti kehilangan keuntungan. Total tanggung jawab kami paling banyak sebesar tagihan
            yang kamu bayar dalam 12 bulan terakhir.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "berhenti",
    judul: "Berhenti memakai Semai",
    isi: (
      <>
        <h3>Oleh owner</h3>
        <ul>
          <li>
            Owner bisa berhenti berlangganan kapan saja dengan pindah ke Benih dari halaman Paket.
            Perpindahan langsung berlaku.
          </li>
          <li>
            Untuk menghapus akun, kirim email ke {email(LEGAL.emailBantuan)} dari email yang
            terdaftar. Unduh dulu data yang ingin disimpan, seperti rekap absen dan slip gaji.
          </li>
          <li>
            Data usaha dan karyawan dihapus permanen paling lambat {LEGAL.hapusSetelahHari} hari
            setelah permintaan. Data tagihan disimpan {LEGAL.simpanTagihanTahun} tahun karena
            kewajiban pajak.
          </li>
        </ul>
        <h3>Oleh Semai</h3>
        <ul>
          <li>
            Kami bisa mengakhiri akun yang melanggar berat syarat ini, setelah penangguhan.
          </li>
          <li>
            Kalau Semai berhenti beroperasi, kami beri tahu paling lambat 30 hari sebelumnya dan
            beri kesempatan mengunduh data.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "perubahan",
    judul: "Perubahan syarat",
    isi: (
      <p>
        Kalau syarat ini berubah, kami perbarui tanggal &ldquo;Berlaku sejak&rdquo; di atas. Untuk
        perubahan penting, kami beri tahu owner lewat email atau dashboard sebelum berlaku. Kalau
        tetap memakai Semai setelah itu, kamu dianggap setuju dengan syarat yang baru.
      </p>
    ),
  },
  {
    id: "hukum",
    judul: "Hukum yang berlaku",
    isi: (
      <p>
        Syarat ini tunduk pada hukum Republik Indonesia. Kalau ada perselisihan, kita selesaikan
        dulu secara musyawarah. Kalau dalam 30 hari tidak ada kesepakatan, perselisihan
        diselesaikan di pengadilan negeri sesuai domisili {LEGAL.penyelenggara}.
      </p>
    ),
  },
  {
    id: "kontak",
    judul: "Kontak",
    isi: (
      <ul>
        <li>Bantuan: {email(LEGAL.emailBantuan)}</li>
        <li>Soal data pribadi: {email(LEGAL.emailPrivasi)}</li>
        <li>
          Surat: {LEGAL.penyelenggara}, {LEGAL.alamat}
        </li>
      </ul>
    ),
  },
];

export default function SyaratPage() {
  return (
    <DokumenLegal
      judul="Syarat & Ketentuan"
      sekarang="/syarat"
      pembuka={
        <p>
          Aturan main memakai Semai, untuk owner usaha dan karyawannya. Kami tulis sesingkat dan
          sejelas mungkin. Kalau ada yang membingungkan, tanya kami di {email(LEGAL.emailBantuan)}.
        </p>
      }
      bagian={bagian}
    />
  );
}
