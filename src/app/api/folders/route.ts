import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { folderCreateSchema } from "@/lib/validations";
import { jsonError, jsonOk, toPublicFolder } from "@/lib/api";
import { getFolderDepth, getFolderOwned } from "@/lib/folders";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const url = new URL(req.url);
    const parentId = url.searchParams.get("parentId");
    const trash = url.searchParams.get("trash") === "1";

    if (trash) {
      const folders = await prisma.folder.findMany({
        where: { ownerId: user.id, deletedAt: { not: null } },
        orderBy: { deletedAt: "desc" },
      });
      return jsonOk({ folders: folders.map(toPublicFolder) });
    }

    const parent = parentId && parentId !== "root" ? parentId : null;
    if (parent) {
      const owned = await getFolderOwned(parent, user.id);
      if (!owned) return jsonError(404, "NOT_FOUND", "Folder not found");
    }

    const folders = await prisma.folder.findMany({
      where: { ownerId: user.id, parentId: parent, deletedAt: null },
      orderBy: { name: "asc" },
    });
    return jsonOk({ folders: folders.map(toPublicFolder) });
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") {
      return jsonError(401, "UNAUTHORIZED", "Please sign in");
    }
    console.error(e);
    return jsonError(500, "INTERNAL", "Something went wrong");
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json().catch(() => null);
    const parsed = folderCreateSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(400, "VALIDATION_ERROR", "Invalid input", parsed.error.flatten());
    }
    const parentId = parsed.data.parentId ?? null;
    if (parentId) {
      const parent = await getFolderOwned(parentId, user.id);
      if (!parent) return jsonError(404, "NOT_FOUND", "Parent not found");
      try {
        await getFolderDepth(parentId, user.id);
      } catch {
        return jsonError(400, "MAX_DEPTH", "Folder depth limit reached");
      }
    }
    const folder = await prisma.folder.create({
      data: {
        ownerId: user.id,
        parentId,
        name: parsed.data.name.trim(),
      },
    });
    return jsonOk({ folder: toPublicFolder(folder) }, { status: 201 });
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") {
      return jsonError(401, "UNAUTHORIZED", "Please sign in");
    }
    console.error(e);
    return jsonError(500, "INTERNAL", "Something went wrong");
  }
}
