import { NextResponse } from "next/server";
import { findFile, logActivity, restoreFile } from "../../../../../lib/file-store";
import { guardMutation } from "../../../../../lib/request-guards";
import { requireUser } from "../../../../../lib/security";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const blocked = await guardMutation(request, {
    scope: "files:restore",
    limit: 60,
    windowSeconds: 60 * 60,
  });
  if (blocked) return blocked;

  const user = await requireUser(request);
  if (!user) {
    return NextResponse.json({ error: "Silakan masuk dulu." }, { status: 401 });
  }

  const params = await context.params;
  const file = await findFile(params.id);
  if (!file) {
    return NextResponse.json({ error: "File tidak ditemukan." }, { status: 404 });
  }

  if (file.ownerId !== user.id && user.role !== "admin") {
    return NextResponse.json({ error: "Tidak punya akses ke file ini." }, { status: 403 });
  }

  const restored = await restoreFile(file.id);
  await logActivity({ userId: user.id, fileId: file.id, type: "restore", bytes: file.size });

  return NextResponse.json({ file: restored });
}
