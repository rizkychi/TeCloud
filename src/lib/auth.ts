import { cookies } from "next/headers";
import { prisma } from "./db";
import { generateToken, hashPassword, hashToken, verifyPassword } from "./crypto";
import { getEnv } from "./env";
import { getDefaultQuotaBytes, getUserQuotaBytes, getUserUsageBytes } from "./quota";
import { resetAppUrl, resetBotDeepLink, verifyAppUrl, verifyBotDeepLink } from "./telegram";

export const SESSION_COOKIE = "tecloud_session";
const SESSION_DAYS = 14;
const VERIFY_HOURS = 48;
const RESET_HOURS = 1;

const USERNAME_RE = /^[a-z0-9_]{3,32}$/;

export type SessionUser = {
  id: string;
  username: string;
  name: string;
  locale: string;
  role: "user" | "admin";
  theme: string;
  viewMode: string;
  quotaBytes: number;
  usedBytes: number;
  verified: boolean;
  telegramId: string | null;
};

export function normalizeUsername(raw: string) {
  return raw.trim().toLowerCase();
}

export function assertUsername(raw: string) {
  const username = normalizeUsername(raw);
  if (!USERNAME_RE.test(username)) throw new Error("INVALID_USERNAME");
  return username;
}

function cookieSecure() {
  try {
    return getEnv().APP_URL.startsWith("https://");
  } catch {
    return false;
  }
}

function mapUser(
  user: {
    id: string;
    username: string;
    name: string;
    locale: string;
    role: "user" | "admin";
    theme: string;
    viewMode: string;
    quotaBytes: bigint | null;
    verifiedAt: Date | null;
    telegramId: string | null;
  },
  usedBytes: number,
  quotaBytes: number,
): SessionUser {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    locale: user.locale,
    role: user.role,
    theme: user.theme || "dark",
    viewMode: user.viewMode || "list",
    quotaBytes,
    usedBytes,
    verified: Boolean(user.verifiedAt),
    telegramId: user.telegramId,
  };
}

export async function createSession(userId: string): Promise<string> {
  const token = generateToken(32);
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await prisma.session.create({ data: { userId, tokenHash, expiresAt } });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
  return token;
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
  jar.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!session || session.expiresAt < new Date()) {
    if (session) {
      await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
    }
    return null;
  }
  if (session.user.disabled) return null;
  const quotaBytes = await getUserQuotaBytes(session.user);
  const usedBytes = await getUserUsageBytes(session.user.id);
  return mapUser(session.user, usedBytes, quotaBytes);
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHORIZED");
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "admin") throw new Error("FORBIDDEN");
  return user;
}

async function issueAuthToken(userId: string, type: "verify_account" | "reset_password", hours: number) {
  const token = generateToken(24); // shorter for telegram start payload budget
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);
  await prisma.authToken.updateMany({
    where: { userId, type, usedAt: null },
    data: { usedAt: new Date() },
  });
  await prisma.authToken.create({
    data: { userId, type, tokenHash, expiresAt },
  });
  return token;
}

export async function createVerifyChallenge(userId: string) {
  const token = await issueAuthToken(userId, "verify_account", VERIFY_HOURS);
  return {
    token,
    botUrl: verifyBotDeepLink(token),
    appUrl: verifyAppUrl(token),
  };
}

export async function createResetChallenge(userId: string) {
  const token = await issueAuthToken(userId, "reset_password", RESET_HOURS);
  return {
    token,
    botUrl: resetBotDeepLink(token),
    appUrl: resetAppUrl(token),
  };
}

export async function registerUser(input: {
  username: string;
  password: string;
  name: string;
  locale?: string;
}) {
  const username = assertUsername(input.username);
  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) throw new Error("USERNAME_TAKEN");

  const passwordHash = await hashPassword(input.password);
  const adminUsername = getEnv().ADMIN_USERNAME ? normalizeUsername(getEnv().ADMIN_USERNAME!) : null;
  const userCount = await prisma.user.count();
  const isBootstrapAdmin = userCount === 0 || (adminUsername && username === adminUsername);
  const role = isBootstrapAdmin ? "admin" : "user";

  const user = await prisma.user.create({
    data: {
      username,
      passwordHash,
      name: input.name.trim(),
      locale: input.locale === "en" ? "en" : "id",
      role,
      verifiedAt: isBootstrapAdmin ? new Date() : null,
    },
  });

  if (isBootstrapAdmin) {
    await createSession(user.id);
    const quotaBytes = await getUserQuotaBytes(user);
    return {
      needsVerification: false as const,
      username: user.username,
      botUrl: null as string | null,
      user: mapUser(user, 0, quotaBytes),
    };
  }

  const challenge = await createVerifyChallenge(user.id);
  return {
    needsVerification: true as const,
    username: user.username,
    botUrl: challenge.botUrl,
    user: null as SessionUser | null,
  };
}

export async function loginUser(input: { username: string; password: string }) {
  const username = normalizeUsername(input.username);
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) throw new Error("INVALID_CREDENTIALS");
  if (user.disabled) throw new Error("ACCOUNT_DISABLED");
  const ok = await verifyPassword(user.passwordHash, input.password);
  if (!ok) throw new Error("INVALID_CREDENTIALS");
  if (!user.verifiedAt) throw new Error("NOT_VERIFIED");
  await createSession(user.id);
  const quotaBytes = await getUserQuotaBytes(user);
  const usedBytes = await getUserUsageBytes(user.id);
  return mapUser(user, usedBytes, quotaBytes);
}

export async function getVerifyChallengeForUsername(usernameRaw: string) {
  const username = normalizeUsername(usernameRaw);
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || user.disabled) return { ok: true as const };
  if (user.verifiedAt) return { ok: true as const, alreadyVerified: true as const };
  const challenge = await createVerifyChallenge(user.id);
  return { ok: true as const, botUrl: challenge.botUrl, username: user.username };
}

export async function verifyAccountToken(rawToken: string, opts?: { telegramId?: string }) {
  const tokenHash = hashToken(rawToken);
  const row = await prisma.authToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });
  if (!row || row.type !== "verify_account") throw new Error("INVALID_TOKEN");
  if (row.usedAt) throw new Error("TOKEN_USED");
  if (row.expiresAt < new Date()) throw new Error("TOKEN_EXPIRED");

  await prisma.$transaction([
    prisma.authToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
    prisma.user.update({
      where: { id: row.userId },
      data: {
        verifiedAt: new Date(),
        ...(opts?.telegramId
          ? {
              telegramId: opts.telegramId,
            }
          : {}),
      },
    }),
  ]);

  await createSession(row.userId);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: row.userId } });
  const quotaBytes = await getUserQuotaBytes(user);
  const usedBytes = await getUserUsageBytes(user.id);
  return mapUser(user, usedBytes, quotaBytes);
}

/** Bot side: validate token and return app URL to reply (does not consume token). */
export async function resolveBotStartPayload(payload: string, telegramUserId: number) {
  const p = payload.trim();
  let kind: "verify" | "reset" | null = null;
  let raw = "";
  if (p.startsWith("v_")) {
    kind = "verify";
    raw = p.slice(2);
  } else if (p.startsWith("r_")) {
    kind = "reset";
    raw = p.slice(2);
  } else {
    return { ok: false as const, message: "Unknown command. Open TeCloud and tap the Telegram button again." };
  }

  const tokenHash = hashToken(raw);
  const row = await prisma.authToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });
  if (!row || row.usedAt || row.expiresAt < new Date()) {
    return { ok: false as const, message: "Link expired or invalid. Request a new one from TeCloud." };
  }

  // Soft-bind telegram id early (helps support); verification still needs app click
  if (!row.user.telegramId) {
    const clash = await prisma.user.findFirst({
      where: { telegramId: String(telegramUserId), NOT: { id: row.userId } },
    });
    if (!clash) {
      await prisma.user.update({
        where: { id: row.userId },
        data: { telegramId: String(telegramUserId) },
      });
    }
  }

  if (kind === "verify") {
    if (row.type !== "verify_account") {
      return { ok: false as const, message: "Invalid verification payload." };
    }
    if (row.user.verifiedAt) {
      return {
        ok: true as const,
        message: `Akun @${row.user.username} sudah terverifikasi. Silakan login di TeCloud.`,
        url: getEnv().APP_URL,
      };
    }
    const url = verifyAppUrl(raw);
    return {
      ok: true as const,
      message: `Halo ${row.user.name} (@${row.user.username}). Ketuk link ini untuk verifikasi akun TeCloud:\n${url}`,
      url,
    };
  }

  if (row.type !== "reset_password") {
    return { ok: false as const, message: "Invalid reset payload." };
  }
  const url = resetAppUrl(raw);
  return {
    ok: true as const,
    message: `Reset password untuk @${row.user.username}. Ketuk link ini (berlaku terbatas):\n${url}`,
    url,
  };
}

export async function requestPasswordReset(usernameRaw: string) {
  const username = normalizeUsername(usernameRaw);
  const user = await prisma.user.findUnique({ where: { username } });
  // opaque
  if (!user || user.disabled) return { ok: true as const };
  const challenge = await createResetChallenge(user.id);
  return { ok: true as const, botUrl: challenge.botUrl, username: user.username };
}

export async function resetPasswordWithToken(rawToken: string, password: string) {
  const tokenHash = hashToken(rawToken);
  const row = await prisma.authToken.findUnique({ where: { tokenHash } });
  if (!row || row.type !== "reset_password") throw new Error("INVALID_TOKEN");
  if (row.usedAt) throw new Error("TOKEN_USED");
  if (row.expiresAt < new Date()) throw new Error("TOKEN_EXPIRED");

  const passwordHash = await hashPassword(password);
  await prisma.$transaction([
    prisma.authToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
    prisma.user.update({
      where: { id: row.userId },
      data: { passwordHash, verifiedAt: new Date() },
    }),
    prisma.session.deleteMany({ where: { userId: row.userId } }),
  ]);
  await createSession(row.userId);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: row.userId } });
  const quotaBytes = await getUserQuotaBytes(user);
  const usedBytes = await getUserUsageBytes(user.id);
  return mapUser(user, usedBytes, quotaBytes);
}

export async function updateProfile(
  userId: string,
  input: { name?: string; locale?: "en" | "id"; currentPassword?: string; newPassword?: string },
) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("UNAUTHORIZED");

  const data: { name?: string; locale?: string; passwordHash?: string } = {};
  if (input.name != null) data.name = input.name.trim();
  if (input.locale) data.locale = input.locale;

  if (input.newPassword) {
    if (!input.currentPassword) throw new Error("CURRENT_PASSWORD_REQUIRED");
    const ok = await verifyPassword(user.passwordHash, input.currentPassword);
    if (!ok) throw new Error("INVALID_CURRENT_PASSWORD");
    data.passwordHash = await hashPassword(input.newPassword);
  }

  const updated = await prisma.user.update({ where: { id: userId }, data });
  if (input.newPassword) {
    const jar = await cookies();
    const token = jar.get(SESSION_COOKIE)?.value;
    if (token) {
      await prisma.session.deleteMany({
        where: { userId, tokenHash: { not: hashToken(token) } },
      });
    }
  }
  const quotaBytes = await getUserQuotaBytes(updated);
  const usedBytes = await getUserUsageBytes(updated.id);
  return mapUser(updated, usedBytes, quotaBytes);
}

export async function ensureDefaultSettings() {
  const def = await getDefaultQuotaBytes();
  await prisma.systemSetting.upsert({
    where: { key: "default_quota_bytes" },
    create: { key: "default_quota_bytes", value: String(def) },
    update: {},
  });
}
