# TeCloud

[![GitHub](https://img.shields.io/badge/GitHub-rizkychi%2FTeCloud-181717?logo=github)](https://github.com/rizkychi/TeCloud)

Personal cloud storage with a Google Drive–like UX: nested folders, trash/restore, share (private / public / password), admin, star/recent/versioning. Auth is **username** + **Telegram bot** deep-link for verify/reset.

**Repo:** https://github.com/rizkychi/TeCloud

**Storage drivers**
- `mock` — local filesystem under `STORAGE_PATH` (default, Coolify volume)
- `telegram` — MTProto user session (GramJS): file blobs as documents in a chat

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind
- PostgreSQL + Prisma 6
- Argon2id passwords, HttpOnly session cookies
- GramJS (`telegram`) optional MTProto storage
- Telegram Bot API for verify/reset deep-links
- Multi-stage **Dockerfile** + entrypoint (migrate → start) — Coolify-ready

## Deploy on Coolify

Repo sudah di GitHub. Di Coolify cukup connect / clone project ini.

### 1) Resources

1. **Database** → New **PostgreSQL** → salin `DATABASE_URL` (pakai SSL bila tersedia).
2. **Application** → New resource → sumber **GitHub**  
   - Repository: [`rizkychi/TeCloud`](https://github.com/rizkychi/TeCloud)  
   - Branch: `master` (atau branch yang kamu pakai)  
   - Build pack: **Dockerfile** (root `Dockerfile`, auto-detect)
3. **Domain** → pasang HTTPS domain (Coolify/Traefik). Nilai itu jadi `APP_URL`.

### 2) Environment variables

| Variable | Required | Example / notes |
|----------|----------|-----------------|
| `NODE_ENV` | yes | `production` |
| `PORT` | yes | `3000` |
| `APP_URL` | yes | `https://drive.example.com` — **harus** URL HTTPS publik yang sama dengan domain |
| `SESSION_SECRET` | yes | ≥32 random chars |
| `DATABASE_URL` | yes | dari Coolify Postgres |
| `STORAGE_DRIVER` | yes | `mock` (atau `telegram` setelah setup session) |
| `STORAGE_PATH` | yes | `/data/storage` |
| `MAX_UPLOAD_BYTES` | no | `1073741824` (1 GB) |
| `ADMIN_USERNAME` | no | bootstrap admin username (opsional) |
| `TELEGRAM_BOT_TOKEN` | no | token BotFather; kosong = deep-link di-log ke console |
| `TELEGRAM_BOT_USERNAME` | no | tanpa `@` |
| `TELEGRAM_WEBHOOK_SECRET` | no | random; dipakai validasi header webhook |
| `TELEGRAM_API_ID` / `TELEGRAM_API_HASH` / `TELEGRAM_SESSION` | no | hanya jika `STORAGE_DRIVER=telegram` |
| `TELEGRAM_STORAGE_CHAT_ID` | no | `me` (Saved Messages) / id channel / `@username` |

Lihat juga [`.env.example`](.env.example). **Jangan** commit file `.env` (sudah di-gitignore).

### 3) Persistent volume

| Coolify volume | Container path |
|----------------|----------------|
| `tecloud-storage` (nama bebas) | `/data/storage` |

Wajib untuk blob mock **dan** index Telegram (`.tg-index.json`).

### 4) Healthcheck

- Path: `GET /api/health`
- Response: `{ "status": "ok", "storage": "mock"|"telegram", "storageProbe": {...}, ... }`
- Image sudah mendefinisikan `HEALTHCHECK`; Coolify bisa pakai path yang sama.

**Boot order (entrypoint):**

1. `chown` volume storage (root → drop ke user `nextjs` via `gosu`)
2. `prisma migrate deploy`
3. `node server.js` (Next standalone di `0.0.0.0:$PORT`)

### 5) Setelah deploy pertama

```bash
# set webhook bot (jika TELEGRAM_BOT_TOKEN diisi)
curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -d "url=$APP_URL/api/telegram/webhook" \
  -d "secret_token=$TELEGRAM_WEBHOOK_SECRET"
```

Daftar user pertama lewat UI `/register`, lalu verifikasi lewat bot Telegram.

### 6) Upload besar (1 GB)

Di reverse proxy Coolify / Traefik / nginx:

- body size ≥ `1024m`
- `proxy_read_timeout` / `proxy_send_timeout` panjang (upload multi-menit)

App sudah stream upload dan enforce `MAX_UPLOAD_BYTES`.

### Cookie / HTTPS

Cookie session `Secure` hanya aktif bila **`APP_URL` diawali `https://`**.  
Kalau `APP_URL=http://…` di production, login bisa 200 tapi browser buang cookie → `/api/auth/me` = 401. Selalu set `APP_URL` ke domain HTTPS Coolify.

## Quick start (local)

```bash
git clone https://github.com/rizkychi/TeCloud.git
cd TeCloud
cp .env.example .env
# edit SESSION_SECRET (>=32 chars)
# local DB contoh: postgresql://tecloud:tecloud@localhost:5433/tecloud

docker compose up -d db          # Postgres → localhost:5433
npm install
npx prisma migrate dev
npm run dev                      # http://localhost:3000
```

Full stack mirip production:

```bash
docker compose up -d --build
# http://localhost:3000  ·  health: /api/health
```

## Storage: Telegram MTProto (opsional)

```bash
# di mesin lokal (interaktif: phone + code)
TELEGRAM_API_ID=… TELEGRAM_API_HASH=… npm run telegram:session
# tempel TELEGRAM_SESSION ke env Coolify
# STORAGE_DRIVER=telegram → redeploy
```

Env MTProto tidak lengkap → **fallback otomatis ke mock** + warning di log.

## Features

- Sign up / sign in (username) · verify + forgot password via Telegram bot
- Nested folders (depth max 32) · trash / restore · share file & folder
- Upload / download / preview · zip / unzip · star / recent · versioning
- Admin: users, kuota (GB), themes, stats
- i18n EN / ID · multi-theme

## API sketch

| Area | Endpoints |
|------|-----------|
| Auth | `/api/auth/register` · `login` · `logout` · `me` · `profile` · verify/reset |
| Drive | `GET /api/drive` · folders/files CRUD · share · download · preview · versions |
| Bulk | `POST /api/zip` · `/api/unzip` · `/api/star` |
| Bot | `POST /api/telegram/webhook` |
| Health | `GET /api/health` |

## Security notes

- Authz di server pada setiap object id (cegah IDOR)
- Password Argon2id · session token di-hash di DB
- Unlock share rate-limited · CSP / frame deny / nosniff via middleware
- Secret hanya lewat env — jangan commit `.env`

## License

MIT
