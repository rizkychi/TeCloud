import { Readable } from "stream";
import JSZipImport from "jszip";
const JSZip = JSZipImport as unknown as typeof import("jszip");
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { jsonError, jsonOk, toPublicFile } from "@/lib/api";
import { getFolderOwned } from "@/lib/folders";
import { getStorage, newStorageKey } from "@/lib/storage";
import { zipSchema } from "@/lib/validations";
import { assertQuota } from "@/lib/quota";
import { getEnv } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function collectFolderFiles(folderId: string, ownerId: string, prefix: string) {
  const out: { storageKey: string; name: string; size: number }[] = [];
  const files = await prisma.fileObject.findMany({
    where: { folderId, ownerId, deletedAt: null },
  });
  for (const f of files) {
    out.push({ storageKey: f.storageKey, name: `${prefix}${f.name}`, size: Number(f.size) });
  }
  const children = await prisma.folder.findMany({
    where: { parentId: folderId, ownerId, deletedAt: null },
  });
  for (const c of children) {
    const nested = await collectFolderFiles(c.id, ownerId, `${prefix}${c.name}/`);
    out.push(...nested);
  }
  return out;
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json().catch(() => null);
    const parsed = zipSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, "VALIDATION_ERROR", "Invalid input");

    const { fileIds, folderIds, name, folderId } = parsed.data;
    if (!fileIds.length && !folderIds.length) {
      return jsonError(400, "VALIDATION_ERROR", "Select at least one item");
    }

    if (folderId) {
      const owned = await getFolderOwned(folderId, user.id);
      if (!owned) return jsonError(404, "NOT_FOUND", "Folder not found");
    }

    const entries: { storageKey: string; name: string; size: number }[] = [];
    if (fileIds.length) {
      const files = await prisma.fileObject.findMany({
        where: { id: { in: fileIds }, ownerId: user.id, deletedAt: null },
      });
      for (const f of files) entries.push({ storageKey: f.storageKey, name: f.name, size: Number(f.size) });
    }
    for (const fid of folderIds) {
      const folder = await getFolderOwned(fid, user.id);
      if (!folder) continue;
      const nested = await collectFolderFiles(fid, user.id, `${folder.name}/`);
      entries.push(...nested);
    }
    if (!entries.length) return jsonError(400, "VALIDATION_ERROR", "Nothing to zip");

    const est = entries.reduce((a, e) => a + e.size, 0);
    if (est > getEnv().MAX_UPLOAD_BYTES) {
      return jsonError(400, "MAX_SIZE", "Archive would exceed max size");
    }
    try {
      await assertQuota(user.id, est);
    } catch {
      return jsonError(413, "QUOTA_EXCEEDED", "Storage quota exceeded");
    }

    const zip = new JSZip();
    const storage = getStorage();
    for (const e of entries) {
      const stream = await storage.get(e.storageKey);
      const chunks: Buffer[] = [];
      for await (const c of stream) chunks.push(Buffer.from(c));
      zip.file(e.name, Buffer.concat(chunks));
    }

    const buf = Buffer.from(await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
    const zipName = (name || `archive-${Date.now()}`).replace(/\.zip$/i, "") + ".zip";
    const storageKey = newStorageKey(user.id, zipName);
    await storage.put(storageKey, Readable.from(buf), buf.length);

    const created = await prisma.fileObject.create({
      data: {
        ownerId: user.id,
        folderId: folderId ?? null,
        name: zipName,
        mimeType: "application/zip",
        size: BigInt(buf.length),
        storageKey,
      },
    });

    return jsonOk({ file: { ...toPublicFile(created), hasSharePassword: false } }, { status: 201 });
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") return jsonError(401, "UNAUTHORIZED", "Please sign in");
    console.error(e);
    return jsonError(500, "INTERNAL", "Something went wrong");
  }
}
