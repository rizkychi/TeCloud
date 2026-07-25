#!/bin/sh
set -e

STORAGE_DIR="${STORAGE_PATH:-/data/storage}"
PORT_NUM="${PORT:-3000}"

# Coolify/Docker often mount volumes as root. Fix ownership then drop privileges.
if [ "$(id -u)" = "0" ]; then
  mkdir -p "$STORAGE_DIR"
  chown -R nextjs:nodejs "$STORAGE_DIR" 2>/dev/null || true
  # re-exec as nextjs for migrate + server
  exec gosu nextjs "$0" "$@"
fi

echo "[tecloud] prisma migrate deploy..."
if ! npx prisma migrate deploy; then
  echo "[tecloud] ERROR: migrate failed — check DATABASE_URL and that migrations are in the image" >&2
  exit 1
fi

echo "[tecloud] storage path: $STORAGE_DIR"
mkdir -p "$STORAGE_DIR"

echo "[tecloud] starting on 0.0.0.0:${PORT_NUM} (HOSTNAME=${HOSTNAME:-0.0.0.0})"
# Next standalone output places server.js at workdir root
if [ -f "./server.js" ]; then
  exec node server.js
fi

exec npx next start -H 0.0.0.0 -p "$PORT_NUM"
