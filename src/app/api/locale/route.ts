import { localeSchema } from "@/lib/validations";
import { setLocaleCookie } from "@/lib/i18n/locale";
import { jsonError, jsonOk } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = localeSchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "VALIDATION_ERROR", "Invalid locale");
  await setLocaleCookie(parsed.data.locale);
  const user = await getCurrentUser();
  if (user) {
    await prisma.user.update({
      where: { id: user.id },
      data: { locale: parsed.data.locale },
    });
  }
  return jsonOk({ locale: parsed.data.locale });
}
