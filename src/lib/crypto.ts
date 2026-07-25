import { createHash, randomBytes, timingSafeEqual } from "crypto";
import * as argon2 from "argon2";

/** Support both CJS named exports and ESM default interop from native addon */
const argon = (argon2 as unknown as { default?: typeof argon2 }).default ?? argon2;

export async function hashPassword(password: string): Promise<string> {
  return argon.hash(password, { type: argon.argon2id });
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon.verify(hash, password);
  } catch {
    return false;
  }
}

export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
