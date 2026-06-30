import { NextResponse } from "next/server";
import { guardMutation } from "../../../../lib/request-guards";
import { clearSession } from "../../../../lib/security";

export async function POST(request: Request) {
  const blocked = await guardMutation(request, {
    scope: "auth:logout",
    limit: 30,
    windowSeconds: 60,
  });
  if (blocked) return blocked;

  const response = NextResponse.json({ ok: true });
  await clearSession(request, response);
  return response;
}
