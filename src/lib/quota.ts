import { prisma } from "./db";
import { getEnv } from "./env";

export async function getDefaultQuotaBytes(): Promise<number> {
  const row = await prisma.systemSetting.findUnique({ where: { key: "default_quota_bytes" } });
  if (row?.value) {
    const n = Number(row.value);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return getEnv().DEFAULT_QUOTA_BYTES;
}

export async function getUserQuotaBytes(user: { quotaBytes: bigint | null }): Promise<number> {
  if (user.quotaBytes != null) return Number(user.quotaBytes);
  return getDefaultQuotaBytes();
}

export async function getUserUsageBytes(userId: string): Promise<number> {
  const agg = await prisma.fileObject.aggregate({
    where: { ownerId: userId, deletedAt: null },
    _sum: { size: true },
  });
  return Number(agg._sum.size || BigInt(0));
}

export async function assertQuota(userId: string, additionalBytes: number) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const quota = await getUserQuotaBytes(user);
  const used = await getUserUsageBytes(userId);
  if (used + additionalBytes > quota) {
    const err = new Error("QUOTA_EXCEEDED");
    throw err;
  }
  return { quota, used };
}
