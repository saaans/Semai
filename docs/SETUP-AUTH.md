# Pengaturan auth owner (Supabase)

Langkah sekali jalan di Supabase Dashboard supaya registrasi dan login owner berjalan.

## 1. Migration

Jalankan semua file di `supabase/migrations/` (`supabase db push` atau SQL Editor).
Migration `20261001010000_registrasi_owner.sql` menambah RPC `ensure_owner_company()`.

## 2. URL

**Authentication → URL Configuration**

- **Site URL**: URL produksi, misalnya `https://semai.id`
- **Redirect URLs**: tambahkan
  - `http://localhost:3000/auth/callback`
  - `https://semai.id/auth/callback`
  - URL preview Vercel kalau perlu, misalnya `https://*-semai.vercel.app/auth/callback`

Isi `NEXT_PUBLIC_SITE_URL` di `.env.local` / Vercel dengan URL yang sama (boleh kosong di lokal).

## 3. Email + password

**Authentication → Providers → Email**

- Enable Email provider: aktif
- **Confirm email: aktif** (wajib, owner harus verifikasi email sebelum bisa masuk)
- Minimum password length: 8

### Template email (disarankan)

Tautan bawaan Supabase memakai PKCE dan hanya berhasil kalau dibuka di browser yang
sama dengan saat daftar. Owner sering daftar di laptop lalu buka email di HP, jadi ubah
template supaya memakai `token_hash`:

**Authentication → Email Templates → Confirm signup**

```html
<h2>Aktifkan akun Semai kamu</h2>
<p>Klik tautan di bawah untuk verifikasi email dan mulai menyiapkan usahamu.</p>
<p><a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=signup">Verifikasi email</a></p>
```

**Reset Password**

```html
<h2>Atur ulang password Semai</h2>
<p>Klik tautan di bawah untuk membuat password baru. Abaikan email ini kalau kamu tidak memintanya.</p>
<p><a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery">Buat password baru</a></p>
```

`/auth/callback` menerima dua bentuk tautan (`?code=` dan `?token_hash=`), jadi template
bawaan tetap jalan selama dibuka di perangkat yang sama.

Untuk produksi, pakai SMTP sendiri (**Project Settings → Auth → SMTP**). SMTP bawaan
Supabase dibatasi beberapa email per jam.

## 4. Google

1. Google Cloud Console → APIs & Services → Credentials → **OAuth client ID** (Web application)
2. Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`
3. Salin Client ID dan Client Secret ke **Authentication → Providers → Google** di Supabase

Client Secret hanya disimpan di Supabase, tidak di repo.

## 5. Super admin

Flag `is_platform_admin` hanya bisa diubah lewat SQL:

```sql
update public.profiles set is_platform_admin = true
where id = (select id from auth.users where email = 'nama@semai.id');
```

## Alur

```
/daftar (email)  → signUp → /verifikasi → klik tautan → /auth/callback → /auth/lanjut
/daftar (Google) → Google → /auth/callback → /auth/lanjut
/masuk           → /auth/lanjut

/auth/lanjut:
  akun karyawan               → /app
  super admin tanpa usaha     → /admin
  owner baru                  → ensure_owner_company() (usaha kosong + role owner)
  belum ada nomor WA (Google) → /lengkapi-wa
  onboarding belum selesai    → /owner/onboarding
  selain itu                  → /owner (atau ?next=)
```

## Cek dua akun (RLS)

1. Daftar owner A dan owner B.
2. Login sebagai B, buka SQL lewat client (atau DevTools) `select * from companies`. Hanya usaha B yang muncul.
3. B mencoba `update companies set name = 'x' where id = '<id usaha A>'`. Hasilnya 0 baris.
