import type { TelegramConfig } from "./types";

type TelegramDocument = {
  file_id: string;
  file_unique_id?: string;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
};

type TelegramMessage = {
  message_id: number;
  date?: number;
  text?: string;
  from?: {
    id: number;
    is_bot?: boolean;
    username?: string;
    first_name?: string;
  };
  chat?: {
    id: number;
    type?: string;
    username?: string;
  };
  document?: TelegramDocument;
};

type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
};

type TelegramResponse<T> = {
  ok: boolean;
  result?: T;
  description?: string;
};

function endpoint(config: TelegramConfig, method: string) {
  return `https://api.telegram.org/bot${config.botToken}/${method}`;
}

async function readTelegramResponse<T>(response: Response) {
  const payload = (await response.json().catch(() => null)) as
    | TelegramResponse<T>
    | null;

  if (!response.ok || !payload?.ok || payload.result === undefined) {
    throw new Error(
      payload?.description || `Telegram request failed (${response.status})`,
    );
  }

  return payload.result;
}

export async function sendDocument(config: TelegramConfig, file: File) {
  const form = new FormData();
  form.set("chat_id", config.chatId);
  form.set("document", file, file.name);
  form.set("caption", `TeCloud: ${file.name}`);

  const response = await fetch(endpoint(config, "sendDocument"), {
    method: "POST",
    body: form,
  });
  const message = await readTelegramResponse<TelegramMessage>(response);

  if (!message.document) {
    throw new Error("Telegram did not return document metadata.");
  }

  return {
    messageId: message.message_id,
    fileId: message.document.file_id,
    uniqueId: message.document.file_unique_id,
    fileSize: message.document.file_size,
    mimeType: message.document.mime_type,
  };
}

export async function sendTelegramMessage(
  config: TelegramConfig,
  chatId: string,
  text: string,
) {
  const form = new FormData();
  form.set("chat_id", chatId);
  form.set("text", text);

  const response = await fetch(endpoint(config, "sendMessage"), {
    method: "POST",
    body: form,
  });

  return readTelegramResponse<TelegramMessage>(response);
}

export async function getTelegramBotProfile(botToken: string) {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
  return readTelegramResponse<{ username?: string; first_name?: string }>(response);
}

export async function getTelegramUpdates(botToken: string) {
  const params = new URLSearchParams({
    allowed_updates: JSON.stringify(["message"]),
    limit: "100",
    timeout: "0",
  });
  const response = await fetch(`https://api.telegram.org/bot${botToken}/getUpdates?${params}`);
  return readTelegramResponse<TelegramUpdate[]>(response);
}

export function findVerificationCommand(
  updates: TelegramUpdate[],
  token: string,
  botUsername?: string,
) {
  const normalizedToken = token.trim();
  const mention = botUsername ? `@${botUsername.replace(/^@/, "")}`.toLowerCase() : "";

  for (const update of updates) {
    const message = update.message;
    const text = message?.text?.trim();
    if (!message || !text) continue;

    const lowerText = text.toLowerCase();
    const verifyCommand = mention
      ? lowerText.startsWith(`/verify${mention} `)
      : false;
    const isVerify =
      lowerText === `/verify ${normalizedToken}`.toLowerCase() ||
      verifyCommand && lowerText.slice(`/verify${mention} `.length) === normalizedToken.toLowerCase();
    const isStart =
      lowerText === `/start verify_${normalizedToken}`.toLowerCase() ||
      (mention && lowerText === `/start${mention} verify_${normalizedToken}`.toLowerCase());

    if (!isVerify && !isStart) continue;

    const userId = message.from?.id ?? message.chat?.id;
    if (!userId) continue;

    return {
      telegramChatId: String(userId),
      updateId: update.update_id,
      username: message.from?.username,
      firstName: message.from?.first_name,
    };
  }

  return null;
}

export async function deleteTelegramMessage(
  config: TelegramConfig,
  messageId: number,
) {
  const form = new FormData();
  form.set("chat_id", config.chatId);
  form.set("message_id", String(messageId));

  const response = await fetch(endpoint(config, "deleteMessage"), {
    method: "POST",
    body: form,
  });

  return readTelegramResponse<boolean>(response);
}

export async function getTelegramFileUrl(
  config: TelegramConfig,
  fileId: string,
) {
  const params = new URLSearchParams({ file_id: fileId });
  const response = await fetch(`${endpoint(config, "getFile")}?${params}`);
  const result = await readTelegramResponse<{ file_path: string }>(response);
  return `https://api.telegram.org/file/bot${config.botToken}/${result.file_path}`;
}

export function sanitizeFilename(name: string) {
  const trimmed = name.trim().replace(/[\\/:*?"<>|]/g, "-");
  return trimmed || "untitled";
}
