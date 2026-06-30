import { NextResponse } from "next/server";
import { consumeAuthCode, getPasswordSecret, logActivity, updateUserPassword } from "../../../../lib/file-store";
import { guardMutation } from "../../../../lib/request-guards";
import { hashPassword, sha256 } from "../../../../lib/security";

export async function POST(request: Request) {
  const blocked = await guardMutation(request, {
    scope: "auth:reset",
    limit: 5,
    windowSeconds: 15 * 60,
  });
  if (blocked) return blocked;

  const payload = (await request.json().catch(() => ({}))) as {
    username?: string;
    code?: string;
    password?: string;
  };
  const username = payload.username?.trim().toLowerCase();
  const code = payload.code?.trim();
  const password = payload.password || "";

  if (!username || !code || password.length < 8) {
    return NextResponse.json(
      { error: "Isi username, kode, dan password baru minimal 8 karakter." },
      { status: 400 },
    );
  }

  const secret = await getPasswordSecret(username);
  if (!secret) {
    return NextResponse.json({ error: "Akun tidak ditemukan." }, { status: 404 });
  }

  const valid = await consumeAuthCode(secret.user.id, "reset", await sha256(code));
  if (!valid) {
    return NextResponse.json({ error: "Kode salah atau sudah kedaluwarsa." }, { status: 400 });
  }

  const passwordSecret = await hashPassword(password);
  await updateUserPassword(secret.user.id, passwordSecret.hash, passwordSecret.salt);
  await logActivity({ userId: secret.user.id, type: "password_reset_completed" });

  return NextResponse.json({ ok: true });
}
