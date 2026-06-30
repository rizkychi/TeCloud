import { NextResponse } from "next/server";
import { getTelegramConfig } from "../../../../../lib/config";
import { findFile, incrementDownloadCount, logActivity } from "../../../../../lib/file-store";
import { requireUser } from "../../../../../lib/security";
import { getTelegramFileUrl } from "../../../../../lib/telegram";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function contentDisposition(name: string) {
  const fallback = name.replace(/[^\w.-]/g, "_") || "download";
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(
    name,
  )}`;
}

export async function GET(_request: Request, context: RouteContext) {
  const user = await requireUser(_request);
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

  const params = await context.params;
  const file = await findFile(params.id);

  if (!file) {
    return NextResponse.json({ error: "File tidak ditemukan." }, { status: 404 });
  }

  if (file.ownerId !== user.id && user.role !== "admin") {
    return NextResponse.json({ error: "Tidak punya akses ke file ini." }, { status: 403 });
  }

  const url = await getTelegramFileUrl(config, file.telegramFileId);
  const telegramResponse = await fetch(url);

  if (!telegramResponse.ok || !telegramResponse.body) {
    return NextResponse.json(
      { error: "File tidak bisa diambil dari Telegram." },
      { status: 502 },
    );
  }

  await incrementDownloadCount(file.id);
  await logActivity({ userId: user.id, fileId: file.id, type: "download", bytes: file.size });

  return new Response(telegramResponse.body, {
    headers: {
      "Content-Disposition": contentDisposition(file.name),
      "Content-Length": String(file.size),
      "Content-Type": file.mimeType,
    },
  });
}
