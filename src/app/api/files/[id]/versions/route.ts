import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { jsonError, jsonOk, toPublicFile } from "@/lib/api";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const file = await prisma.fileObject.findFirst({
      where: { id, ownerId: user.id },
    });
    if (!file) return jsonError(404, "NOT_FOUND", "Not found");
    const groupId = file.versionGroupId || file.id;
    const versions = await prisma.fileObject.findMany({
      where: {
        ownerId: user.id,
        OR: [{ id: groupId }, { versionGroupId: groupId }],
      },
      orderBy: { version: "desc" },
    });
    return jsonOk({
      versions: versions.map((f) => ({
        ...toPublicFile(f),
        hasSharePassword: Boolean(f.sharePasswordHash),
      })),
    });
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") return jsonError(401, "UNAUTHORIZED", "Please sign in");
    console.error(e);
    return jsonError(500, "INTERNAL", "Something went wrong");
  }
}
