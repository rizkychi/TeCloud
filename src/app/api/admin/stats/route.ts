import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/api";
import { getDefaultQuotaBytes } from "@/lib/quota";
import { bytesToGb } from "@/lib/units";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdmin();
    const [
      users,
      activeUsers,
      disabledUsers,
      admins,
      files,
      folders,
      starredFiles,
      starredFolders,
      usage,
      recentUsers,
      topUsage,
      shares,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { disabled: false } }),
      prisma.user.count({ where: { disabled: true } }),
      prisma.user.count({ where: { role: "admin" } }),
      prisma.fileObject.count({ where: { deletedAt: null, isLatest: true } }),
      prisma.folder.count({ where: { deletedAt: null } }),
      prisma.fileObject.count({ where: { deletedAt: null, starred: true, isLatest: true } }),
      prisma.folder.count({ where: { deletedAt: null, starred: true } }),
      prisma.fileObject.aggregate({
        where: { deletedAt: null, isLatest: true },
        _sum: { size: true },
        _avg: { size: true },
      }),
      prisma.user.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        select: { id: true, username: true, name: true, createdAt: true, role: true, disabled: true },
      }),
      prisma.fileObject.groupBy({
        by: ["ownerId"],
        where: { deletedAt: null, isLatest: true },
        _sum: { size: true },
        _count: { _all: true },
        orderBy: { _sum: { size: "desc" } },
        take: 10,
      }),
      prisma.fileObject.count({
        where: { deletedAt: null, visibility: { in: ["public", "password"] }, isLatest: true },
      }),
    ]);

    const ownerIds = topUsage.map((r) => r.ownerId);
    const owners = await prisma.user.findMany({
      where: { id: { in: ownerIds } },
      select: { id: true, username: true, name: true },
    });
    const ownerMap = Object.fromEntries(owners.map((o) => [o.id, o]));

    // 30-day charts
    const days = 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const [uploads, signups] = await Promise.all([
      prisma.fileObject.findMany({
        where: { createdAt: { gte: since }, deletedAt: null },
        select: { createdAt: true, size: true },
      }),
      prisma.user.findMany({
        where: { createdAt: { gte: since } },
        select: { createdAt: true },
      }),
    ]);

    const uploadsByDay: Record<string, { count: number; bytes: number }> = {};
    const signupsByDay: Record<string, number> = {};
    for (let i = days - 1; i >= 0; i--) {
      const key = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      uploadsByDay[key] = { count: 0, bytes: 0 };
      signupsByDay[key] = 0;
    }
    for (const u of uploads) {
      const key = u.createdAt.toISOString().slice(0, 10);
      if (!uploadsByDay[key]) uploadsByDay[key] = { count: 0, bytes: 0 };
      uploadsByDay[key].count += 1;
      uploadsByDay[key].bytes += Number(u.size);
    }
    for (const s of signups) {
      const key = s.createdAt.toISOString().slice(0, 10);
      signupsByDay[key] = (signupsByDay[key] || 0) + 1;
    }

    // mime distribution
    const mimeRows = await prisma.fileObject.groupBy({
      by: ["mimeType"],
      where: { deletedAt: null, isLatest: true },
      _count: { _all: true },
      _sum: { size: true },
      orderBy: { _count: { mimeType: "desc" } },
      take: 8,
    });

    const storageBytes = Number(usage._sum.size || BigInt(0));
    const defaultQuotaBytes = await getDefaultQuotaBytes();

    return jsonOk({
      totals: {
        users,
        activeUsers,
        disabledUsers,
        admins,
        files,
        folders,
        starredFiles,
        starredFolders,
        sharedFiles: shares,
        storageBytes,
        storageGb: bytesToGb(storageBytes),
        avgFileBytes: Number(usage._avg.size || 0),
        defaultQuotaBytes,
        defaultQuotaGb: bytesToGb(defaultQuotaBytes),
      },
      recentUsers,
      topUsers: topUsage.map((r) => ({
        userId: r.ownerId,
        username: ownerMap[r.ownerId]?.username || "?",
        name: ownerMap[r.ownerId]?.name || "?",
        files: r._count._all,
        bytes: Number(r._sum.size || BigInt(0)),
        gb: bytesToGb(Number(r._sum.size || BigInt(0))),
      })),
      uploadsByDay: Object.entries(uploadsByDay).map(([date, v]) => ({ date, ...v, gb: bytesToGb(v.bytes) })),
      signupsByDay: Object.entries(signupsByDay).map(([date, count]) => ({ date, count })),
      mimeBreakdown: mimeRows.map((m) => ({
        mimeType: m.mimeType || "unknown",
        count: m._count._all,
        bytes: Number(m._sum.size || BigInt(0)),
      })),
    });
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") return jsonError(401, "UNAUTHORIZED", "Please sign in");
    if (e instanceof Error && e.message === "FORBIDDEN") return jsonError(403, "FORBIDDEN", "Admin only");
    console.error(e);
    return jsonError(500, "INTERNAL", "Something went wrong");
  }
}
