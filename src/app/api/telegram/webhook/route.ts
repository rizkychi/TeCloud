import { resolveBotStartPayload } from "@/lib/auth";
import { getEnv } from "@/lib/env";
import { telegramSendMessage, type TelegramUpdate } from "@/lib/telegram";
import { jsonError, jsonOk } from "@/lib/api";

export const runtime = "nodejs";

function authorized(req: Request) {
  const secret = getEnv().TELEGRAM_WEBHOOK_SECRET;
  if (!secret) return true; // open in demo if unset
  const header = req.headers.get("x-telegram-bot-api-secret-token");
  return header === secret;
}

export async function POST(req: Request) {
  if (!authorized(req)) return jsonError(401, "UNAUTHORIZED", "Invalid webhook secret");

  const update = (await req.json().catch(() => null)) as TelegramUpdate | null;
  if (!update?.message) return jsonOk({ ok: true });

  const text = update.message.text || "";
  const chatId = update.message.chat.id;
  const fromId = update.message.from?.id || chatId;

  try {
    if (text.startsWith("/start")) {
      const payload = text.split(/\s+/)[1] || "";
      if (!payload) {
        await telegramSendMessage(
          chatId,
          "Bot verifikasi TeCloud.\nBuka aplikasi TeCloud lalu ketuk tombol Telegram (Verify / Reset). Tidak perlu ketik manual.",
        );
        return jsonOk({ ok: true });
      }
      const result = await resolveBotStartPayload(payload, fromId);
      if (!result.ok) {
        await telegramSendMessage(chatId, result.message);
        return jsonOk({ ok: true });
      }
      await telegramSendMessage(chatId, result.message, {
        reply_markup: result.url
          ? {
              inline_keyboard: [[{ text: "Open link", url: result.url }]],
            }
          : undefined,
      });
      return jsonOk({ ok: true });
    }

    await telegramSendMessage(
      chatId,
      "Perintah tidak dikenali. Gunakan tombol CTA di TeCloud agar bot menerima token otomatis via /start.",
    );
    return jsonOk({ ok: true });
  } catch (e) {
    console.error(e);
    // always 200 to telegram to avoid retries storm on app bugs
    return jsonOk({ ok: true, error: true });
  }
}

export async function GET() {
  return jsonOk({
    service: "tecloud-telegram-webhook",
    bot: getEnv().TELEGRAM_BOT_USERNAME,
    hasToken: Boolean(getEnv().TELEGRAM_BOT_TOKEN),
  });
}
