import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/api";
import { getStorage } from "@/lib/storage";
import { isCodeLike, isImageMime } from "@/lib/format";
import { Readable } from "stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

function canPreview(mime: string, name: string) {
  const m = mime || "application/octet-stream";
  return (
    isImageMime(m) ||
    m === "application/pdf" ||
    name.toLowerCase().endsWith(".pdf") ||
    isCodeLike(m, name)
  );
}

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const file = await prisma.fileObject.findFirst({
      where: { id, ownerId: user.id, deletedAt: null },
    });
    if (!file) return jsonError(404, "NOT_FOUND", "Not found");

    const mime = file.mimeType || "application/octet-stream";
    if (!canPreview(mime, file.name)) {
      return jsonError(415, "NOT_PREVIEWABLE", "Preview not supported for this type");
    }

    const codeLike = isCodeLike(mime, file.name) && !isImageMime(mime) && mime !== "application/pdf";
    // limit huge text/code previews
    if (codeLike && Number(file.size) > 2_000_000) {
      return jsonError(413, "TOO_LARGE", "Text preview limited to 2MB");
    }

    const stream = await getStorage().get(file.storageKey);
    const webStream = Readable.toWeb(stream) as unknown as ReadableStream;

    // Force text/plain for scripts/HTML so browsers never execute them in iframe/img.
    // UI fetches as text and renders in a read-only code view.
    const responseMime = codeLike
      ? "text/plain; charset=utf-8"
      : isImageMime(mime)
        ? mime
        : mime === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
          ? "application/pdf"
          : mime;

    return new Response(webStream, {
      headers: {
        "Content-Type": responseMime,
        "Content-Length": file.size.toString(),
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(file.name)}`,
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") {
      return jsonError(401, "UNAUTHORIZED", "Please sign in");
    }
    console.error(e);
    return jsonError(500, "INTERNAL", "Something went wrong");
  }
}
