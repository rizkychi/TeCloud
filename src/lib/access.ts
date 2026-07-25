import { prisma } from "./db";

export async function touchFileAccess(id: string, ownerId: string) {
  await prisma.fileObject.updateMany({
    where: { id, ownerId },
    data: { lastAccessedAt: new Date() },
  });
}

export async function touchFolderAccess(id: string, ownerId: string) {
  await prisma.folder.updateMany({
    where: { id, ownerId },
    data: { lastAccessedAt: new Date() },
  });
}
