import { NextResponse } from "next/server";
import { getTelegramConfig } from "../../../../lib/config";
import { createAuthCode, getPasswordSecret, logActivity } from "../../../../lib/file-store";
import { guardMutation } from "../../../../lib/request-guards";
import { codeExpiresAt, makeOtpCode, sha256 } from "../../../../lib/security";
import { sendTelegramMessage } from "../../../../lib/telegram";

export async function POST(request: Request) {
  const blocked = await guardMutation(request, {
    scope: "auth:forgot",
    limit: 5,
    windowSeconds: 15 * 60,
  });
  if (blocked) return blocked;

  const config = getTelegramConfig();
  if (!config) {
    return NextResponse.json({ error: "Konfigurasi Telegram belum lengkap." }, { status: 400 });
  }

  const payload = (await request.json().catch(() => ({}))) as { username?: string };
  const username = payload.username?.trim().toLowerCase();

  if (!username) {
    return NextResponse.json({ error: "Username wajib diisi." }, { status: 400 });
  }

  const secret = await getPasswordSecret(username);
  if (!secret) {
    return NextResponse.json({ ok: true });
  }

  const code = makeOtpCode();
  await createAuthCode({
    id: crypto.randomUUID(),
    userId: secret.user.id,
    purpose: "reset",
    codeHash: await sha256(code),
    createdAt: new Date().toISOString(),
    expiresAt: codeExpiresAt(),
  });
  await sendTelegramMessage(
    config,
    secret.user.telegramChatId,
    `Kode reset password TeCloud kamu: ${code}. Kode berlaku 10 menit.`,
  );
  await logActivity({ userId: secret.user.id, type: "password_reset_requested" });

  return NextResponse.json({ ok: true });
}
