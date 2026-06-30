export const maxTelegramFileBytes = 2 * 1024 * 1024 * 1024;
export const maxTelegramFileLabel = "2 GB";

export function isTelegramFileTooLarge(size: number) {
  return size >= maxTelegramFileBytes;
}

export function telegramFileLimitMessage() {
  return `Ukuran file harus di bawah ${maxTelegramFileLabel} sesuai batas Telegram.`;
}
