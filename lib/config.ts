import type { TelegramConfig } from "./types";

export function getTelegramConfig(): TelegramConfig | null {
  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();

  if (!botToken || !chatId) {
    return null;
  }

  return { botToken, chatId };
}

export function getDefaultQuotaBytes() {
  const raw = process.env.DEFAULT_USER_QUOTA_MB;
  const quotaMb = Number(raw || 1024);
  return Math.max(1, quotaMb) * 1024 * 1024;
}

export function getAdminTelegramChatId() {
  return (process.env.ADMIN_TELEGRAM_CHAT_ID || "").trim();
}

export function getAppBaseUrl(request: Request) {
  const configured = (process.env.APP_BASE_URL || "").trim();
  return configured || new URL(request.url).origin;
}

export function getDataDir() {
  return process.env.DATA_DIR || "./data";
}

export function getDatabasePath() {
  return process.env.DATABASE_PATH || `${getDataDir()}/tecloud.sqlite`;
}
