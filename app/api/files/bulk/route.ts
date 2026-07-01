import { NextResponse } from "next/server";
import { getTelegramConfig } from "../../../../lib/config";
import {
  findFile,
  logActivity,
  normalizeFolderPath,
  removeFile,
  restoreFile,
  softDeleteFile,
  updateFileExtendedMetadata,
} from "../../../../lib/file-store";
import { guardMutation } from "../../../../lib/request-guards";
import { requireUser } from "../../../../lib/security";
import { deleteTelegramMessage } from "../../../../lib/telegram";

type BulkAction = "trash" | "restore" | "purge" | "favorite" | "move" | "tags";

export async function POST(request: Request) {
  const blocked = await guardMutation(request, {
    scope: "files:bulk",
    limit: 40,
    windowSeconds: 60 * 60,
  });
  if (blocked) return blocked;

  const user = await requireUser(request);
  if (!user) {
    return NextResponse.json({ error: "Silakan masuk dulu." }, { status: 401 });
  }

  const payload = (await request.json().catch(() => ({}))) as {
    action?: BulkAction;
    ids?: string[];
    folderPath?: string;
    isFavorite?: boolean;
    tags?: string[];
  };

  const ids = Array.from(new Set(payload.ids || [])).slice(0, 100);
  if (!payload.action || !ids.length) {
    return NextResponse.json({ error: "Pilih aksi dan file." }, { status: 400 });
  }

  const results: Array<{ id: string; ok: boolean; error?: string }> = [];
  const config = payload.action === "purge" ? getTelegramConfig() : null;
  if (payload.action === "purge" && !config) {
    return NextResponse.json({ error: "Konfigurasi Telegram belum lengkap." }, { status: 400 });
  }

  for (const id of ids) {
    const file = await findFile(id);
    if (!file) {
      results.push({ id, ok: false, error: "File tidak ditemukan." });
      continue;
    }
    if (file.ownerId !== user.id && user.role !== "admin") {
      results.push({ id, ok: false, error: "Tidak punya akses." });
      continue;
    }

    if (payload.action === "trash") {
      await softDeleteFile(id);
      await logActivity({ userId: user.id, fileId: id, type: "bulk_trash", bytes: file.size });
    } else if (payload.action === "restore") {
      await restoreFile(id);
      await logActivity({ userId: user.id, fileId: id, type: "bulk_restore", bytes: file.size });
    } else if (payload.action === "purge") {
      await deleteTelegramMessage(config!, file.messageId).catch(() => false);
      await removeFile(id);
      await logActivity({ userId: user.id, fileId: id, type: "bulk_purge", bytes: file.size });
    } else if (payload.action === "favorite") {
      await updateFileExtendedMetadata(id, { isFavorite: Boolean(payload.isFavorite) });
      await logActivity({ userId: user.id, fileId: id, type: "bulk_favorite", metadata: { isFavorite: Boolean(payload.isFavorite) } });
    } else if (payload.action === "move") {
      await updateFileExtendedMetadata(id, { folderPath: normalizeFolderPath(payload.folderPath || "/") });
      await logActivity({ userId: user.id, fileId: id, type: "bulk_move", metadata: { folderPath: payload.folderPath || "/" } });
    } else if (payload.action === "tags") {
      await updateFileExtendedMetadata(id, { tags: payload.tags || [] });
      await logActivity({ userId: user.id, fileId: id, type: "bulk_tags", metadata: { tags: payload.tags || [] } });
    }
    results.push({ id, ok: true });
  }

  return NextResponse.json({ results });
}
