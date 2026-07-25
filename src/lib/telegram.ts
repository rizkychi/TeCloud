import { getEnv } from "./env";

export function telegramBotUsername() {
  return getEnv().TELEGRAM_BOT_USERNAME.replace(/^@/, "");
}

/** Deep-link so user only taps CTA — no manual typing. Payload max ~64 chars after start=. */
export function telegramStartLink(payload: string) {
  const bot = telegramBotUsername();
  const p = payload.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64);
  return `https://t.me/${bot}?start=${encodeURIComponent(p)}`;
}

export function verifyAppUrl(token: string) {
  return `${getEnv().APP_URL.replace(/\/$/, "")}/verify?token=${encodeURIComponent(token)}`;
}

export function resetAppUrl(token: string) {
  return `${getEnv().APP_URL.replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(token)}`;
}

/** start payload: v_<token> or r_<token> (token already url-safe base64url-ish) */
export function verifyBotDeepLink(rawToken: string) {
  return telegramStartLink(`v_${rawToken}`);
}

export function resetBotDeepLink(rawToken: string) {
  return telegramStartLink(`r_${rawToken}`);
}

export async function telegramSendMessage(chatId: number | string, text: string, extra?: Record<string, unknown>) {
  const token = getEnv().TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.log(`[telegram:mock] chat=${chatId}\n${text}`);
    return { ok: true as const, mock: true as const };
  }
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: false,
      ...extra,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    console.error("[telegram] sendMessage failed", data);
    throw new Error("TELEGRAM_SEND_FAILED");
  }
  return data;
}

export type TelegramUpdate = {
  update_id?: number;
  message?: {
    message_id: number;
    text?: string;
    chat: { id: number; type: string };
    from?: { id: number; username?: string; first_name?: string };
  };
};
