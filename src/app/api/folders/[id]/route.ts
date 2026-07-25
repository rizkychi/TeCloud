import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { folderUpdateSchema } from "@/lib/validations";
import { jsonError, jsonOk, toPublicFolder } from "@/lib/api";
import {
  assertNoCycle,
  getFolderOwned,
  restoreFolder,
  softDeleteFolderRecursive,
} from "@/lib/folders";
import { getStorage } from "@/lib/storage";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const folder = await getFolderOwned(id, user.id);
    if (!folder) return jsonError(404, "NOT_FOUND", "Not found");
    return jsonOk({ folder: toPublicFolder(folder) });
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") {
      return jsonError(401, "UNAUTHORIZED", "Please sign in");
    }
    return jsonError(500, "INTERNAL", "Something went wrong");
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const folder = await prisma.folder.findFirst({
      where: { id, ownerId: user.id, deletedAt: null },
    });
    if (!folder) return jsonError(404, "NOT_FOUND", "Not found");

    const body = await req.json().catch(() => null);
    const parsed = folderUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(400, "VALIDATION_ERROR", "Invalid input", parsed.error.flatten());
    }

    const data: { name?: string; parentId?: string | null; starred?: boolean } = {};
    if (parsed.data.name !== undefined) data.name = parsed.data.name.trim();
    if (parsed.data.starred !== undefined) data.starred = parsed.data.starred;
    if (parsed.data.parentId !== undefined) {
      const newParent = parsed.data.parentId;
      if (newParent) {
        const parent = await getFolderOwned(newParent, user.id);
        if (!parent) return jsonError(404, "NOT_FOUND", "Parent not found");
      }
      try {
        await assertNoCycle(id, newParent ?? null, user.id);
      } catch {
        return jsonError(400, "CYCLE", "Invalid folder move");
      }
      data.parentId = newParent ?? null;
    }

    const updated = await prisma.folder.update({ where: { id }, data });
    return jsonOk({ folder: toPublicFolder(updated) });
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") {
      return jsonError(401, "UNAUTHORIZED", "Please sign in");
    }
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
      try {
        const folder = await restoreFolder(id, user.id);
        return jsonOk({ folder: toPublicFolder(folder) });
      } catch {
        return jsonError(404, "NOT_FOUND", "Not found");
      }
    }

    if (permanent) {
      const folder = await prisma.folder.findFirst({
        where: { id, ownerId: user.id },
      });
      if (!folder) return jsonError(404, "NOT_FOUND", "Not found");

      // collect descendants
      const queue: string[] = [id];
      const allFolderIds: string[] = [];
      while (queue.length) {
        const fid = queue.shift()!;
        allFolderIds.push(fid);
        const children = await prisma.folder.findMany({
          where: { parentId: fid, ownerId: user.id },
          select: { id: true },
        });
        for (const c of children) queue.push(c.id);
      }
      const files = await prisma.fileObject.findMany({
        where: { folderId: { in: allFolderIds }, ownerId: user.id },
      });
      const storage = getStorage();
      for (const f of files) await storage.delete(f.storageKey);
      await prisma.fileObject.deleteMany({ where: { folderId: { in: allFolderIds }, ownerId: user.id } });
      await prisma.folder.deleteMany({ where: { id: { in: allFolderIds }, ownerId: user.id } });
      return jsonOk({ ok: true });
    }

    const folder = await getFolderOwned(id, user.id);
    if (!folder) return jsonError(404, "NOT_FOUND", "Not found");
    await softDeleteFolderRecursive(id, user.id);
    return jsonOk({ ok: true });
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") {
      return jsonError(401, "UNAUTHORIZED", "Please sign in");
    }
    console.error(e);
    return jsonError(500, "INTERNAL", "Something went wrong");
  }
}
