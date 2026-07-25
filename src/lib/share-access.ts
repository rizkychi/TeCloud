import { cookies } from "next/headers";
import { createHash } from "crypto";
import { prisma } from "./db";
import { generateToken, hashToken, verifyPassword } from "./crypto";
import { getEnv } from "./env";

export const SHARE_GRANT_COOKIE = "tecloud_share_grant";

export type ShareTarget =
  | { kind: "file"; id: string; name: string; mimeType: string; size: number; visibility: string; ownerId: string }
  | { kind: "folder"; id: string; name: string; visibility: string; ownerId: string };

export async function findByShareToken(token: string) {
  const file = await prisma.fileObject.findFirst({
    where: { shareToken: token, deletedAt: null, visibility: { in: ["public", "password"] } },
  });
  if (file) {
    return {
      kind: "file" as const,
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      size: Number(file.size),
      visibility: file.visibility,
      ownerId: file.ownerId,
      sharePasswordHash: file.sharePasswordHash,
      storageKey: file.storageKey,
    };
  }
  const folder = await prisma.folder.findFirst({
    where: { shareToken: token, deletedAt: null, visibility: { in: ["public", "password"] } },
  });
  if (folder) {
    return {
      kind: "folder" as const,
      id: folder.id,
      name: folder.name,
      visibility: folder.visibility,
      ownerId: folder.ownerId,
      sharePasswordHash: folder.sharePasswordHash,
    };
  }
  return null;
}

function grantValue(token: string, secret: string) {
  return createHash("sha256").update(`${token}:${secret}`).digest("hex");
}

export async function setShareGrant(shareToken: string) {
  const secret = getEnv().SESSION_SECRET;
  const jar = await cookies();
  const value = grantValue(shareToken, secret);
  jar.set(`${SHARE_GRANT_COOKIE}_${hashToken(shareToken).slice(0, 12)}`, value, {
    httpOnly: true,
    secure: getEnv().APP_URL.startsWith("https://"),
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60, // 1h
  });
}

export async function hasShareGrant(shareToken: string): Promise<boolean> {
  const secret = getEnv().SESSION_SECRET;
  const jar = await cookies();
  const cookie = jar.get(`${SHARE_GRANT_COOKIE}_${hashToken(shareToken).slice(0, 12)}`)?.value;
  if (!cookie) return false;
  return cookie === grantValue(shareToken, secret);
}

export async function canAccessShare(shareToken: string) {
  const target = await findByShareToken(shareToken);
  if (!target) return { ok: false as const, reason: "NOT_FOUND" as const };
  if (target.visibility === "public") {
    return { ok: true as const, target, needsPassword: false };
  }
  if (target.visibility === "password") {
    const granted = await hasShareGrant(shareToken);
    if (granted) return { ok: true as const, target, needsPassword: false };
    return { ok: false as const, reason: "PASSWORD_REQUIRED" as const, target };
  }
  return { ok: false as const, reason: "FORBIDDEN" as const };
}

export async function unlockShare(shareToken: string, password: string) {
  const target = await findByShareToken(shareToken);
  if (!target) throw new Error("NOT_FOUND");
  if (target.visibility !== "password" || !target.sharePasswordHash) {
    throw new Error("NOT_PASSWORD_PROTECTED");
  }
  const ok = await verifyPassword(target.sharePasswordHash, password);
  if (!ok) throw new Error("INVALID_PASSWORD");
  await setShareGrant(shareToken);
  return target;
}

export function newShareToken() {
  return generateToken(32);
}
