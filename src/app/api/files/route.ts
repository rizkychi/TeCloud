import { Readable } from "stream";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { jsonError, jsonOk, toPublicFile } from "@/lib/api";
import { getFolderOwned } from "@/lib/folders";
import { getEnv } from "@/lib/env";
import { getStorage, newStorageKey } from "@/lib/storage";
import { rateLimit } from "@/lib/rate-limit";
import { assertQuota } from "@/lib/quota";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const url = new URL(req.url);
    const folderIdParam = url.searchParams.get("folderId");
    const trash = url.searchParams.get("trash") === "1";
    const q = url.searchParams.get("q")?.trim();

    if (trash) {
      const files = await prisma.fileObject.findMany({
        where: { ownerId: user.id, deletedAt: { not: null } },
        orderBy: { deletedAt: "desc" },
      });
      return jsonOk({
        files: files.map((f) => ({
          ...toPublicFile(f),
          hasSharePassword: Boolean(f.sharePasswordHash),
        })),
      });
    }

    const folderId =
      folderIdParam && folderIdParam !== "root" ? folderIdParam : null;
    if (folderId) {
      const owned = await getFolderOwned(folderId, user.id);
      if (!owned) return jsonError(404, "NOT_FOUND", "Folder not found");
    }

    const files = await prisma.fileObject.findMany({
      where: {
        ownerId: user.id,
        folderId,
        deletedAt: null,
        ...(q
          ? { name: { contains: q, mode: "insensitive" as const } }
          : {}),
      },
      orderBy: { name: "asc" },
    });
    return jsonOk({
      files: files.map((f) => ({
        ...toPublicFile(f),
        hasSharePassword: Boolean(f.sharePasswordHash),
      })),
    });
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
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    const rl = rateLimit(`upload:${user.id}:${ip}`, 60, 60_000);
    if (!rl.ok) return jsonError(429, "RATE_LIMIT", "Too many uploads");

    const form = await req.formData();
    const file = form.get("file");
    const folderIdRaw = form.get("folderId");
    const folderId =
      typeof folderIdRaw === "string" && folderIdRaw && folderIdRaw !== "root"
        ? folderIdRaw
        : null;

    if (!(file instanceof File)) {
      return jsonError(400, "VALIDATION_ERROR", "file is required");
    }

    const max = getEnv().MAX_UPLOAD_BYTES;
    if (file.size > max) {
      return jsonError(400, "MAX_SIZE", `File exceeds limit of ${max} bytes`);
    }
    if (file.size <= 0) {
      return jsonError(400, "VALIDATION_ERROR", "Empty file");
    }

    try {
      await assertQuota(user.id, file.size);
    } catch (e) {
      if (e instanceof Error && e.message === "QUOTA_EXCEEDED") {
        return jsonError(413, "QUOTA_EXCEEDED", "Storage quota exceeded");
      }
      throw e;
    }

    if (folderId) {
      const owned = await getFolderOwned(folderId, user.id);
      if (!owned) return jsonError(404, "NOT_FOUND", "Folder not found");
    }

    const name = (file.name || "upload").slice(0, 255);
    const mimeType = (file.type || "application/octet-stream").slice(0, 255);
    const storageKey = newStorageKey(user.id, name);
    const storage = getStorage();

    const nodeStream = Readable.fromWeb(
      file.stream() as unknown as import("stream/web").ReadableStream,
    );
    await storage.put(storageKey, nodeStream, file.size);

    // Versioning: same name in same folder becomes next version
    const existing = await prisma.fileObject.findFirst({
      where: {
        ownerId: user.id,
        folderId,
        name,
        deletedAt: null,
        isLatest: true,
      },
      orderBy: { version: "desc" },
    });

    let created;
    if (existing) {
      const groupId = existing.versionGroupId || existing.id;
      await prisma.fileObject.update({
        where: { id: existing.id },
        data: { isLatest: false },
      });
      if (!existing.versionGroupId) {
        await prisma.fileObject.update({
          where: { id: existing.id },
          data: { versionGroupId: groupId },
        });
      }
      created = await prisma.fileObject.create({
        data: {
          ownerId: user.id,
          folderId,
          name,
          mimeType,
          size: BigInt(file.size),
          storageKey,
          version: existing.version + 1,
          versionGroupId: groupId,
          isLatest: true,
          visibility: existing.visibility,
          shareToken: existing.shareToken,
          sharePasswordHash: existing.sharePasswordHash,
          starred: existing.starred,
        },
      });
    } else {
      created = await prisma.fileObject.create({
        data: {
          ownerId: user.id,
          folderId,
          name,
          mimeType,
          size: BigInt(file.size),
          storageKey,
          version: 1,
          isLatest: true,
        },
      });
      created = await prisma.fileObject.update({
        where: { id: created.id },
        data: { versionGroupId: created.id },
      });
    }

    return jsonOk(
      {
        file: {
          ...toPublicFile(created),
          hasSharePassword: Boolean(created.sharePasswordHash),
        },
        versioned: Boolean(existing),
      },
      { status: 201 },
    );
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") {
      return jsonError(401, "UNAUTHORIZED", "Please sign in");
    }
    console.error(e);
    return jsonError(500, "INTERNAL", "Something went wrong");
  }
}
