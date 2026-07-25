import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { jsonError, jsonOk, toPublicFile, toPublicFolder } from "@/lib/api";
import { starSchema } from "@/lib/validations";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json().catch(() => null);
    const parsed = starSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, "VALIDATION_ERROR", "Invalid input");
    const { kind, id, starred } = parsed.data;

    if (kind === "file") {
      const file = await prisma.fileObject.findFirst({
        where: { id, ownerId: user.id, deletedAt: null },
      });
      if (!file) return jsonError(404, "NOT_FOUND", "Not found");
      const updated = await prisma.fileObject.update({
        where: { id },
        data: { starred },
      });
      return jsonOk({ file: { ...toPublicFile(updated), hasSharePassword: Boolean(updated.sharePasswordHash) } });
    }

    const folder = await prisma.folder.findFirst({
      where: { id, ownerId: user.id, deletedAt: null },
    });
    if (!folder) return jsonError(404, "NOT_FOUND", "Not found");
    const updated = await prisma.folder.update({
      where: { id },
      data: { starred },
    });
    return jsonOk({ folder: toPublicFolder(updated) });
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") return jsonError(401, "UNAUTHORIZED", "Please sign in");
    console.error(e);
    return jsonError(500, "INTERNAL", "Something went wrong");
  }
}
