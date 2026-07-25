# syntax=docker/dockerfile:1
# Multi-stage Next.js standalone image for Coolify / Docker.
# Build: docker build -t tecloud .
# Run:   see docker-compose.yml or Coolify env matrix in README.

FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
      openssl ca-certificates python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* .npmrc* ./
# postinstall runs `prisma generate` — schema must exist before npm ci
COPY prisma ./prisma
ENV DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build"
RUN npm ci

FROM node:22-bookworm-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build"
RUN npx prisma generate && npm run build

# Production node_modules (prisma CLI needed for migrate deploy at boot)
FROM node:22-bookworm-slim AS prod-deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
      openssl ca-certificates python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* .npmrc* ./
COPY prisma ./prisma
ENV DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build"
RUN npm ci --omit=dev

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV STORAGE_PATH=/data/storage

RUN apt-get update && apt-get install -y --no-install-recommends \
      openssl ca-certificates wget gosu \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

# Next standalone server + static assets
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Full prod node_modules so `npx prisma migrate deploy` works at boot
COPY --from=prod-deps /app/node_modules ./node_modules

COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh \
  && mkdir -p /data/storage \
  && chown -R nextjs:nodejs /app /data

# Start as root so entrypoint can chown Coolify-mounted volumes, then drop to nextjs
USER root
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=45s --retries=5 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
ENTRYPOINT ["/app/docker-entrypoint.sh"]
