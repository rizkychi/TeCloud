import { NextResponse } from "next/server";
import { getPasswordSecret, logActivity } from "../../../../lib/file-store";
import { guardMutation } from "../../../../lib/request-guards";
import { attachSession, publicUser, verifyPassword } from "../../../../lib/security";

export async function POST(request: Request) {
  const blocked = await guardMutation(request, {
    scope: "auth:signin",
    limit: 10,
    windowSeconds: 5 * 60,
  });
  if (blocked) return blocked;

  const payload = (await request.json().catch(() => ({}))) as {
    username?: string;
    password?: string;
  };
  const username = payload.username?.trim().toLowerCase();
  const password = payload.password || "";

  if (!username || !password) {
    return NextResponse.json({ error: "Username dan password wajib diisi." }, { status: 400 });
  }

  const secret = await getPasswordSecret(username);
  if (!secret || !(await verifyPassword(password, secret.passwordHash, secret.passwordSalt))) {
    await logActivity({ type: "signin_failed", metadata: { username } });
    return NextResponse.json({ error: "Username atau password salah." }, { status: 401 });
  }

  if (secret.user.status === "pending") {
    await logActivity({ userId: secret.user.id, type: "signin_pending" });
    return NextResponse.json({ error: "Akun belum diverifikasi lewat Telegram." }, { status: 403 });
  }

  if (secret.user.status === "suspended") {
    await logActivity({ userId: secret.user.id, type: "signin_suspended" });
    return NextResponse.json({ error: "Akun sedang dinonaktifkan." }, { status: 403 });
  }

  await logActivity({ userId: secret.user.id, type: "signin" });
  const response = NextResponse.json({ user: publicUser(secret.user) });
  await attachSession(response, secret.user);
  return response;
}
