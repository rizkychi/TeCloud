import { NextResponse } from "next/server";
import { getTelegramConfig } from "../../../lib/config";
import { addFile, listFiles, logActivity } from "../../../lib/file-store";
import { guardMutation } from "../../../lib/request-guards";
import { requireUser } from "../../../lib/security";
import { sanitizeFilename, sendDocument } from "../../../lib/telegram";
import type { StoredFile } from "../../../lib/types";
import {
  isTelegramFileTooLarge,
  telegramFileLimitMessage,
} from "../../../lib/upload-limits";

export async function GET(request: Request) {
  const user = await requireUser(request);
  if (!user) {
    return NextResponse.json({ error: "Silakan masuk dulu." }, { status: 401 });
  }

  const files = await listFiles(user.id);
  const totalSize = files.reduce(
    (sum: number, file: StoredFile) => sum + file.size,
    0,
  );

  return NextResponse.json({
    configured: Boolean(getTelegramConfig()),
    user,
    files,
    totalSize,
  });
}

export async function POST(request: Request) {
  const blocked = await guardMutation(request, {
    scope: "files:upload",
    limit: 20,
    windowSeconds: 60 * 60,
  });
  if (blocked) return blocked;

  const user = await requireUser(request);
  if (!user) {
    return NextResponse.json({ error: "Silakan masuk dulu." }, { status: 401 });
  }

  const config = getTelegramConfig();

  if (!config) {
    return NextResponse.json(
      {
        error:
          "TELEGRAM_BOT_TOKEN dan TELEGRAM_CHAT_ID belum diatur di environment.",
      },
      { status: 400 },
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json(
      { error: "Pilih file yang ingin diunggah." },
      { status: 400 },
    );
  }

  if (isTelegramFileTooLarge(file.size)) {
    return NextResponse.json(
      { error: telegramFileLimitMessage() },
      { status: 413 },
    );
  }

  if (user.usedBytes + file.size > user.quotaBytes) {
    return NextResponse.json(
      { error: "Kuota penyimpanan akun tidak cukup." },
      { status: 403 },
    );
  }

  const uploaded = await sendDocument(config, file);
  const now = new Date().toISOString();
  const name = sanitizeFilename(String(formData.get("name") || file.name));

  const record: StoredFile = {
    id: crypto.randomUUID(),
    ownerId: user.id,
    name,
    originalName: file.name,
    mimeType: uploaded.mimeType || file.type || "application/octet-stream",
    size: uploaded.fileSize || file.size,
    telegramFileId: uploaded.fileId,
    telegramUniqueId: uploaded.uniqueId,
    messageId: uploaded.messageId,
    uploadedAt: now,
    updatedAt: now,
    version: 1,
    shareMode: "private",
    downloadCount: 0,
  };

  await addFile(record);
  await logActivity({ userId: user.id, fileId: record.id, type: "upload", bytes: record.size });

  return NextResponse.json({ file: record }, { status: 201 });
}
