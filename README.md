# TeCloud

[![GitHub](https://img.shields.io/badge/GitHub-rizkychi%2FTeCloud-181717?logo=github)](https://github.com/rizkychi/TeCloud)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

Personal cloud storage with a Google Drive–like UX: nested folders, trash/restore, share (private / public / password), admin, star/recent/versioning. Authentication uses **username** plus a **Telegram bot** deep-link for verify/reset.

**Repository:** https://github.com/rizkychi/TeCloud

**Storage drivers**
- `mock` — local filesystem under `STORAGE_PATH` (default; Coolify volume)
- `telegram` — MTProto user session (GramJS); file blobs stored as documents in a chat

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind
- PostgreSQL + Prisma 6
- Argon2id passwords, HttpOnly session cookies
- Optional GramJS (`telegram`) MTProto storage
- Telegram Bot API for verify/reset deep-links
- Multi-stage **Dockerfile** + entrypoint (`migrate` → start) — Coolify-ready

## Deploy on Coolify

The project is on GitHub. In Coolify, connect or clone this repository.

### 1) Resources

1. **Database** → New **PostgreSQL** → copy `DATABASE_URL` (use SSL when available).
2. **Application** → New resource → **GitHub** source  
   - Repository: [`rizkychi/TeCloud`](https://github.com/rizkychi/TeCloud)  
   - Branch: `master` (or your default branch)  
   - Build pack: **Dockerfile** (root `Dockerfile`, auto-detected)
3. **Domain** → attach an HTTPS domain (Coolify/Traefik). That origin becomes `APP_URL`.

### 2) Environment variables

| Variable | Required | Example / notes |
|----------|----------|-----------------|
| `NODE_ENV` | yes | `production` |
| `PORT` | yes | `3000` |
| `APP_URL` | yes | `https://drive.example.com` — must match the public HTTPS domain |
| `SESSION_SECRET` | yes | ≥32 random characters |
| `DATABASE_URL` | yes | Coolify Postgres connection string |
| `STORAGE_DRIVER` | yes | `mock` (or `telegram` after session setup) |
| `STORAGE_PATH` | yes | `/data/storage` |
| `MAX_UPLOAD_BYTES` | no | `1073741824` (1 GB) |
| `ADMIN_USERNAME` | no | optional admin bootstrap username |
| `TELEGRAM_BOT_TOKEN` | no | BotFather token; empty = deep-links logged to console |
| `TELEGRAM_BOT_USERNAME` | no | without `@` |
| `TELEGRAM_WEBHOOK_SECRET` | no | random; validates webhook secret header |
| `TELEGRAM_API_ID` / `TELEGRAM_API_HASH` / `TELEGRAM_SESSION` | no | only when `STORAGE_DRIVER=telegram` |
| `TELEGRAM_STORAGE_CHAT_ID` | no | `me` (Saved Messages), channel id, or `@username` |

See [`.env.example`](.env.example). Do **not** commit `.env` (gitignored).

### 3) Persistent volume

| Coolify volume | Container path |
|----------------|----------------|
| `tecloud-storage` (any name) | `/data/storage` |

Required for mock blobs **and** the Telegram index file (`.tg-index.json`).

### 4) Healthcheck

- Path: `GET /api/health`
- Response: `{ "status": "ok", "storage": "mock"|"telegram", "storageProbe": {...}, ... }`
- The image defines a `HEALTHCHECK`; Coolify can use the same path.

**Boot order (entrypoint):**

1. `chown` the storage volume (root → drop to `nextjs` via `gosu`)
2. `prisma migrate deploy`
3. `node server.js` (Next standalone on `0.0.0.0:$PORT`)

### 5) After first deploy

```bash
# set bot webhook (when TELEGRAM_BOT_TOKEN is set)
curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -d "url=$APP_URL/api/telegram/webhook" \
  -d "secret_token=$TELEGRAM_WEBHOOK_SECRET"
```

Register the first user via `/register`, then verify through the Telegram bot.

### 6) Large uploads (1 GB)

On the Coolify / Traefik / nginx edge:

- body size ≥ `1024m`
- long `proxy_read_timeout` / `proxy_send_timeout` (multi-minute uploads)

The app streams uploads and enforces `MAX_UPLOAD_BYTES`.

### Cookie / HTTPS

The session cookie is `Secure` only when **`APP_URL` starts with `https://`**.  
If `APP_URL` is `http://…` in production, login may return 200 but the browser drops the cookie → `/api/auth/me` = 401. Always set `APP_URL` to the Coolify HTTPS domain.

## Quick start (local)

```bash
git clone https://github.com/rizkychi/TeCloud.git
cd TeCloud
cp .env.example .env
# set SESSION_SECRET (>=32 chars)
# local DB example: postgresql://tecloud:tecloud@localhost:5433/tecloud

docker compose up -d db          # Postgres on localhost:5433
npm install
npx prisma migrate dev
npm run dev                      # http://localhost:3000
```

Full production-like stack:

```bash
docker compose up -d --build
# http://localhost:3000  ·  health: /api/health
```

## Storage: Telegram MTProto (optional)

```bash
# on a local machine (interactive: phone + code)
TELEGRAM_API_ID=… TELEGRAM_API_HASH=… npm run telegram:session
# paste TELEGRAM_SESSION into Coolify env
# set STORAGE_DRIVER=telegram and redeploy
```

Incomplete MTProto env → automatic **fallback to mock** plus a console warning.

## Features

- Sign up / sign in (username) · verify + forgot password via Telegram bot
- Nested folders (max depth 32) · trash / restore · share file & folder
- Upload / download / preview · zip / unzip · star / recent · versioning
- Admin: users, quota (GB), themes, stats
- i18n EN / ID · multi-theme UI

## API sketch

| Area | Endpoints |
|------|-----------|
| Auth | `/api/auth/register` · `login` · `logout` · `me` · `profile` · verify/reset |
| Drive | `GET /api/drive` · folders/files CRUD · share · download · preview · versions |
| Bulk | `POST /api/zip` · `/api/unzip` · `/api/star` |
| Bot | `POST /api/telegram/webhook` |
| Health | `GET /api/health` |

## Security notes

- Server-side authorization on every object id (IDOR-safe by design)
- Argon2id passwords · session tokens hashed in the database
- Share unlock rate-limited · CSP / frame deny / nosniff via middleware
- Secrets only via environment variables — never commit `.env`

## License

[MIT](./LICENSE) © 2026 rizkychi
