import { NextResponse } from "next/server";
import { activateUser, consumeAuthCode, getPasswordSecret, logActivity } from "../../../../lib/file-store";
import { guardMutation } from "../../../../lib/request-guards";
import { attachSession, publicUser, sha256 } from "../../../../lib/security";

export async function POST(request: Request) {
  const blocked = await guardMutation(request, {
    scope: "auth:verify",
    limit: 10,
    windowSeconds: 10 * 60,
  });
  if (blocked) return blocked;

  const payload = (await request.json().catch(() => ({}))) as {
    username?: string;
    code?: string;
  };
  const username = payload.username?.trim().toLowerCase();
  const code = payload.code?.trim();

  if (!username || !code) {
    return NextResponse.json({ error: "Username dan kode wajib diisi." }, { status: 400 });
  }

  const secret = await getPasswordSecret(username);
  if (!secret) {
    return NextResponse.json({ error: "Akun tidak ditemukan." }, { status: 404 });
  }

  const valid = await consumeAuthCode(secret.user.id, "signup", await sha256(code));
  if (!valid) {
    return NextResponse.json({ error: "Kode salah atau sudah kedaluwarsa." }, { status: 400 });
  }

  const user = await activateUser(secret.user.id);
  if (!user) {
    return NextResponse.json({ error: "Akun tidak ditemukan." }, { status: 404 });
  }

  await logActivity({ userId: user.id, type: "signup_verified" });
  const response = NextResponse.json({ user: publicUser(user) });
  await attachSession(response, user);
  return response;
}
