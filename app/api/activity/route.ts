import { NextResponse } from "next/server";
import { listUserActivity } from "../../../lib/file-store";
import { requireUser } from "../../../lib/security";

export async function GET(request: Request) {
  const user = await requireUser(request);
  if (!user) {
    return NextResponse.json({ error: "Silakan masuk dulu." }, { status: 401 });
  }

  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") || 24);
  const events = await listUserActivity(user.id, limit);

  return NextResponse.json({ events });
}
