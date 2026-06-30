import { NextResponse } from "next/server";
import { getAdminTelegramChatId, getDefaultQuotaBytes, getTelegramConfig } from "../../../../lib/config";
import { countUsers, createAuthCode, createUser, findUserByUsername, logActivity } from "../../../../lib/file-store";
import { guardMutation } from "../../../../lib/request-guards";
import { codeExpiresAt, hashPassword, makeOtpCode, sha256 } from "../../../../lib/security";
import { sendTelegramMessage } from "../../../../lib/telegram";

export async function POST(request: Request) {
  const blocked = await guardMutation(request, {
    scope: "auth:signup",
    limit: 5,
    windowSeconds: 15 * 60,
  });
  if (blocked) return blocked;

  const config = getTelegramConfig();
  if (!config) {
    return NextResponse.json({ error: "Konfigurasi Telegram belum lengkap." }, { status: 400 });
  }

  const payload = (await request.json().catch(() => ({}))) as {
    name?: string;
    username?: string;
    telegramChatId?: string;
    password?: string;
  };

  const name = payload.name?.trim();
  const username = payload.username?.trim().toLowerCase();
  const telegramChatId = payload.telegramChatId?.trim();
  const password = payload.password || "";

  if (!name || !username || !telegramChatId || password.length < 8) {
    return NextResponse.json(
      { error: "Isi nama, username, Telegram chat id, dan password minimal 8 karakter." },
      { status: 400 },
    );
  }

  if (await findUserByUsername(username)) {
    return NextResponse.json({ error: "Username sudah terdaftar." }, { status: 409 });
  }

  const totalUsers = await countUsers();
  const passwordSecret = await hashPassword(password);
  const userId = crypto.randomUUID();
  const now = new Date().toISOString();
  const role = totalUsers === 0 || telegramChatId === getAdminTelegramChatId() ? "admin" : "user";
  const code = makeOtpCode();

  await createUser({
    id: userId,
    name,
    username,
    telegramChatId,
    passwordHash: passwordSecret.hash,
    passwordSalt: passwordSecret.salt,
    role,
    status: "pending",
    quotaBytes: getDefaultQuotaBytes(),
    createdAt: now,
  });
  await createAuthCode({
    id: crypto.randomUUID(),
    userId,
    purpose: "signup",
    codeHash: await sha256(code),
    createdAt: now,
    expiresAt: codeExpiresAt(),
  });
  await sendTelegramMessage(
    config,
    telegramChatId,
    `Kode verifikasi TeCloud kamu: ${code}. Kode berlaku 10 menit.`,
  );
  await logActivity({ userId, type: "signup_requested" });

  return NextResponse.json({
    ok: true,
    username,
    message: "Kode verifikasi sudah dikirim lewat bot Telegram.",
  });
}
