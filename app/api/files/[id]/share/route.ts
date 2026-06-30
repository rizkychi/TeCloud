import { NextResponse } from "next/server";
import { getAppBaseUrl } from "../../../../../lib/config";
import { findFile, getShareSecret, logActivity, updateShareSettings } from "../../../../../lib/file-store";
import { guardMutation } from "../../../../../lib/request-guards";
import { hashPassword, randomToken, requireUser, verifyPassword } from "../../../../../lib/security";
import type { ShareMode } from "../../../../../lib/types";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const blocked = await guardMutation(request, {
    scope: "files:share",
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

  const payload = (await request.json().catch(() => ({}))) as {
    mode?: ShareMode;
    password?: string;
  };
  const mode = payload.mode || "private";

  if (!["private", "public", "password"].includes(mode)) {
    return NextResponse.json({ error: "Mode share tidak valid." }, { status: 400 });
  }

  let passwordHash: string | null = null;
  let passwordSalt: string | null = null;
  let shareToken = file.shareToken || randomToken(18);

  if (mode === "private") {
    shareToken = "";
  }

  if (mode === "password") {
    if (!payload.password || payload.password.length < 4) {
      const existing = await getShareSecret(file.id);
      if (!existing?.share_password_hash || !existing.share_password_salt) {
        return NextResponse.json(
          { error: "Password share minimal 4 karakter." },
          { status: 400 },
        );
      }
      passwordHash = existing.share_password_hash;
      passwordSalt = existing.share_password_salt;
    } else {
      const secret = await hashPassword(payload.password);
      passwordHash = secret.hash;
      passwordSalt = secret.salt;
    }
  }

  const updated = await updateShareSettings(
    file.id,
    mode,
    mode === "private" ? null : shareToken,
    passwordHash,
    passwordSalt,
  );
  await logActivity({ userId: user.id, fileId: file.id, type: "share_updated", metadata: { mode } });

  return NextResponse.json({
    file: updated,
    shareUrl: mode === "private" ? null : `${getAppBaseUrl(request)}/share/${shareToken}`,
  });
}
