import { NextResponse } from "next/server";
import { getTelegramBotToken } from "../../../../lib/config";
import { sendTelegramMessage } from "../../../../lib/telegram";

type TelegramWebhookUpdate = {
  message?: {
    text?: string;
    chat?: { id: number };
    from?: { id: number; username?: string };
  };
};

function helpText() {
  return [
    "TeCloud Bot",
    "",
    "/help - Lihat bantuan",
    "/status - Cek status bot",
    "/verify <kode> - Verifikasi akun dari halaman TeCloud",
    "",
    "Untuk upload dan kelola file, buka aplikasi web TeCloud.",
  ].join("\n");
}

export async function POST(request: Request) {
  const botToken = getTelegramBotToken();
  if (!botToken) {
    return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN belum diatur." }, { status: 400 });
  }

  const update = (await request.json().catch(() => ({}))) as TelegramWebhookUpdate;
  const chatId = update.message?.chat?.id;
  const text = update.message?.text?.trim() || "";
  if (!chatId || !text) return NextResponse.json({ ok: true });

  const config = { botToken, chatId: String(chatId) };
  const lower = text.toLowerCase();

  if (lower.startsWith("/start") || lower.startsWith("/help")) {
    await sendTelegramMessage(config, String(chatId), helpText());
  } else if (lower.startsWith("/status")) {
    await sendTelegramMessage(config, String(chatId), "Bot TeCloud aktif. Kamu bisa kembali ke aplikasi web untuk mengelola file.");
  } else if (lower.startsWith("/verify")) {
    await sendTelegramMessage(config, String(chatId), "Command verifikasi diterima. Kembali ke halaman TeCloud lalu klik tombol cek verifikasi.");
  }

  return NextResponse.json({ ok: true });
}
