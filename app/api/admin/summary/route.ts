import { NextResponse } from "next/server";
import { getAdminSummary } from "../../../../lib/file-store";
import { requireAdmin } from "../../../../lib/security";

export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: "Butuh akses admin." }, { status: 403 });
  }

  return NextResponse.json(await getAdminSummary());
}
