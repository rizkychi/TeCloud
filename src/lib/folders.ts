import { prisma } from "./db";

const MAX_DEPTH = 32;

export async function getFolderOwned(folderId: string, ownerId: string) {
  return prisma.folder.findFirst({
    where: { id: folderId, ownerId, deletedAt: null },
  });
}

export async function assertNoCycle(folderId: string, newParentId: string | null, ownerId: string) {
  if (!newParentId) return;
  if (newParentId === folderId) {
    throw new Error("CYCLE");
  }
  let current: string | null = newParentId;
  let depth = 0;
  while (current) {
    if (current === folderId) throw new Error("CYCLE");
    if (depth++ > MAX_DEPTH) throw new Error("MAX_DEPTH");
    const parent: { parentId: string | null } | null =
      await prisma.folder.findFirst({
        where: { id: current, ownerId },
        select: { parentId: true },
      });
    if (!parent) throw new Error("NOT_FOUND");
    current = parent.parentId;
  }
}

export async function getFolderDepth(parentId: string | null, ownerId: string): Promise<number> {
  let depth = 0;
  let current: string | null = parentId;
  while (current) {
    depth += 1;
    if (depth > MAX_DEPTH) throw new Error("MAX_DEPTH");
    const parent: { parentId: string | null } | null =
      await prisma.folder.findFirst({
        where: { id: current, ownerId, deletedAt: null },
        select: { parentId: true },
      });
    if (!parent) throw new Error("NOT_FOUND");
    current = parent.parentId;
  }
  return depth;
}

export async function buildBreadcrumb(folderId: string | null, ownerId: string) {
  const crumbs: { id: string; name: string }[] = [];
  let current: string | null = folderId;
  let guard = 0;
  while (current && guard++ < MAX_DEPTH) {
    const folder: { id: string; name: string; parentId: string | null } | null =
      await prisma.folder.findFirst({
        where: { id: current, ownerId, deletedAt: null },
        select: { id: true, name: true, parentId: true },
      });
    if (!folder) break;
    crumbs.unshift({ id: folder.id, name: folder.name });
    current = folder.parentId;
  }
  return crumbs;
}

export async function softDeleteFolderRecursive(folderId: string, ownerId: string) {
  const now = new Date();
  const queue: string[] = [folderId];
  const allFolderIds: string[] = [];

  while (queue.length) {
    const id = queue.shift()!;
    allFolderIds.push(id);
    const children = await prisma.folder.findMany({
      where: { parentId: id, ownerId, deletedAt: null },
      select: { id: true },
    });
    for (const c of children) queue.push(c.id);
  }

  await prisma.$transaction([
    prisma.fileObject.updateMany({
      where: { folderId: { in: allFolderIds }, ownerId, deletedAt: null },
      data: { deletedAt: now },
    }),
    prisma.folder.updateMany({
      where: { id: { in: allFolderIds }, ownerId, deletedAt: null },
      data: { deletedAt: now },
    }),
  ]);

  return allFolderIds;
}

export async function restoreFolder(folderId: string, ownerId: string) {
  const folder = await prisma.folder.findFirst({
    where: { id: folderId, ownerId, deletedAt: { not: null } },
  });
  if (!folder) throw new Error("NOT_FOUND");

  let parentId = folder.parentId;
  if (parentId) {
    const parent = await prisma.folder.findFirst({ where: { id: parentId, ownerId } });
    if (!parent || parent.deletedAt) parentId = null;
  }

  await prisma.folder.update({
    where: { id: folderId },
    data: { deletedAt: null, parentId },
  });

  // restore direct files that were deleted at same time roughly? restore only files in this folder still deleted
  await prisma.fileObject.updateMany({
    where: { folderId, ownerId, deletedAt: { not: null } },
    data: { deletedAt: null },
  });

  return prisma.folder.findUniqueOrThrow({ where: { id: folderId } });
}
