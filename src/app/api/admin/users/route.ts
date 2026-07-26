import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/api";
import { getDefaultQuotaBytes, isUnlimitedQuota } from "@/lib/quota";
import { bytesToGb } from "@/lib/units";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdmin();
    const defaultQuota = await getDefaultQuotaBytes();
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        locale: true,
        quotaBytes: true,
        disabled: true,
        theme: true,
        verifiedAt: true,
        telegramId: true,
        createdAt: true,
        _count: { select: { files: true, folders: true, sessions: true } },
      },
    });

    const usage = await prisma.fileObject.groupBy({
      by: ["ownerId"],
      where: { deletedAt: null, isLatest: true },
      _sum: { size: true },
      _count: { _all: true },
    });
    const usageMap = Object.fromEntries(
      usage.map((u) => [u.ownerId, { bytes: Number(u._sum.size || BigInt(0)), files: u._count._all }]),
    );

    return jsonOk({
      defaultQuotaBytes: defaultQuota,
      defaultQuotaGb: isUnlimitedQuota(defaultQuota) ? 0 : bytesToGb(defaultQuota),
      defaultQuotaUnlimited: isUnlimitedQuota(defaultQuota),
      users: users.map((u) => {
        const usedBytes = usageMap[u.id]?.bytes || 0;
        const custom = u.quotaBytes != null ? Number(u.quotaBytes) : null;
        const effective = custom != null ? custom : defaultQuota;
        const unlimited = isUnlimitedQuota(effective);
        return {
          id: u.id,
          username: u.username,
          name: u.name,
          role: u.role,
          locale: u.locale,
          disabled: u.disabled,
          verified: Boolean(u.verifiedAt),
          telegramId: u.telegramId,
          theme: u.theme,
          quotaBytes: custom,
          quotaGb: custom == null ? null : isUnlimitedQuota(custom) ? 0 : bytesToGb(custom),
          quotaUnlimited: unlimited,
          quotaMode: custom == null ? "default" : isUnlimitedQuota(custom) ? "unlimited" : "custom",
          effectiveQuotaBytes: effective,
          effectiveQuotaGb: unlimited ? 0 : bytesToGb(effective),
          usedBytes,
          usedGb: bytesToGb(usedBytes),
          fileCount: usageMap[u.id]?.files ?? u._count.files,
          folderCount: u._count.folders,
          sessionCount: u._count.sessions,
          createdAt: u.createdAt.toISOString(),
        };
      }),
    });
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") return jsonError(401, "UNAUTHORIZED", "Please sign in");
    if (e instanceof Error && e.message === "FORBIDDEN") return jsonError(403, "FORBIDDEN", "Admin only");
    console.error(e);
    return jsonError(500, "INTERNAL", "Something went wrong");
  }
}
