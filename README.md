# TeCloud

TeCloud adalah aplikasi file manager berbasis web untuk upload, membaca daftar,
rename, replace, download, hapus file, akun pengguna, dashboard admin, dan link
berbagi. File fisik disimpan melalui Telegram Bot API, sementara akun, kuota,
metadata, analytics, session, OTP, dan aturan share disimpan di SQLite lokal.
Untuk deploy Coolify, simpan database SQLite di persistent volume.

## Konfigurasi Telegram

1. Buat bot lewat BotFather dan salin tokennya.
2. Tambahkan bot ke chat, group, atau channel tujuan.
3. Isi `.env.local` berdasarkan `.env.example`.

```env
TELEGRAM_BOT_TOKEN=123456:bot-token
TELEGRAM_CHAT_ID=@nama_channel_atau_chat_id
ADMIN_TELEGRAM_CHAT_ID=123456789
DEFAULT_USER_QUOTA_MB=1024
APP_BASE_URL=http://localhost:3001
DATA_DIR=./data
DATABASE_PATH=./data/tecloud.sqlite
BACKUP_DIR=./data/backups
```

Untuk channel, jadikan bot sebagai admin agar upload dan delete message bekerja.
Untuk group atau private chat, gunakan chat id numerik jika username tidak ada.
Untuk verifikasi akun, user harus pernah membuka chat dengan bot agar bot bisa
mengirim kode OTP Telegram.

User pertama otomatis menjadi admin. `ADMIN_TELEGRAM_CHAT_ID` juga bisa dipakai
agar akun dengan chat id itu mendapat role admin saat daftar.

## Menjalankan

```bash
npm ci
npm run dev
```

Build produksi:

```bash
npm run build
npm start
```

## Deploy ke Coolify

1. Push project ke repository Git.
2. Buat resource baru di Coolify dari repository tersebut.
3. Pilih build pack Dockerfile.
4. Tambahkan environment variable dari `coolify.example.env`.
5. Tambahkan persistent storage:

```text
/app/data
```

6. Set domain aplikasi dan isi `APP_BASE_URL` dengan domain tersebut.
7. Deploy.

Container memakai:

```text
PORT=3000
HOSTNAME=0.0.0.0
DATA_DIR=/app/data
DATABASE_PATH=/app/data/tecloud.sqlite
BACKUP_DIR=/app/data/backups
```

Coolify akan memakai Docker `HEALTHCHECK` yang memanggil:

```text
/api/health
```

Jika healthcheck gagal, cek env wajib, akses SQLite, dan mount persistent
storage `/app/data`.

## Fitur utama

- Sign up, sign in, sign out, forgot password, dan reset password.
- Verifikasi akun serta reset password memakai kode OTP dari bot Telegram.
- Session cookie HTTP-only dan password PBKDF2-SHA256 dengan salt.
- CSRF token untuk request mutasi dan rate limit berbasis IP.
- File per akun dengan pemeriksaan owner/admin di setiap route.
- Kuota storage per user dan pembatasan upload/replace saat kuota habis.
- Upload dan replace dibatasi di bawah 2 GB per file sesuai batas Telegram.
- Dashboard admin untuk melihat user, total file, storage, download, activity,
  mengubah role, status, dan kuota akun.
- Share file mode privat, public, dan public dengan password.
- Public share page di `/share/:token`.
- Download count dan activity log untuk analytics dasar.
- Progress upload di browser untuk upload/replace.
- Healthcheck endpoint untuk container/Coolify.

## Backup SQLite

Jalankan backup manual:

```bash
npm run backup
```

Script akan membuat checkpoint WAL lalu menyalin database ke `BACKUP_DIR`.
Di Coolify, kamu bisa membuat scheduled task dengan command yang sama.

## Keamanan Produksi

- Semua aksi mutasi memakai header `x-csrf-token`.
- Login, signup, OTP, upload, admin update, dan public download diberi rate
  limit berbasis IP.
- Public file dengan password menyimpan password sebagai hash, bukan plaintext.
- `/api/health` memeriksa env wajib dan koneksi SQLite.

## Catatan storage

Telegram Bot API tidak menyediakan fitur membaca seluruh riwayat file dari chat.
Karena itu TeCloud menyimpan indeks metadata sendiri di SQLite. Dokumen tetap
berada di Telegram dan operasi download memakai `file_id` dari Telegram.

Untuk upload besar, pastikan proxy di depan Coolify mengizinkan body besar.
Aplikasi menolak file `>= 2 GB`, tetapi reverse proxy/server juga harus
dikonfigurasi agar tidak memotong request sebelum sampai ke aplikasi.

Contoh konsep konfigurasi proxy:

```text
client_max_body_size 2g
proxy_request_buffering off
```

Nama setting persisnya mengikuti reverse proxy yang dipakai Coolify di servermu.
