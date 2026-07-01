import { NextResponse } from "next/server";
import { getTelegramConfig } from "../../../../../lib/config";
import { findFile, logActivity, removeFile } from "../../../../../lib/file-store";
import { guardMutation } from "../../../../../lib/request-guards";
import { requireUser } from "../../../../../lib/security";
import { deleteTelegramMessage } from "../../../../../lib/telegram";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function DELETE(request: Request, context: RouteContext) {
  const blocked = await guardMutation(request, {
    scope: "files:purge",
    limit: 30,
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

  await deleteTelegramMessage(config, file.messageId).catch(() => false);
  await removeFile(file.id);
  await logActivity({ userId: user.id, fileId: file.id, type: "purge", bytes: file.size });

  return NextResponse.json({ deleted: true });
}
