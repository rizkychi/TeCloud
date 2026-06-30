import { NextResponse } from "next/server";
import { getDefaultQuotaBytes, getTelegramBotToken, getTelegramBotUsername } from "../../../../lib/config";
import { countUsers, createAuthCode, createUser, findUserByUsername, logActivity } from "../../../../lib/file-store";
import { guardMutation } from "../../../../lib/request-guards";
import { codeExpiresAt, hashPassword, randomToken, sha256 } from "../../../../lib/security";
import { getTelegramBotProfile } from "../../../../lib/telegram";

export async function POST(request: Request) {
  const blocked = await guardMutation(request, {
    scope: "auth:signup",
    limit: 5,
    windowSeconds: 15 * 60,
  });
  if (blocked) return blocked;

  const botToken = getTelegramBotToken();
  if (!botToken) {
    return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN belum diatur." }, { status: 400 });
  }

  const payload = (await request.json().catch(() => ({}))) as {
    username?: string;
    password?: string;
  };

  const username = payload.username?.trim().toLowerCase();
  const password = payload.password || "";

  if (!username || password.length < 8) {
    return NextResponse.json(
      { error: "Isi username dan password minimal 8 karakter." },
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
  const role = totalUsers === 0 ? "admin" : "user";
  const token = randomToken(9);

  await createUser({
    id: userId,
    name: username,
    username,
    telegramChatId: "",
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
    codeHash: await sha256(token),
    createdAt: now,
    expiresAt: codeExpiresAt(),
  });
  await logActivity({ userId, type: "signup_requested" });

  const configuredBotUsername = getTelegramBotUsername();
  const detectedBotUsername = configuredBotUsername
    ? configuredBotUsername
    : await getTelegramBotProfile(botToken).then((bot) => bot.username || "").catch(() => "");
  const verifyCommand = `/verify ${token}`;
  const botUrl = detectedBotUsername
    ? `https://t.me/${detectedBotUsername}?start=verify_${encodeURIComponent(token)}`
    : null;

  return NextResponse.json({
    ok: true,
    username,
    token,
    verifyCommand,
    botUrl,
    message: "Kirim command verifikasi ke bot Telegram untuk mengaktifkan akun.",
  });
}
