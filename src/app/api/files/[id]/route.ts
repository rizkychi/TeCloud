import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { fileUpdateSchema } from "@/lib/validations";
import { jsonError, jsonOk, toPublicFile } from "@/lib/api";
import { getFolderOwned } from "@/lib/folders";
import { getStorage } from "@/lib/storage";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const file = await prisma.fileObject.findFirst({
      where: { id, ownerId: user.id, deletedAt: null },
    });
    if (!file) return jsonError(404, "NOT_FOUND", "Not found");
    return jsonOk({
      file: { ...toPublicFile(file), hasSharePassword: Boolean(file.sharePasswordHash) },
    });
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") return jsonError(401, "UNAUTHORIZED", "Please sign in");
    return jsonError(500, "INTERNAL", "Something went wrong");
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const file = await prisma.fileObject.findFirst({ where: { id, ownerId: user.id, deletedAt: null } });
    if (!file) return jsonError(404, "NOT_FOUND", "Not found");

    const body = await req.json().catch(() => null);
    const parsed = fileUpdateSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, "VALIDATION_ERROR", "Invalid input", parsed.error.flatten());

    const data: { name?: string; folderId?: string | null; starred?: boolean } = {};
    if (parsed.data.name !== undefined) data.name = parsed.data.name.trim();
    if (parsed.data.starred !== undefined) data.starred = parsed.data.starred;
    if (parsed.data.folderId !== undefined) {
      const folderId = parsed.data.folderId;
      if (folderId) {
        const folder = await getFolderOwned(folderId, user.id);
        if (!folder) return jsonError(404, "NOT_FOUND", "Folder not found");
      }
      data.folderId = folderId ?? null;
    }

    const updated = await prisma.fileObject.update({ where: { id }, data });
    return jsonOk({ file: { ...toPublicFile(updated), hasSharePassword: Boolean(updated.sharePasswordHash) } });
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") return jsonError(401, "UNAUTHORIZED", "Please sign in");
    console.error(e);
    return jsonError(500, "INTERNAL", "Something went wrong");
  }
}

export async function DELETE(req: Request, ctx: Ctx) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const url = new URL(req.url);
    const permanent = url.searchParams.get("permanent") === "1";
    const restore = url.searchParams.get("restore") === "1";

    if (restore) {
      const file = await prisma.fileObject.findFirst({ where: { id, ownerId: user.id, deletedAt: { not: null } } });
      if (!file) return jsonError(404, "NOT_FOUND", "Not found");
      let folderId = file.folderId;
      if (folderId) {
        const parent = await prisma.folder.findFirst({ where: { id: folderId, ownerId: user.id } });
        if (!parent || parent.deletedAt) folderId = null;
      }
      const updated = await prisma.fileObject.update({ where: { id }, data: { deletedAt: null, folderId } });
      return jsonOk({ file: { ...toPublicFile(updated), hasSharePassword: Boolean(updated.sharePasswordHash) } });
    }

    if (permanent) {
      // allow permanent from trash OR direct forever from active
      const file = await prisma.fileObject.findFirst({ where: { id, ownerId: user.id } });
      if (!file) return jsonError(404, "NOT_FOUND", "Not found");
      await getStorage().delete(file.storageKey);
      await prisma.fileObject.delete({ where: { id } });
      return jsonOk({ ok: true });
    }

    const file = await prisma.fileObject.findFirst({ where: { id, ownerId: user.id, deletedAt: null } });
    if (!file) return jsonError(404, "NOT_FOUND", "Not found");
    await prisma.fileObject.update({ where: { id }, data: { deletedAt: new Date() } });
    return jsonOk({ ok: true });
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") return jsonError(401, "UNAUTHORIZED", "Please sign in");
    console.error(e);
    return jsonError(500, "INTERNAL", "Something went wrong");
  }
}
