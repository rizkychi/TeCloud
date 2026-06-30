import { NextResponse } from "next/server";
import { getAdminTelegramChatId, getTelegramBotToken, getTelegramBotUsername } from "../../../../lib/config";
import { activateUserFromTelegram, consumeAuthCode, getPasswordSecret, logActivity } from "../../../../lib/file-store";
import { guardMutation } from "../../../../lib/request-guards";
import { attachSession, publicUser, sha256 } from "../../../../lib/security";
import { findVerificationCommand, getTelegramBotProfile, getTelegramUpdates } from "../../../../lib/telegram";

export async function POST(request: Request) {
  const blocked = await guardMutation(request, {
    scope: "auth:verify",
    limit: 10,
    windowSeconds: 10 * 60,
  });
  if (blocked) return blocked;

  const payload = (await request.json().catch(() => ({}))) as {
    username?: string;
    token?: string;
    code?: string;
  };
  const username = payload.username?.trim().toLowerCase();
  const token = (payload.token || payload.code)?.trim();

  if (!username || !token) {
    return NextResponse.json({ error: "Username dan command verifikasi wajib diisi." }, { status: 400 });
  }

  const botToken = getTelegramBotToken();
  if (!botToken) {
    return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN belum diatur." }, { status: 400 });
  }

  const secret = await getPasswordSecret(username);
  if (!secret) {
    return NextResponse.json({ error: "Akun tidak ditemukan." }, { status: 404 });
  }

  const configuredBotUsername = getTelegramBotUsername();
  const botUsername = configuredBotUsername
    ? configuredBotUsername
    : await getTelegramBotProfile(botToken).then((bot) => bot.username || "").catch(() => "");
  const updates = await getTelegramUpdates(botToken);
  const verification = findVerificationCommand(updates, token, botUsername);

  if (!verification) {
    return NextResponse.json(
      { error: "Command verifikasi belum ditemukan. Kirim command ke bot, lalu coba cek lagi." },
      { status: 400 },
    );
  }

  const valid = await consumeAuthCode(secret.user.id, "signup", await sha256(token));
  if (!valid) {
    return NextResponse.json({ error: "Command salah atau sudah kedaluwarsa." }, { status: 400 });
  }

  const adminTelegramChatId = getAdminTelegramChatId();
  const role =
    secret.user.role === "admin" || verification.telegramChatId === adminTelegramChatId
      ? "admin"
      : "user";
  const user = await activateUserFromTelegram(secret.user.id, verification.telegramChatId, role);
  if (!user) {
    return NextResponse.json({ error: "Akun tidak ditemukan." }, { status: 404 });
  }

  await logActivity({
    userId: user.id,
    type: "signup_verified",
    metadata: {
      telegramChatId: verification.telegramChatId,
      telegramUsername: verification.username,
    },
  });
  const response = NextResponse.json({ user: publicUser(user) });
  await attachSession(response, user);
  return response;
}
