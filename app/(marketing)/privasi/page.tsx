import type { Metadata } from "next";
import Link from "next/link";
import { LEGAL, MASA_SIMPAN } from "@/lib/legal";
import { type BagianLegal, DokumenLegal } from "../_components/dokumen-legal";

export const metadata: Metadata = {
  title: "Kebijakan Privasi",
  description: "Data apa yang dikumpulkan Semai, untuk apa, berapa lama disimpan, dan hak kamu atas data itu.",
};

const email = (alamat: string) => <a href={`mailto:${alamat}`}>{alamat}</a>;

const bagian: BagianLegal[] = [
  {
    id: "peran",
    judul: "Siapa bertanggung jawab atas data",
    intinya:
      "Owner usaha memutuskan data karyawannya dipakai untuk apa. Semai menyimpan dan memprosesnya atas perintah owner.",
    isi: (
      <>
        <p>
          Kebijakan ini mengikuti Undang-Undang No. 27 Tahun 2022 tentang Pelindungan Data Pribadi
          (UU PDP). Di sana ada dua peran yang perlu kamu tahu:
        </p>
        <ul>
          <li>
            <strong>Owner usaha adalah pengendali data</strong> untuk data karyawannya. Owner yang
            menentukan siapa yang diundang, berapa gajinya, dan di mana lokasi absennya.
          </li>
          <li>
            <strong>Semai adalah pemroses data</strong> untuk data karyawan. Kami hanya
            memprosesnya untuk menjalankan layanan yang dipakai owner, bukan untuk kepentingan kami
            sendiri.
          </li>
          <li>
            Untuk data akun owner dan data tagihan, <strong>Semai adalah pengendali data</strong>.
          </li>
        </ul>
        <p>
          Layanan Semai diselenggarakan oleh {LEGAL.penyelenggara}, beralamat di {LEGAL.alamat}.
        </p>
      </>
    ),
  },
  {
    id: "data",
    judul: "Data yang kami kumpulkan",
    isi: (
      <>
        <h3>Akun owner dan admin</h3>
        <ul>
          <li>Nama, email, dan nomor WhatsApp.</li>
          <li>Password (disimpan dalam bentuk acak, tidak bisa dibaca siapa pun) atau akun Google.</li>
          <li>Profil usaha: nama, bidang, kota, zona waktu, dan jawaban saat pendaftaran.</li>
        </ul>
        <h3>Data karyawan (diisi owner)</h3>
        <ul>
          <li>Nama, nomor HP, jabatan, dan status aktif.</li>
          <li>Gaji pokok, tunjangan, potongan, lembur, kasbon, dan slip gaji.</li>
          <li>Jadwal kerja, shift, cuti, dan izin (di paket berbayar).</li>
          <li>PIN login, disimpan dalam bentuk acak.</li>
        </ul>
        <h3>Saat absen</h3>
        <ul>
          <li>
            <strong>Foto selfie</strong> saat absen masuk dan pulang, dikompres di HP sebelum
            dikirim.
          </li>
          <li>
            <strong>Lokasi GPS</strong> hanya saat menekan tombol absen, bukan dilacak terus
            menerus.
          </li>
          <li>Waktu absen dari server kami, bukan dari jam HP.</li>
          <li>Tanda lokasi palsu, kalau terdeteksi.</li>
        </ul>
        <h3>Tagihan</h3>
        <ul>
          <li>
            Paket, periode, nominal, status bayar, dan metode bayar. Nomor kartu dan rekening
            diproses langsung oleh penyedia pembayaran, tidak kami simpan.
          </li>
        </ul>
        <h3>Data teknis</h3>
        <ul>
          <li>
            Catatan login (untuk membatasi percobaan PIN yang salah), token notifikasi untuk
            pengingat absen, dan catatan perubahan data penting (koreksi absen, perubahan gaji,
            akses tim Semai).
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "tujuan",
    judul: "Untuk apa data dipakai",
    intinya: "Hanya untuk menjalankan absen, gajian, dan tagihan. Kami tidak menjual data dan tidak memakainya untuk iklan.",
    isi: (
      <>
        <ul>
          <li>Mencatat absen dan memastikan karyawan benar ada di lokasi kerja.</li>
          <li>Menghitung gaji, lembur, potongan, dan kasbon, lalu membuat slip gaji.</li>
          <li>Mengirim pengingat absen, email verifikasi, dan pemberitahuan tagihan.</li>
          <li>Memproses pembayaran langganan.</li>
          <li>Menjaga keamanan akun dan mencegah penyalahgunaan.</li>
          <li>Membantu owner saat minta bantuan teknis.</li>
          <li>
            Mengukur pemakaian secara agregat (misalnya jumlah absen per hari) untuk memperbaiki
            layanan, tanpa melihat isi data pribadi.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "dasar",
    judul: "Dasar pemrosesan",
    isi: (
      <>
        <p>Sesuai Pasal 20 UU PDP, kami memproses data berdasarkan:</p>
        <ul>
          <li>
            <strong>Perjanjian</strong> dengan owner, yaitu Syarat & Ketentuan Semai, untuk akun
            owner, data usaha, dan tagihan.
          </li>
          <li>
            <strong>Persetujuan karyawan</strong> saat aktivasi akun, untuk foto selfie dan lokasi
            GPS saat absen. Owner juga wajib memberi tahu karyawan sebelum mengundang mereka.
          </li>
          <li>
            <strong>Kewajiban hukum</strong>, misalnya menyimpan data tagihan untuk keperluan pajak.
          </li>
          <li>
            <strong>Kepentingan yang sah</strong>, misalnya mencegah penipuan dan menjaga keamanan
            sistem.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "masa-simpan",
    judul: "Berapa lama data disimpan",
    isi: (
      <>
        <ul>
          <li>
            <strong>Foto absen</strong>: {MASA_SIMPAN.fotoBenih} di paket Benih,{" "}
            {MASA_SIMPAN.fotoBerbayar} di paket berbayar. Setelah itu dihapus otomatis. Catatan
            jam absennya tetap ada.
          </li>
          <li>
            <strong>Riwayat absen</strong>: {MASA_SIMPAN.riwayatBenih} terakhir yang bisa dilihat
            di paket Benih, {MASA_SIMPAN.riwayatBerbayar} di paket berbayar.
          </li>
          <li>
            <strong>Data gajian dan slip gaji</strong>: selama akun usaha aktif.
          </li>
          <li>
            <strong>Data di atas batas paket</strong> (misalnya setelah trial berakhir):
            disembunyikan, tidak dihapus, dan muncul lagi setelah upgrade.
          </li>
          <li>
            <strong>Akun Benih yang tidak dipakai</strong>: kami kirim email peringatan setelah 60
            hari, dan akun diarsipkan setelah 90 hari.
          </li>
          <li>
            <strong>Setelah owner menghapus akun</strong>: semua data usaha dan karyawan dihapus
            permanen paling lambat {LEGAL.hapusSetelahHari} hari setelah permintaan. Data tagihan
            disimpan {LEGAL.simpanTagihanTahun} tahun karena kewajiban pajak.
          </li>
          <li>
            <strong>Karyawan yang dinonaktifkan</strong>: datanya tetap disimpan owner untuk
            keperluan gajian dan arsip. Karyawan bisa minta owner menghapusnya.
          </li>
        </ul>
        <p>Salinan di cadangan database harian ikut hilang saat cadangan lama diganti yang baru.</p>
      </>
    ),
  },
  {
    id: "pihak-ketiga",
    judul: "Pihak ketiga yang kami pakai",
    intinya: `Data disimpan di server ${LEGAL.lokasiServer}. Kami hanya memakai penyedia yang dibutuhkan untuk menjalankan layanan.`,
    isi: (
      <>
        <ul>
          <li>
            <strong>Supabase</strong>: database, login, dan penyimpanan foto. Server di{" "}
            {LEGAL.lokasiServer}.
          </li>
          <li>
            <strong>Vercel</strong>: hosting aplikasi. Halaman bisa dilayani dari server terdekat
            dengan pengguna.
          </li>
          <li>
            <strong>Midtrans</strong>: pembayaran langganan. Hanya menerima data tagihan owner,
            tidak menerima data karyawan.
          </li>
          <li>
            <strong>Google</strong>: login dengan akun Google, kalau owner memilihnya.
          </li>
          <li>
            <strong>Layanan email transaksional</strong>: email verifikasi, reset password, dan
            tagihan.
          </li>
          <li>
            <strong>WhatsApp Cloud API (Meta)</strong>: hanya di paket berbayar, untuk mengirim
            slip gaji dan ringkasan ke nomor WA yang didaftarkan owner. Akun Benih tidak memakai
            layanan ini.
          </li>
          <li>
            <strong>Peta OpenStreetMap</strong>: menampilkan peta lokasi absen. Koordinat tidak
            dikirim ke penyedia peta selain untuk memuat gambar peta di sekitar lokasi.
          </li>
        </ul>
        <h3>Transfer ke luar Indonesia</h3>
        <p>
          Karena server utama ada di {LEGAL.lokasiServer}, data dikirim ke luar wilayah Indonesia.
          Sesuai Pasal 56 UU PDP, kami hanya memakai penyedia yang punya perlindungan data setara
          atau lebih tinggi, terikat perjanjian pemrosesan data, dan memakai enkripsi.
        </p>
        <p>
          Kami tidak menjual atau menyewakan data pribadi. Data hanya kami serahkan ke aparat
          kalau diwajibkan oleh hukum.
        </p>
      </>
    ),
  },
  {
    id: "akses-tim",
    judul: "Akses tim Semai",
    intinya: "Tim Semai tidak bisa melihat foto, lokasi, atau gaji karyawan tanpa izin dari owner.",
    isi: (
      <>
        <ul>
          <li>
            Tim Semai hanya melihat data yang dibutuhkan untuk mengelola akun, seperti nama usaha,
            paket, dan status tagihan.
          </li>
          <li>
            Untuk melihat <strong>foto absen, lokasi, atau nominal gaji</strong>, owner harus
            memberi izin dari dashboard: pilih data apa yang boleh dibuka dan alasannya.
          </li>
          <li>Izin berlaku paling lama 24 jam dan bisa dicabut owner kapan saja.</li>
          <li>Setiap akses tercatat: siapa, kapan, dan data apa yang dibuka.</li>
        </ul>
      </>
    ),
  },
  {
    id: "hak",
    judul: "Hak kamu dan cara mengajukannya",
    isi: (
      <>
        <p>Sesuai UU PDP, kamu berhak:</p>
        <ul>
          <li>
            <strong>Mengakses</strong> dan mendapat salinan data pribadimu.
          </li>
          <li>
            <strong>Memperbaiki</strong> data yang salah atau tidak lengkap.
          </li>
          <li>
            <strong>Menghapus</strong> data pribadimu.
          </li>
          <li>
            <strong>Menarik persetujuan</strong>, misalnya untuk foto dan lokasi saat absen. Kalau
            persetujuan ditarik, kamu tidak bisa absen lewat Semai. Atur cara absen lain dengan
            owner.
          </li>
          <li>
            <strong>Membatasi atau menolak</strong> pemrosesan tertentu, dan mengajukan keberatan.
          </li>
        </ul>
        <h3>Kalau kamu owner</h3>
        <p>
          Sebagian besar data bisa kamu lihat dan ubah langsung di dashboard. Untuk salinan data,
          hapus akun, atau permintaan lain, kirim email ke {email(LEGAL.emailPrivasi)} dari email
          yang terdaftar.
        </p>
        <h3>Kalau kamu karyawan</h3>
        <p>
          Ajukan dulu ke owner tempatmu bekerja, karena owner yang mengendalikan datamu. Owner
          bisa memperbaiki atau menghapus data dari dashboard. Kalau owner tidak menanggapi, kirim
          email ke {email(LEGAL.emailPrivasi)} dengan nama usaha dan nomor HP-mu. Kami akan
          meneruskan ke owner dan membantu prosesnya.
        </p>
        <p>
          Kami memproses permintaan sesuai batas waktu UU PDP, umumnya paling lambat 3 × 24 jam
          sejak permintaan lengkap. Kami mungkin meminta bukti bahwa kamu pemilik data.
        </p>
      </>
    ),
  },
  {
    id: "keamanan",
    judul: "Keamanan",
    isi: (
      <ul>
        <li>Data tiap usaha terpisah di database. Owner satu usaha tidak bisa melihat data usaha lain.</li>
        <li>Koneksi selalu terenkripsi (HTTPS).</li>
        <li>Foto absen disimpan di penyimpanan privat dan hanya dibuka lewat link sementara.</li>
        <li>Password dan PIN disimpan dalam bentuk acak. Login karyawan dikunci 15 menit setelah 5 kali salah PIN.</li>
        <li>Koreksi absen dan perubahan gaji wajib punya alasan dan tercatat.</li>
        <li>Database dicadangkan setiap hari.</li>
      </ul>
    ),
  },
  {
    id: "kebocoran",
    judul: "Kalau terjadi kebocoran data",
    isi: (
      <p>
        Kalau terjadi kegagalan pelindungan data, kami memberi tahu owner yang terdampak dan
        lembaga yang berwenang paling lambat 3 × 24 jam setelah mengetahuinya, sesuai Pasal 46 UU
        PDP. Pemberitahuan berisi data apa yang terungkap, kapan dan bagaimana terjadinya, serta
        langkah yang sudah kami ambil. Kami membantu owner memberi tahu karyawannya.
      </p>
    ),
  },
  {
    id: "anak",
    judul: "Pengguna di bawah umur",
    isi: (
      <p>
        Akun owner hanya untuk orang berusia 18 tahun ke atas. Kalau owner mempekerjakan karyawan
        di bawah 18 tahun, owner wajib mendapat persetujuan orang tua atau wali sebelum
        mengundangnya ke Semai.
      </p>
    ),
  },
  {
    id: "perubahan",
    judul: "Perubahan kebijakan",
    isi: (
      <p>
        Kalau kebijakan ini berubah, kami perbarui tanggal &ldquo;Berlaku sejak&rdquo; di atas.
        Untuk perubahan penting, kami memberi tahu owner lewat email atau dashboard paling lambat
        14 hari sebelum berlaku.
      </p>
    ),
  },
  {
    id: "kontak",
    judul: "Kontak",
    isi: (
      <>
        <p>Pertanyaan atau permintaan soal data pribadi:</p>
        <ul>
          <li>Email privasi: {email(LEGAL.emailPrivasi)}</li>
          <li>Bantuan umum: {email(LEGAL.emailBantuan)}</li>
          <li>
            Surat: {LEGAL.penyelenggara}, {LEGAL.alamat}
          </li>
        </ul>
        <p>
          Baca juga <Link href="/syarat">Syarat &amp; Ketentuan</Link>.
        </p>
      </>
    ),
  },
];

export default function PrivasiPage() {
  return (
    <DokumenLegal
      judul="Kebijakan Privasi"
      sekarang="/privasi"
      pembuka={
        <p>
          Semai mencatat absen dan menghitung gaji, jadi kami memegang data yang penting bagi owner
          dan karyawan. Halaman ini menjelaskan data apa yang kami kumpulkan, untuk apa, berapa
          lama disimpan, dan apa hak kamu, dengan bahasa sesederhana mungkin.
        </p>
      }
      bagian={bagian}
    />
  );
}
