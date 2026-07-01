import { NextResponse } from "next/server";
import { findSharedFile, isShareDownloadLimitReached, isShareExpired } from "../../../../lib/file-store";
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

  if (isShareExpired(file)) {
    return NextResponse.json({ error: "Link share sudah kedaluwarsa." }, { status: 410 });
  }

  if (isShareDownloadLimitReached(file)) {
    return NextResponse.json({ error: "Batas download link share sudah tercapai." }, { status: 410 });
  }

  return NextResponse.json({
    file: {
      name: file.name,
      size: file.size,
      mimeType: file.mimeType,
      shareMode: file.shareMode,
      downloadCount: file.downloadCount,
      shareExpiresAt: file.shareExpiresAt,
      shareDownloadLimit: file.shareDownloadLimit,
      shareDownloadCount: file.shareDownloadCount,
      updatedAt: file.updatedAt,
    },
  });
}
