import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/api";
import { getStorage } from "@/lib/storage";
import { Readable } from "stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

const PREVIEWABLE = [
  "image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp", "image/svg+xml",
  "application/pdf", "text/plain", "text/markdown", "text/csv", "application/json",
];

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const file = await prisma.fileObject.findFirst({ where: { id, ownerId: user.id, deletedAt: null } });
    if (!file) return jsonError(404, "NOT_FOUND", "Not found");

    const mime = file.mimeType || "application/octet-stream";
    const ok =
      PREVIEWABLE.includes(mime) ||
      mime.startsWith("image/") ||
      mime.startsWith("text/") ||
      mime === "application/pdf";
    if (!ok) return jsonError(415, "NOT_PREVIEWABLE", "Preview not supported for this type");

    // limit huge previews for text
    if ((mime.startsWith("text/") || mime === "application/json") && Number(file.size) > 2_000_000) {
      return jsonError(413, "TOO_LARGE", "Text preview limited to 2MB");
    }

    const stream = await getStorage().get(file.storageKey);
    const webStream = Readable.toWeb(stream) as unknown as ReadableStream;
    return new Response(webStream, {
      headers: {
        "Content-Type": mime,
        "Content-Length": file.size.toString(),
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(file.name)}`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") return jsonError(401, "UNAUTHORIZED", "Please sign in");
    console.error(e);
    return jsonError(500, "INTERNAL", "Something went wrong");
  }
}
