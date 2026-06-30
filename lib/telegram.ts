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
  document?: TelegramDocument;
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
