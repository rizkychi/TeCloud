import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { shareSchema } from "@/lib/validations";
import { jsonError, jsonOk, toPublicFolder } from "@/lib/api";
import { hashPassword } from "@/lib/crypto";
import { newShareToken } from "@/lib/share-access";
import { getEnv } from "@/lib/env";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const folder = await prisma.folder.findFirst({
      where: { id, ownerId: user.id, deletedAt: null },
    });
    if (!folder) return jsonError(404, "NOT_FOUND", "Not found");

    const body = await req.json().catch(() => null);
    const parsed = shareSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(400, "VALIDATION_ERROR", "Invalid input", parsed.error.flatten());
    }

    const { visibility, password } = parsed.data;
    let shareToken = folder.shareToken;
    let sharePasswordHash = folder.sharePasswordHash;

    if (visibility === "private") {
      shareToken = null;
      sharePasswordHash = null;
    } else {
      if (!shareToken) shareToken = newShareToken();
      if (visibility === "password") {
        if (!password && !sharePasswordHash) {
          return jsonError(400, "VALIDATION_ERROR", "Password required for password visibility");
        }
        if (password) sharePasswordHash = await hashPassword(password);
      } else {
        sharePasswordHash = null;
      }
    }

    const updated = await prisma.folder.update({
      where: { id },
      data: { visibility, shareToken, sharePasswordHash },
    });

    const appUrl = getEnv().APP_URL.replace(/\/$/, "");
    const shareUrl =
      updated.shareToken && updated.visibility !== "private"
        ? `${appUrl}/s/${updated.shareToken}`
        : null;

    return jsonOk({
      folder: {
        ...toPublicFolder(updated),
        hasSharePassword: Boolean(updated.sharePasswordHash),
      },
      shareUrl,
    });
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") {
      return jsonError(401, "UNAUTHORIZED", "Please sign in");
    }
    console.error(e);
    return jsonError(500, "INTERNAL", "Something went wrong");
  }
}
