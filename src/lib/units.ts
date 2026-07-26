export function gbToBytes(gb: number): number {
  if (!Number.isFinite(gb) || gb < 0) return 0;
  if (gb === 0) return 0; // unlimited sentinel
  return Math.round(gb * 1024 * 1024 * 1024);
}

export function bytesToGb(bytes: number, digits = 2): number {
  if (!Number.isFinite(bytes) || bytes <= 0) return 0;
  const gb = bytes / (1024 * 1024 * 1024);
  const f = 10 ** digits;
  return Math.round(gb * f) / f;
}

export function parseGbInput(value: string): number | null {
  const n = Number(String(value).replace(",", ".").trim());
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

export const THEME_PRESETS = [
  { id: "dark", label: "Dark", className: "dark" },
  { id: "light", label: "Light", className: "light" },
  { id: "ocean", label: "Ocean", className: "theme-ocean" },
  { id: "forest", label: "Forest", className: "theme-forest" },
  { id: "sunset", label: "Sunset", className: "theme-sunset" },
  // UI/UX Pro Max educational-platform inspired
  { id: "campus", label: "Campus", className: "theme-campus" },
] as const;

export type ThemeId = (typeof THEME_PRESETS)[number]["id"];

export function themeClass(theme: string): string {
  const t = THEME_PRESETS.find((p) => p.id === theme);
  return t?.className || "dark";
}
