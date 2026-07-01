import { NextResponse } from "next/server";
import { getTelegramConfig } from "../../../../../lib/config";
import { findFile, logActivity } from "../../../../../lib/file-store";
import { requireUser } from "../../../../../lib/security";
import { getTelegramFileUrl } from "../../../../../lib/telegram";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function contentDisposition(name: string) {
  const fallback = name.replace(/[^\w.-]/g, "_") || "preview";
  return `inline; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

function isPreviewable(mimeType: string) {
  return (
    mimeType.startsWith("image/") ||
    mimeType.startsWith("video/") ||
    mimeType.startsWith("text/") ||
    mimeType.includes("pdf") ||
    mimeType.includes("json")
  );
}

export async function GET(request: Request, context: RouteContext) {
  const user = await requireUser(request);
  if (!user) {
    return NextResponse.json({ error: "Silakan masuk dulu." }, { status: 401 });
  }

  const config = getTelegramConfig();
  if (!config) {
    return NextResponse.json(
      { error: "TELEGRAM_BOT_TOKEN dan TELEGRAM_CHAT_ID belum diatur di environment." },
      { status: 400 },
    );
  }

  const params = await context.params;
  const file = await findFile(params.id);
  if (!file) {
    return NextResponse.json({ error: "File tidak ditemukan." }, { status: 404 });
  }

  if (file.ownerId !== user.id && user.role !== "admin") {
    return NextResponse.json({ error: "Tidak punya akses ke file ini." }, { status: 403 });
  }

  if (!isPreviewable(file.mimeType)) {
    return NextResponse.json({ error: "Tipe file ini belum bisa dipreview." }, { status: 415 });
  }

  const url = await getTelegramFileUrl(config, file.telegramFileId);
  const telegramResponse = await fetch(url);
  if (!telegramResponse.ok || !telegramResponse.body) {
    return NextResponse.json({ error: "Preview tidak bisa diambil dari Telegram." }, { status: 502 });
  }

  await logActivity({ userId: user.id, fileId: file.id, type: "preview", bytes: file.size });

  return new Response(telegramResponse.body, {
    headers: {
      "Cache-Control": "private, max-age=60",
      "Content-Disposition": contentDisposition(file.name),
      "Content-Length": String(file.size),
      "Content-Type": file.mimeType,
    },
  });
}
