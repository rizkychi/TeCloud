import { NextResponse } from "next/server";
import { findSharedFile } from "../../../../lib/file-store";
import { requireRateLimit } from "../../../../lib/request-guards";

type RouteContext = {
  params: Promise<{ token: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const blocked = await requireRateLimit(_request, {
    scope: "share:metadata",
    limit: 300,
    windowSeconds: 15 * 60,
  });
  if (blocked) return blocked;

  const params = await context.params;
  const file = await findSharedFile(params.token);

  if (!file) {
    return NextResponse.json({ error: "Link tidak ditemukan." }, { status: 404 });
  }

  return NextResponse.json({
    file: {
      name: file.name,
      size: file.size,
      mimeType: file.mimeType,
      shareMode: file.shareMode,
      downloadCount: file.downloadCount,
      updatedAt: file.updatedAt,
    },
  });
}
