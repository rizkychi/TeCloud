import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { jsonError, jsonOk, toPublicFile, toPublicFolder } from "@/lib/api";
import { buildBreadcrumb, getFolderOwned } from "@/lib/folders";
import { touchFolderAccess } from "@/lib/access";
import { attachPathLabels } from "@/lib/path-label";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SortKey = "name" | "size" | "modified" | "type";
type SortDir = "asc" | "desc";

function sortItems<T extends { name: string; updatedAt?: string; createdAt?: string; size?: number; type: string }>(
  items: T[],
  sort: SortKey,
  dir: SortDir,
) {
  const mul = dir === "desc" ? -1 : 1;
  return [...items].sort((a, b) => {
    if (sort === "name") return a.name.localeCompare(b.name) * mul;
    if (sort === "size") return ((a.size || 0) - (b.size || 0)) * mul;
    if (sort === "type") return a.type.localeCompare(b.type) * mul || a.name.localeCompare(b.name) * mul;
    const ta = new Date(a.updatedAt || a.createdAt || 0).getTime();
    const tb = new Date(b.updatedAt || b.createdAt || 0).getTime();
    return (ta - tb) * mul;
  });
}

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const url = new URL(req.url);
    const folderIdParam = url.searchParams.get("folderId");
    const trash = url.searchParams.get("trash") === "1";
    const starred = url.searchParams.get("starred") === "1";
    const recent = url.searchParams.get("recent") === "1";
    const q = url.searchParams.get("q")?.trim() || "";
    const typeFilter = url.searchParams.get("type") || "all"; // all|file|folder|image|pdf|zip
    const sort = (url.searchParams.get("sort") as SortKey) || "name";
    const dir = (url.searchParams.get("dir") as SortDir) || "asc";
    const includeVersions = url.searchParams.get("versions") === "1";

    if (trash) {
      const [folders, files] = await Promise.all([
        prisma.folder.findMany({
          where: {
            ownerId: user.id,
            deletedAt: { not: null },
            ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
          },
          orderBy: { deletedAt: "desc" },
        }),
        prisma.fileObject.findMany({
          where: {
            ownerId: user.id,
            deletedAt: { not: null },
            ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
          },
          orderBy: { deletedAt: "desc" },
        }),
      ]);
      return jsonOk({
        mode: "trash",
        folderId: null,
        breadcrumb: [],
        folders: folders.map(toPublicFolder),
        files: files.map((f) => ({ ...toPublicFile(f), hasSharePassword: Boolean(f.sharePasswordHash) })),
      });
    }

    if (starred) {
      const [folders, files] = await Promise.all([
        prisma.folder.findMany({
          where: {
            ownerId: user.id,
            deletedAt: null,
            starred: true,
            ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
          },
        }),
        prisma.fileObject.findMany({
          where: {
            ownerId: user.id,
            deletedAt: null,
            starred: true,
            isLatest: true,
            ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
          },
        }),
      ]);
      let folderItems = folders.map(toPublicFolder);
      let fileItems = files.map((f) => ({ ...toPublicFile(f), hasSharePassword: Boolean(f.sharePasswordHash) }));
      if (typeFilter === "folder") fileItems = [];
      if (typeFilter === "file" || typeFilter === "image" || typeFilter === "pdf" || typeFilter === "zip") {
        folderItems = [];
        fileItems = fileItems.filter((f) => matchType(f.mimeType, f.name, typeFilter));
      }
      const withPaths = await attachPathLabels(user.id, folderItems, fileItems);
      return jsonOk({
        mode: "starred",
        folderId: null,
        breadcrumb: [],
        folders: sortItems(withPaths.folders, sort, dir),
        files: sortItems(withPaths.files, sort, dir),
      });
    }

    if (recent) {
      const [folders, files] = await Promise.all([
        prisma.folder.findMany({
          where: {
            ownerId: user.id,
            deletedAt: null,
            lastAccessedAt: { not: null },
            ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
          },
          orderBy: { lastAccessedAt: "desc" },
          take: 50,
        }),
        prisma.fileObject.findMany({
          where: {
            ownerId: user.id,
            deletedAt: null,
            isLatest: true,
            lastAccessedAt: { not: null },
            ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
          },
          orderBy: { lastAccessedAt: "desc" },
          take: 50,
        }),
      ]);
      const folderItems = folders.map(toPublicFolder);
      const fileItems = files.map((f) => ({ ...toPublicFile(f), hasSharePassword: Boolean(f.sharePasswordHash) }));
      const withPaths = await attachPathLabels(user.id, folderItems, fileItems);
      return jsonOk({
        mode: "recent",
        folderId: null,
        breadcrumb: [],
        folders: withPaths.folders,
        files: withPaths.files,
      });
    }

    // global search across drive
    if (q && !folderIdParam) {
      const [folders, files] = await Promise.all([
        prisma.folder.findMany({
          where: {
            ownerId: user.id,
            deletedAt: null,
            name: { contains: q, mode: "insensitive" },
          },
          take: 100,
        }),
        prisma.fileObject.findMany({
          where: {
            ownerId: user.id,
            deletedAt: null,
            isLatest: includeVersions ? undefined : true,
            name: { contains: q, mode: "insensitive" },
          },
          take: 100,
        }),
      ]);
      let folderItems = folders.map(toPublicFolder);
      let fileItems = files.map((f) => ({ ...toPublicFile(f), hasSharePassword: Boolean(f.sharePasswordHash) }));
      if (typeFilter === "folder") fileItems = [];
      if (typeFilter !== "all" && typeFilter !== "folder") {
        folderItems = [];
        fileItems = fileItems.filter((f) => matchType(f.mimeType, f.name, typeFilter));
      }
      const withPaths = await attachPathLabels(user.id, folderItems, fileItems);
      return jsonOk({
        mode: "search",
        folderId: null,
        breadcrumb: [],
        query: q,
        folders: sortItems(withPaths.folders, sort, dir),
        files: sortItems(withPaths.files, sort, dir),
      });
    }

    const folderId = folderIdParam && folderIdParam !== "root" ? folderIdParam : null;
    if (folderId) {
      const owned = await getFolderOwned(folderId, user.id);
      if (!owned) return jsonError(404, "NOT_FOUND", "Folder not found");
      await touchFolderAccess(folderId, user.id);
    }

    const [folders, files, breadcrumb] = await Promise.all([
      prisma.folder.findMany({
        where: {
          ownerId: user.id,
          parentId: folderId,
          deletedAt: null,
          ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
        },
      }),
      prisma.fileObject.findMany({
        where: {
          ownerId: user.id,
          folderId,
          deletedAt: null,
          isLatest: includeVersions ? undefined : true,
          ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
        },
      }),
      buildBreadcrumb(folderId, user.id),
    ]);

    let folderItems = folders.map(toPublicFolder);
    let fileItems = files.map((f) => ({ ...toPublicFile(f), hasSharePassword: Boolean(f.sharePasswordHash) }));
    if (typeFilter === "folder") fileItems = [];
    if (typeFilter !== "all" && typeFilter !== "folder") {
      folderItems = [];
      fileItems = fileItems.filter((f) => matchType(f.mimeType, f.name, typeFilter));
    }

    return jsonOk({
      mode: "drive",
      folderId,
      breadcrumb,
      folders: sortItems(folderItems, sort, dir),
      files: sortItems(fileItems, sort, dir),
    });
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") {
      return jsonError(401, "UNAUTHORIZED", "Please sign in");
    }
    console.error(e);
    return jsonError(500, "INTERNAL", "Something went wrong");
  }
}

function matchType(mime: string, name: string, typeFilter: string) {
  const lower = name.toLowerCase();
  if (typeFilter === "file") return true;
  if (typeFilter === "image") return mime.startsWith("image/");
  if (typeFilter === "pdf") return mime === "application/pdf" || lower.endsWith(".pdf");
  if (typeFilter === "zip") return mime === "application/zip" || lower.endsWith(".zip");
  return true;
}
