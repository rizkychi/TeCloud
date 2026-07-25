import { prisma } from "./db";
import { getEnv } from "./env";
import { THEME_PRESETS, type ThemeId } from "./units";

export async function getDefaultTheme(): Promise<ThemeId> {
  const row = await prisma.systemSetting.findUnique({ where: { key: "default_theme" } });
  const v = row?.value || "dark";
  return (THEME_PRESETS.some((t) => t.id === v) ? v : "dark") as ThemeId;
}

export async function getAllowedThemes(): Promise<ThemeId[]> {
  const row = await prisma.systemSetting.findUnique({ where: { key: "allowed_themes" } });
  if (!row?.value) return THEME_PRESETS.map((t) => t.id);
  try {
    const arr = JSON.parse(row.value) as string[];
    const allowed = arr.filter((id) => THEME_PRESETS.some((t) => t.id === id)) as ThemeId[];
    return allowed.length ? allowed : THEME_PRESETS.map((t) => t.id);
  } catch {
    return THEME_PRESETS.map((t) => t.id);
  }
}

export async function ensureSystemSettings() {
  const defQuota = getEnv().DEFAULT_QUOTA_BYTES;
  await prisma.systemSetting.upsert({
    where: { key: "default_quota_bytes" },
    create: { key: "default_quota_bytes", value: String(defQuota) },
    update: {},
  });
  await prisma.systemSetting.upsert({
    where: { key: "default_theme" },
    create: { key: "default_theme", value: "dark" },
    update: {},
  });
  await prisma.systemSetting.upsert({
    where: { key: "allowed_themes" },
    create: {
      key: "allowed_themes",
      value: JSON.stringify(THEME_PRESETS.map((t) => t.id)),
    },
    update: {},
  });
}
