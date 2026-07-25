import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/api";
import { preferencesSchema } from "@/lib/validations";
import { setLocaleCookie } from "@/lib/i18n/locale";
import { getAllowedThemes } from "@/lib/settings";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireUser();
    const allowedThemes = await getAllowedThemes();
    return jsonOk({
      preferences: {
        theme: user.theme,
        viewMode: user.viewMode,
        locale: user.locale,
      },
      allowedThemes,
    });
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") {
      return jsonError(401, "UNAUTHORIZED", "Please sign in");
    }
    return jsonError(500, "INTERNAL", "Something went wrong");
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json().catch(() => null);
    const parsed = preferencesSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, "VALIDATION_ERROR", "Invalid input");

    const allowed = await getAllowedThemes();
    if (parsed.data.theme && !allowed.includes(parsed.data.theme)) {
      return jsonError(400, "THEME_NOT_ALLOWED", "Theme not allowed by admin");
    }

    const data: { theme?: string; viewMode?: string; locale?: string } = {};
    if (parsed.data.theme) data.theme = parsed.data.theme;
    if (parsed.data.viewMode) data.viewMode = parsed.data.viewMode;
    if (parsed.data.locale) {
      data.locale = parsed.data.locale;
      await setLocaleCookie(parsed.data.locale);
    }

    const updated = await prisma.user.update({ where: { id: user.id }, data });
    return jsonOk({
      preferences: {
        theme: updated.theme,
        viewMode: updated.viewMode,
        locale: updated.locale,
      },
      allowedThemes: allowed,
    });
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") {
      return jsonError(401, "UNAUTHORIZED", "Please sign in");
    }
    console.error(e);
    return jsonError(500, "INTERNAL", "Something went wrong");
  }
}
