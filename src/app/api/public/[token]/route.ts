import { prisma } from "@/lib/db";
import { jsonError, jsonOk, toPublicFile, toPublicFolder } from "@/lib/api";
import { canAccessShare } from "@/lib/share-access";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ token: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { token } = await ctx.params;
  const access = await canAccessShare(token);
  if (!access.ok && access.reason === "NOT_FOUND") {
    return jsonError(404, "NOT_FOUND", "Not found");
  }
  if (!access.ok && access.reason === "PASSWORD_REQUIRED") {
    return jsonOk({
      needsPassword: true,
      kind: access.target.kind,
      name: access.target.name,
      visibility: "password",
    });
  }
  if (!access.ok) return jsonError(403, "FORBIDDEN", "Forbidden");

  const target = access.target;
  if (target.kind === "file") {
    return jsonOk({
      needsPassword: false,
      kind: "file",
      file: {
        id: target.id,
        name: target.name,
        mimeType: target.mimeType,
        size: target.size,
        visibility: target.visibility,
      },
    });
  }

  // folder listing (read-only)
  const [folders, files] = await Promise.all([
    prisma.folder.findMany({
      where: {
        ownerId: target.ownerId,
        parentId: target.id,
        deletedAt: null,
      },
      orderBy: { name: "asc" },
    }),
    prisma.fileObject.findMany({
      where: {
        ownerId: target.ownerId,
        folderId: target.id,
        deletedAt: null,
      },
      orderBy: { name: "asc" },
    }),
  ]);

  return jsonOk({
    needsPassword: false,
    kind: "folder",
    folder: { id: target.id, name: target.name, visibility: target.visibility },
    folders: folders.map(toPublicFolder),
    files: files.map((f) => ({
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
      size: Number(f.size),
      visibility: f.visibility,
    })),
  });
}
