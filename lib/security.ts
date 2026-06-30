import { NextResponse } from "next/server";
import type { SessionUser } from "./types";
import {
  createSession,
  deleteSession,
  findSessionUser,
} from "./file-store";

const sessionCookie = "tecloud_session";
const passwordIterations = 120000;
const codeTtlMs = 10 * 60 * 1000;
const sessionTtlMs = 7 * 24 * 60 * 60 * 1000;
const secureCookies = process.env.NODE_ENV === "production";

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export function randomToken(byteLength = 32) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return bytesToBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function randomSalt(byteLength = 16) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return bytesToBase64(bytes);
}

export function makeOtpCode() {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return String((bytes[0] % 900000) + 100000);
}

export function codeExpiresAt() {
  return new Date(Date.now() + codeTtlMs).toISOString();
}

export async function sha256(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return bytesToBase64(new Uint8Array(digest));
}

export async function hashPassword(password: string, salt = randomSalt()) {
  const normalizedSalt = salt;
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: base64ToBytes(normalizedSalt),
      iterations: passwordIterations,
    },
    keyMaterial,
    256,
  );

  return {
    hash: bytesToBase64(new Uint8Array(bits)),
    salt: normalizedSalt,
  };
}

export async function verifyPassword(
  password: string,
  expectedHash: string,
  salt: string,
) {
  const candidate = await hashPassword(password, salt);
  return candidate.hash === expectedHash;
}

function getCookie(request: Request, name: string) {
  const cookies = request.headers.get("cookie") || "";
  const found = cookies
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  return found ? decodeURIComponent(found.slice(name.length + 1)) : null;
}

export async function getCurrentUser(request: Request) {
  const token = getCookie(request, sessionCookie);
  if (!token) return null;

  return findSessionUser(await sha256(token));
}

export async function requireUser(request: Request) {
  const user = await getCurrentUser(request);
  if (!user || user.status !== "active") {
    return null;
  }
  return user;
}

export async function requireAdmin(request: Request) {
  const user = await requireUser(request);
  return user?.role === "admin" ? user : null;
}

export async function attachSession(response: NextResponse, user: SessionUser) {
  const token = randomToken(32);
  const tokenHash = await sha256(token);
  await createSession({
    id: crypto.randomUUID(),
    tokenHash,
    userId: user.id,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + sessionTtlMs).toISOString(),
  });

  response.cookies.set(sessionCookie, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookies,
    path: "/",
    maxAge: Math.floor(sessionTtlMs / 1000),
  });
}

export async function clearSession(request: Request, response: NextResponse) {
  const token = getCookie(request, sessionCookie);
  if (token) {
    await deleteSession(await sha256(token));
  }
  response.cookies.set(sessionCookie, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookies,
    path: "/",
    maxAge: 0,
  });
}

export function publicUser(user: SessionUser) {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    telegramChatId: user.telegramChatId,
    role: user.role,
    status: user.status,
    quotaBytes: user.quotaBytes,
    usedBytes: user.usedBytes,
  };
}
