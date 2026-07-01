import { NextResponse } from "next/server";
import { getTelegramConfig } from "../../../../../lib/config";
import { findSharedFile, getShareSecret, incrementDownloadCount, isShareDownloadLimitReached, isShareExpired, logActivity } from "../../../../../lib/file-store";
import { requireRateLimit } from "../../../../../lib/request-guards";
import { verifyPassword } from "../../../../../lib/security";
import { getTelegramFileUrl } from "../../../../../lib/telegram";

type RouteContext = {
  params: Promise<{ token: string }>;
};

function contentDisposition(name: string) {
  const fallback = name.replace(/[^\w.-]/g, "_") || "download";
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

export async function GET(request: Request, context: RouteContext) {
  const blocked = await requireRateLimit(request, {
    scope: "share:download",
    limit: 100,
    windowSeconds: 15 * 60,
  });
  if (blocked) return blocked;

  const config = getTelegramConfig();
  if (!config) {
    return NextResponse.json({ error: "Konfigurasi Telegram belum lengkap." }, { status: 400 });
  }

  const params = await context.params;
  const file = await findSharedFile(params.token);
  if (!file) {
    return NextResponse.json({ error: "Link tidak ditemukan." }, { status: 404 });
  }

  if (isShareExpired(file)) {
    return NextResponse.json({ error: "Link share sudah kedaluwarsa." }, { status: 410 });
  }

  if (isShareDownloadLimitReached(file)) {
    return NextResponse.json({ error: "Batas download link share sudah tercapai." }, { status: 410 });
  }

  if (file.shareMode === "password") {
    const password = new URL(request.url).searchParams.get("password") || request.headers.get("x-share-password") || "";
    const secret = await getShareSecret(file.id);
    if (
      !secret?.share_password_hash ||
      !secret.share_password_salt ||
      !(await verifyPassword(password, secret.share_password_hash, secret.share_password_salt))
    ) {
      return NextResponse.json({ error: "Password share salah." }, { status: 401 });
    }
  }

  const url = await getTelegramFileUrl(config, file.telegramFileId);
  const telegramResponse = await fetch(url);
  if (!telegramResponse.ok || !telegramResponse.body) {
    return NextResponse.json({ error: "File tidak bisa diambil dari Telegram." }, { status: 502 });
  }

  await incrementDownloadCount(file.id);
  await logActivity({ userId: null, fileId: file.id, type: "public_download", bytes: file.size });

  return new Response(telegramResponse.body, {
    headers: {
      "Content-Disposition": contentDisposition(file.name),
      "Content-Length": String(file.size),
      "Content-Type": file.mimeType,
    },
  });
}
