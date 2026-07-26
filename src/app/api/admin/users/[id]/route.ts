import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/api";
import { adminUserUpdateSchema } from "@/lib/validations";
import { hashPassword } from "@/lib/crypto";
import { gbToBytes } from "@/lib/units";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const admin = await requireAdmin();
    const { id } = await ctx.params;
    const body = await req.json().catch(() => null);
    const parsed = adminUserUpdateSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, "VALIDATION_ERROR", "Invalid input");

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) return jsonError(404, "NOT_FOUND", "User not found");

    if (parsed.data.role === "user" && admin.id === id) {
      const admins = await prisma.user.count({ where: { role: "admin", disabled: false } });
      if (admins <= 1) return jsonError(400, "LAST_ADMIN", "Cannot demote the last admin");
    }
    if (parsed.data.disabled === true && admin.id === id) {
      return jsonError(400, "SELF_DISABLE", "Cannot disable your own account");
    }

    const data: {
      quotaBytes?: bigint | null;
      role?: "user" | "admin";
      name?: string;
      disabled?: boolean;
      passwordHash?: string;
    } = {};

    if (parsed.data.quotaGb !== undefined) {
      // null → inherit default; 0 → unlimited; >0 → fixed GB
      data.quotaBytes =
        parsed.data.quotaGb == null ? null : BigInt(gbToBytes(parsed.data.quotaGb));
    }
    if (parsed.data.role) data.role = parsed.data.role;
    if (parsed.data.name) data.name = parsed.data.name.trim();
    if (parsed.data.disabled !== undefined) data.disabled = parsed.data.disabled;
    if (parsed.data.password) data.passwordHash = await hashPassword(parsed.data.password);

    const updated = await prisma.user.update({ where: { id }, data });

    // revoke sessions if disabled
    if (parsed.data.disabled === true) {
      await prisma.session.deleteMany({ where: { userId: id } });
    }

    return jsonOk({
      user: {
        id: updated.id,
        username: updated.username,
        name: updated.name,
        role: updated.role,
        disabled: updated.disabled,
        quotaBytes: updated.quotaBytes != null ? Number(updated.quotaBytes) : null,
      },
    });
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") return jsonError(401, "UNAUTHORIZED", "Please sign in");
    if (e instanceof Error && e.message === "FORBIDDEN") return jsonError(403, "FORBIDDEN", "Admin only");
    console.error(e);
    return jsonError(500, "INTERNAL", "Something went wrong");
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  try {
    const admin = await requireAdmin();
    const { id } = await ctx.params;
    if (admin.id === id) return jsonError(400, "SELF_DELETE", "Cannot delete your own account");

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) return jsonError(404, "NOT_FOUND", "User not found");
    if (target.role === "admin") {
      const admins = await prisma.user.count({ where: { role: "admin" } });
      if (admins <= 1) return jsonError(400, "LAST_ADMIN", "Cannot delete the last admin");
    }

    // delete files storage best-effort
    const files = await prisma.fileObject.findMany({ where: { ownerId: id }, select: { storageKey: true } });
    const { getStorage } = await import("@/lib/storage");
    const storage = getStorage();
    for (const f of files) {
      await storage.delete(f.storageKey).catch(() => undefined);
    }
    await prisma.user.delete({ where: { id } });
    return jsonOk({ ok: true });
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") return jsonError(401, "UNAUTHORIZED", "Please sign in");
    if (e instanceof Error && e.message === "FORBIDDEN") return jsonError(403, "FORBIDDEN", "Admin only");
    console.error(e);
    return jsonError(500, "INTERNAL", "Something went wrong");
  }
}
