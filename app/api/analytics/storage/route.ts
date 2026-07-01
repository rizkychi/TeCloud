import { NextResponse } from "next/server";
import { getStorageAnalytics } from "../../../../lib/file-store";
import { requireUser } from "../../../../lib/security";

export async function GET(request: Request) {
  const user = await requireUser(request);
  if (!user) {
    return NextResponse.json({ error: "Silakan masuk dulu." }, { status: 401 });
  }

  return NextResponse.json(await getStorageAnalytics(user.id));
}
