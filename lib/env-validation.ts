import { getDatabasePath } from "./config";

export function getEnvironmentReport() {
  const required = ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID", "APP_BASE_URL"];
  const missing = required.filter((key) => !process.env[key]?.trim());
  const warnings: string[] = [];

  if (!process.env.ADMIN_TELEGRAM_CHAT_ID?.trim()) {
    warnings.push("ADMIN_TELEGRAM_CHAT_ID belum diisi; user pertama tetap otomatis menjadi admin.");
  }

  if (!process.env.DATA_DIR?.trim()) {
    warnings.push("DATA_DIR tidak diisi; aplikasi memakai ./data untuk development lokal.");
  }

  return {
    ok: missing.length === 0,
    missing,
    warnings,
    databasePath: getDatabasePath(),
  };
}
