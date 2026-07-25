-- Idempotent apply for environments that already marked
-- 20260724150000_username_telegram_auth as applied while it was a no-op comment.
-- Safe to run on DBs that already have username columns.

DO $$ BEGIN
  CREATE TYPE "AuthTokenType" AS ENUM ('verify_account', 'reset_password');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "username" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "telegramId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "verifiedAt" TIMESTAMP(3);

-- Backfill from email when column still exists
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'User' AND column_name = 'email'
  ) THEN
    UPDATE "User"
    SET "username" = lower(regexp_replace(split_part("email", '@', 1), '[^a-z0-9_]', '_', 'g'))
    WHERE "username" IS NULL;
  END IF;
END $$;

UPDATE "User"
SET "username" = 'user_' || substr(md5(random()::text || id), 1, 12)
WHERE "username" IS NULL OR btrim("username") = '';

WITH d AS (
  SELECT id, "username",
    ROW_NUMBER() OVER (PARTITION BY "username" ORDER BY "createdAt") AS rn
  FROM "User"
)
UPDATE "User" u
SET "username" = left(u."username", 24) || '_' || substr(u.id, greatest(1, length(u.id) - 5))
FROM d
WHERE u.id = d.id AND d.rn > 1;

DO $$ BEGIN
  ALTER TABLE "User" ALTER COLUMN "username" SET NOT NULL;
EXCEPTION
  WHEN others THEN null;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "User_username_key" ON "User"("username");
CREATE UNIQUE INDEX IF NOT EXISTS "User_telegramId_key" ON "User"("telegramId");

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'User' AND column_name = 'emailVerifiedAt'
  ) THEN
    UPDATE "User" SET "verifiedAt" = "emailVerifiedAt"
    WHERE "verifiedAt" IS NULL AND "emailVerifiedAt" IS NOT NULL;
  END IF;
END $$;

DROP INDEX IF EXISTS "User_email_key";
ALTER TABLE "User" DROP COLUMN IF EXISTS "email";
ALTER TABLE "User" DROP COLUMN IF EXISTS "emailVerifiedAt";

CREATE TABLE IF NOT EXISTS "AuthToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "AuthTokenType" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuthToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AuthToken_tokenHash_key" ON "AuthToken"("tokenHash");
CREATE INDEX IF NOT EXISTS "AuthToken_userId_type_idx" ON "AuthToken"("userId", "type");
CREATE INDEX IF NOT EXISTS "AuthToken_expiresAt_idx" ON "AuthToken"("expiresAt");

DO $$ BEGIN
  ALTER TABLE "AuthToken" ADD CONSTRAINT "AuthToken_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DROP TABLE IF EXISTS "EmailToken";
DROP TYPE IF EXISTS "EmailTokenType";
