import { NextResponse } from "next/server";
import { logActivity, updateUserAdmin } from "../../../../../lib/file-store";
import { guardMutation } from "../../../../../lib/request-guards";
import { requireAdmin } from "../../../../../lib/security";
import type { UserRole, UserStatus } from "../../../../../lib/types";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const blocked = await guardMutation(request, {
    scope: "admin:user-update",
    limit: 120,
    windowSeconds: 10 * 60,
  });
  if (blocked) return blocked;

  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: "Butuh akses admin." }, { status: 403 });
  }

  const params = await context.params;
  const payload = (await request.json().catch(() => ({}))) as {
    quotaMb?: number;
    role?: UserRole;
    status?: UserStatus;
  };

  if (payload.role && !["admin", "user"].includes(payload.role)) {
    return NextResponse.json({ error: "Role tidak valid." }, { status: 400 });
  }

  if (payload.status && !["pending", "active", "suspended"].includes(payload.status)) {
    return NextResponse.json({ error: "Status tidak valid." }, { status: 400 });
  }

  const updated = await updateUserAdmin(params.id, {
    quotaBytes:
      payload.quotaMb === undefined
        ? undefined
        : Math.max(1, Number(payload.quotaMb)) * 1024 * 1024,
    role: payload.role,
    status: payload.status,
  });

  if (!updated) {
    return NextResponse.json({ error: "User tidak ditemukan." }, { status: 404 });
  }

  await logActivity({
    userId: admin.id,
    type: "admin_user_updated",
    metadata: { targetUserId: params.id },
  });

  return NextResponse.json({ user: updated });
}
