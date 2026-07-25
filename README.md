# TeCloud

Personal cloud storage with a Google Drive-like UX. Nested folders, trash/restore, share (private / public / password), admin, star/recent/versioning. Auth: username + Telegram bot deep-link for verify/reset.

**Storage drivers**
- `mock` — local filesystem under `STORAGE_PATH` (default)
- `telegram` — MTProto user session (GramJS): blobs as documents in a chat

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind
- PostgreSQL + Prisma 6
- Argon2id passwords, HttpOnly session cookies
- GramJS (`telegram`) optional MTProto storage
- Telegram Bot API for verify/reset deep-links
- Docker multi-stage + Coolify-ready entrypoint

## Quick start (local dev)

```bash
git clone <your-repo-url> tecloud && cd tecloud
cp .env.example .env
# edit SESSION_SECRET (>=32 chars)

docker compose up -d db          # Postgres on localhost:5433
npm install
npx prisma migrate dev
npm run dev                      # http://localhost:3000
```

Or full prod-like stack:

```bash
docker compose up -d --build
# http://localhost:3000  ·  health: /api/health
```

## Deploy on Coolify (GitHub clone)

### 1) Push this repo to GitHub

```bash
git init
git add .
git commit -m "Initial TeCloud"
# create empty repo on GitHub, then:
git remote add origin git@github.com:<you>/tecloud.git
git branch -M main
git push -u origin main
```

Do **not** commit `.env` (gitignored). Only `.env.example` is tracked.

### 2) Coolify resources

1. **Database** → New PostgreSQL → copy connection URL (`DATABASE_URL`). Prefer SSL if Coolify offers it.
2. **Application** → New resource → **Dockerfile** (root `Dockerfile`).
   - Connect the GitHub repo (or public clone URL).
   - Build pack: Dockerfile (auto-detected).
3. **Domain** → attach HTTPS domain (Coolify/Traefik). Set that origin as `APP_URL`.

### 3) Environment variables

| Variable | Required | Example / notes |
|----------|----------|-----------------|
| `NODE_ENV` | yes | `production` |
| `PORT` | yes | `3000` |
| `APP_URL` | yes | `https://drive.example.com` (must match public HTTPS) |
| `SESSION_SECRET` | yes | ≥32 random chars |
| `DATABASE_URL` | yes | from Coolify Postgres |
| `STORAGE_DRIVER` | yes | `mock` (or `telegram` after session setup) |
| `STORAGE_PATH` | yes | `/data/storage` |
| `MAX_UPLOAD_BYTES` | no | `1073741824` (1 GB) |
| `ADMIN_USERNAME` | no | first matching user becomes admin bootstrap if used |
| `TELEGRAM_BOT_TOKEN` | no | BotFather token; empty = mock console links |
| `TELEGRAM_BOT_USERNAME` | no | without `@` |
| `TELEGRAM_WEBHOOK_SECRET` | no | random; required for webhook header check in prod |
| `TELEGRAM_API_ID` / `HASH` / `SESSION` | no | only if `STORAGE_DRIVER=telegram` |
| `TELEGRAM_STORAGE_CHAT_ID` | no | `me` or channel id |

### 4) Persistent storage

Mount a volume:

| Host / Coolify volume | Container path |
|-----------------------|----------------|
| `tecloud-storage` | `/data/storage` |

Needed for mock blobs **and** Telegram index file (`.tg-index.json`).

### 5) Healthcheck

- Path: `GET /api/health`
- Expect JSON `{ "status": "ok", "storage": "mock"|"telegram", ... }`
- Image already defines `HEALTHCHECK`; Coolify can use the same path.

Container boot order (entrypoint):

1. `chown` storage volume (root → drop to `nextjs` via `gosu`)
2. `prisma migrate deploy`
3. `node server.js` (Next standalone on `0.0.0.0:$PORT`)

### 6) After first deploy

```bash
# set Telegram webhook (if bot enabled)
curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -d "url=$APP_URL/api/telegram/webhook" \
  -d "secret_token=$TELEGRAM_WEBHOOK_SECRET"
```

Register first user in the UI, or use an existing admin username from `ADMIN_USERNAME`.

### 7) Large uploads (1 GB)

On the Coolify/Traefik/nginx edge:

- body size ≥ 1024m
- long proxy read/send timeouts (multi-minute uploads)

App already streams uploads and enforces `MAX_UPLOAD_BYTES`.

### Cookie / HTTPS gotcha

Session cookie `Secure` is set only when **`APP_URL` starts with `https://`**.  
If `APP_URL` is `http://…` while `NODE_ENV=production`, login may return 200 but the browser drops the cookie → `/api/auth/me` = 401. Always use public HTTPS `APP_URL` in Coolify.

## Storage: Telegram MTProto (optional)

```bash
# local machine (interactive)
TELEGRAM_API_ID=… TELEGRAM_API_HASH=… npm run telegram:session
# paste TELEGRAM_SESSION into Coolify env, set STORAGE_DRIVER=telegram, redeploy
```

Incomplete MTProto env → automatic **fallback to mock** + console warning.

## Features

- Sign up / sign in (username) · Telegram verify + forgot password
- Nested folders (depth 32) · trash/restore · share file/folder
- Upload/download/preview · zip/unzip · star/recent · versioning
- Admin: users, quota (GB), themes, stats
- i18n EN/ID · multi-theme

## API sketch

- Auth: `/api/auth/*` · Drive: `/api/drive` · Files/folders CRUD + share
- `POST /api/zip` · `/api/unzip` · `/api/star`
- `POST /api/telegram/webhook`
- `GET /api/health`

## Security notes

- Server-side authz on every object id (IDOR-safe by design)
- Argon2id passwords · hashed session tokens in DB
- Share unlock rate-limited · CSP / frame deny / nosniff via middleware
- Secrets only via env — never commit `.env`

## License

MIT
