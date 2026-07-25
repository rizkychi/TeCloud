import { Readable } from "stream";
import JSZipImport from "jszip";
const JSZip = JSZipImport as unknown as typeof import("jszip");
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { jsonError, jsonOk, toPublicFile } from "@/lib/api";
import { getFolderOwned } from "@/lib/folders";
import { getStorage, newStorageKey } from "@/lib/storage";
import { unzipSchema } from "@/lib/validations";
import { assertQuota } from "@/lib/quota";
import { getEnv } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function guessMime(name: string) {
  const lower = name.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".txt")) return "text/plain";
  if (lower.endsWith(".json")) return "application/json";
  if (lower.endsWith(".md")) return "text/markdown";
  if (lower.endsWith(".csv")) return "text/csv";
  if (lower.endsWith(".zip")) return "application/zip";
  return "application/octet-stream";
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json().catch(() => null);
    const parsed = unzipSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, "VALIDATION_ERROR", "Invalid input");

    const file = await prisma.fileObject.findFirst({
      where: { id: parsed.data.fileId, ownerId: user.id, deletedAt: null },
    });
    if (!file) return jsonError(404, "NOT_FOUND", "Not found");
    if (!file.name.toLowerCase().endsWith(".zip") && file.mimeType !== "application/zip") {
      return jsonError(400, "NOT_ZIP", "File is not a zip archive");
    }

    let targetFolderId = parsed.data.folderId ?? file.folderId ?? null;
    if (targetFolderId) {
      const owned = await getFolderOwned(targetFolderId, user.id);
      if (!owned) return jsonError(404, "NOT_FOUND", "Folder not found");
    }

    const storage = getStorage();
    const stream = await storage.get(file.storageKey);
    const chunks: Buffer[] = [];
    for await (const c of stream) chunks.push(Buffer.from(c));
    const buf = Buffer.concat(chunks);
    if (buf.length > getEnv().MAX_UPLOAD_BYTES) {
      return jsonError(400, "MAX_SIZE", "Zip too large");
    }

    const zip = await JSZip.loadAsync(buf);
    const createdFiles = [];
    let total = 0;
    const entries: { path: string; data: Buffer }[] = [];

    for (const [path, entry] of Object.entries(zip.files)) {
      if (entry.dir) continue;
      if (path.includes("..")) continue;
      const data = Buffer.from(await entry.async("uint8array"));
      total += data.length;
      if (total > getEnv().MAX_UPLOAD_BYTES) {
        return jsonError(400, "MAX_SIZE", "Extracted content exceeds max size");
      }
      entries.push({ path, data });
    }

    try {
      await assertQuota(user.id, total);
    } catch {
      return jsonError(413, "QUOTA_EXCEEDED", "Storage quota exceeded");
    }

    // create nested folders as needed under target
    const folderCache = new Map<string, string | null>();
    folderCache.set("", targetFolderId);

    async function ensureFolderPath(rel: string): Promise<string | null> {
      if (folderCache.has(rel)) return folderCache.get(rel)!;
      const parts = rel.split("/").filter(Boolean);
      let parent: string | null = targetFolderId;
      let acc = "";
      for (const part of parts) {
        acc = acc ? `${acc}/${part}` : part;
        if (folderCache.has(acc)) {
          parent = folderCache.get(acc)!;
          continue;
        }
        const existing = await prisma.folder.findFirst({
          where: { ownerId: user.id, parentId: parent, name: part, deletedAt: null },
        });
        if (existing) {
          parent = existing.id;
          folderCache.set(acc, parent);
          continue;
        }
        const created = await prisma.folder.create({
          data: { ownerId: user.id, parentId: parent, name: part },
        });
        parent = created.id;
        folderCache.set(acc, parent);
      }
      return parent;
    }

    for (const e of entries) {
      const parts = e.path.replace(/\\/g, "/").split("/");
      const baseName = parts.pop() || "file";
      const dir = parts.join("/");
      const folderId = dir ? await ensureFolderPath(dir) : targetFolderId;
      const storageKey = newStorageKey(user.id, baseName);
      await storage.put(storageKey, Readable.from(e.data), e.data.length);
      const created = await prisma.fileObject.create({
        data: {
          ownerId: user.id,
          folderId,
          name: baseName.slice(0, 255),
          mimeType: guessMime(baseName),
          size: BigInt(e.data.length),
          storageKey,
        },
      });
      createdFiles.push({ ...toPublicFile(created), hasSharePassword: false });
    }

    return jsonOk({ files: createdFiles, count: createdFiles.length }, { status: 201 });
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") return jsonError(401, "UNAUTHORIZED", "Please sign in");
    console.error(e);
    return jsonError(500, "INTERNAL", "Something went wrong");
  }
}
