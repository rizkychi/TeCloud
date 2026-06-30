import { NextResponse } from "next/server";
import { getTelegramConfig } from "../../../../lib/config";
import { findFile, logActivity, removeFile, updateFile } from "../../../../lib/file-store";
import { guardMutation } from "../../../../lib/request-guards";
import { requireUser } from "../../../../lib/security";
import {
  deleteTelegramMessage,
  sanitizeFilename,
  sendDocument,
} from "../../../../lib/telegram";
import {
  isTelegramFileTooLarge,
  telegramFileLimitMessage,
} from "../../../../lib/upload-limits";

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function getId(context: RouteContext) {
  const params = await context.params;
  return params.id;
}

export async function PATCH(request: Request, context: RouteContext) {
  const blocked = await guardMutation(request, {
    scope: "files:update",
    limit: 60,
    windowSeconds: 60 * 60,
  });
  if (blocked) return blocked;

  const user = await requireUser(request);
  if (!user) {
    return NextResponse.json({ error: "Silakan masuk dulu." }, { status: 401 });
  }

  const id = await getId(context);
  const current = await findFile(id);

  if (!current) {
    return NextResponse.json({ error: "File tidak ditemukan." }, { status: 404 });
  }

  if (current.ownerId !== user.id && user.role !== "admin") {
    return NextResponse.json({ error: "Tidak punya akses ke file ini." }, { status: 403 });
  }

  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
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
    const replacement = formData.get("file");
    const name = sanitizeFilename(String(formData.get("name") || current.name));

    if (!(replacement instanceof File) || replacement.size === 0) {
      const renamed = await updateFile(id, (file) => ({
        ...file,
        name,
        updatedAt: new Date().toISOString(),
      }));
      await logActivity({ userId: user.id, fileId: id, type: "rename" });
      return NextResponse.json({ file: renamed });
    }

    if (isTelegramFileTooLarge(replacement.size)) {
      return NextResponse.json(
        { error: telegramFileLimitMessage() },
        { status: 413 },
      );
    }

    const projectedUsage = user.usedBytes - current.size + replacement.size;
    if (projectedUsage > user.quotaBytes) {
      return NextResponse.json(
        { error: "Kuota penyimpanan akun tidak cukup." },
        { status: 403 },
      );
    }

    const uploaded = await sendDocument(config, replacement);
    await deleteTelegramMessage(config, current.messageId).catch(() => false);

    const updated = await updateFile(id, (file) => ({
      ...file,
      name,
      originalName: replacement.name,
      mimeType:
        uploaded.mimeType || replacement.type || "application/octet-stream",
      size: uploaded.fileSize || replacement.size,
      telegramFileId: uploaded.fileId,
      telegramUniqueId: uploaded.uniqueId,
      messageId: uploaded.messageId,
      updatedAt: new Date().toISOString(),
      version: file.version + 1,
    }));
    await logActivity({ userId: user.id, fileId: id, type: "replace", bytes: updated?.size ?? 0 });

    return NextResponse.json({ file: updated });
  }

  const payload = (await request.json().catch(() => ({}))) as {
    name?: string;
  };
  const name = sanitizeFilename(payload.name || current.name);
  const updated = await updateFile(id, (file) => ({
    ...file,
    name,
    updatedAt: new Date().toISOString(),
  }));
  await logActivity({ userId: user.id, fileId: id, type: "rename" });

  return NextResponse.json({ file: updated });
}

export async function DELETE(request: Request, context: RouteContext) {
  const blocked = await guardMutation(request, {
    scope: "files:delete",
    limit: 30,
    windowSeconds: 60 * 60,
  });
  if (blocked) return blocked;

  const user = await requireUser(request);
  if (!user) {
    return NextResponse.json({ error: "Silakan masuk dulu." }, { status: 401 });
  }

  const id = await getId(context);
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

  const current = await findFile(id);

  if (!current) {
    return NextResponse.json({ error: "File tidak ditemukan." }, { status: 404 });
  }

  if (current.ownerId !== user.id && user.role !== "admin") {
    return NextResponse.json({ error: "Tidak punya akses ke file ini." }, { status: 403 });
  }

  await deleteTelegramMessage(config, current.messageId);
  await removeFile(id);
  await logActivity({ userId: user.id, fileId: id, type: "delete", bytes: current.size });

  return NextResponse.json({ deleted: true });
}
