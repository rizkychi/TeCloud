import { z } from "zod";

/** empty env strings → undefined so optional() works with KEY= in .env */
const emptyToUndef = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters"),
  DATABASE_URL: z.string().min(1),
  STORAGE_DRIVER: z.enum(["mock", "telegram"]).default("mock"),
  STORAGE_PATH: z.string().default("./data/storage"),
  MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(1073741824),
  DEFAULT_QUOTA_BYTES: z.coerce.number().int().positive().default(5 * 1024 * 1024 * 1024),
  ADMIN_USERNAME: z.preprocess(emptyToUndef, z.string().min(3).max(32).optional()),
  // Bot (verify/reset) — separate from MTProto user session for storage
  TELEGRAM_BOT_TOKEN: z.preprocess(emptyToUndef, z.string().min(10).optional()),
  TELEGRAM_BOT_USERNAME: z.preprocess(
    emptyToUndef,
    z.string().min(3).max(64).default("TeCloudBot"),
  ),
  TELEGRAM_WEBHOOK_SECRET: z.preprocess(emptyToUndef, z.string().min(8).optional()),
  // MTProto storage (user account)
  TELEGRAM_API_ID: z.preprocess(emptyToUndef, z.coerce.number().int().positive().optional()),
  TELEGRAM_API_HASH: z.preprocess(emptyToUndef, z.string().min(8).optional()),
  TELEGRAM_SESSION: z.preprocess(emptyToUndef, z.string().min(10).optional()),
  TELEGRAM_STORAGE_CHAT_ID: z.preprocess(
    emptyToUndef,
    z.string().min(1).max(64).default("me"),
  ),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid environment: ${msg}`);
  }
  cached = parsed.data;
  return cached;
}

/** Clear cache after tests / hot env reload */
export function resetEnvCache() {
  cached = null;
}
