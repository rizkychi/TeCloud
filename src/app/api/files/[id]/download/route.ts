import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/api";
import { getStorage } from "@/lib/storage";
import { touchFileAccess } from "@/lib/access";
import { Readable } from "stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const file = await prisma.fileObject.findFirst({
      where: { id, ownerId: user.id, deletedAt: null },
    });
    if (!file) return jsonError(404, "NOT_FOUND", "Not found");
    await touchFileAccess(id, user.id);

    const stream = await getStorage().get(file.storageKey);
    const webStream = Readable.toWeb(stream) as unknown as ReadableStream;

    const disposition = `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`;
    return new Response(webStream, {
      headers: {
        "Content-Type": file.mimeType || "application/octet-stream",
        "Content-Length": file.size.toString(),
        "Content-Disposition": disposition,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
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
