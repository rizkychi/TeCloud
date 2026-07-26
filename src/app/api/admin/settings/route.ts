import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/api";
import { adminSettingsSchema } from "@/lib/validations";
import { getDefaultQuotaBytes, isUnlimitedQuota } from "@/lib/quota";
import { getAllowedThemes, getDefaultTheme, ensureSystemSettings } from "@/lib/settings";
import { bytesToGb, gbToBytes } from "@/lib/units";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireAdmin();
    await ensureSystemSettings();
    const defaultQuotaBytes = await getDefaultQuotaBytes();
    return jsonOk({
      defaultQuotaBytes,
      defaultQuotaGb: isUnlimitedQuota(defaultQuotaBytes) ? 0 : bytesToGb(defaultQuotaBytes),
      defaultQuotaUnlimited: isUnlimitedQuota(defaultQuotaBytes),
      defaultTheme: await getDefaultTheme(),
      allowedThemes: await getAllowedThemes(),
    });
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") return jsonError(401, "UNAUTHORIZED", "Please sign in");
    if (e instanceof Error && e.message === "FORBIDDEN") return jsonError(403, "FORBIDDEN", "Admin only");
    return jsonError(500, "INTERNAL", "Something went wrong");
  }
}

export async function PATCH(req: Request) {
  try {
    await requireAdmin();
    const body = await req.json().catch(() => null);
    const parsed = adminSettingsSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, "VALIDATION_ERROR", "Invalid input");

    if (parsed.data.defaultQuotaGb !== undefined) {
      const bytes = gbToBytes(parsed.data.defaultQuotaGb); // 0 stays 0 = unlimited
      await prisma.systemSetting.upsert({
        where: { key: "default_quota_bytes" },
        create: { key: "default_quota_bytes", value: String(bytes) },
        update: { value: String(bytes) },
      });
    }
    if (parsed.data.defaultTheme) {
      await prisma.systemSetting.upsert({
        where: { key: "default_theme" },
        create: { key: "default_theme", value: parsed.data.defaultTheme },
        update: { value: parsed.data.defaultTheme },
      });
    }
    if (parsed.data.allowedThemes) {
      await prisma.systemSetting.upsert({
        where: { key: "allowed_themes" },
        create: { key: "allowed_themes", value: JSON.stringify(parsed.data.allowedThemes) },
        update: { value: JSON.stringify(parsed.data.allowedThemes) },
      });
    }

    const defaultQuotaBytes = await getDefaultQuotaBytes();
    return jsonOk({
      defaultQuotaBytes,
      defaultQuotaGb: isUnlimitedQuota(defaultQuotaBytes) ? 0 : bytesToGb(defaultQuotaBytes),
      defaultQuotaUnlimited: isUnlimitedQuota(defaultQuotaBytes),
      defaultTheme: await getDefaultTheme(),
      allowedThemes: await getAllowedThemes(),
    });
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") return jsonError(401, "UNAUTHORIZED", "Please sign in");
    if (e instanceof Error && e.message === "FORBIDDEN") return jsonError(403, "FORBIDDEN", "Admin only");
    console.error(e);
    return jsonError(500, "INTERNAL", "Something went wrong");
  }
}
