import { profileUpdateSchema } from "@/lib/validations";
import { requireUser, updateProfile } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/api";

export const runtime = "nodejs";

export async function PATCH(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json().catch(() => null);
    const parsed = profileUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(400, "VALIDATION_ERROR", "Invalid input", parsed.error.flatten());
    }
    if (!parsed.data.name && !parsed.data.locale && !parsed.data.newPassword) {
      return jsonError(400, "VALIDATION_ERROR", "Nothing to update");
    }
    const updated = await updateProfile(user.id, parsed.data);
    return jsonOk({ user: updated });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "UNAUTHORIZED") return jsonError(401, "UNAUTHORIZED", "Please sign in");
    if (msg === "CURRENT_PASSWORD_REQUIRED") {
      return jsonError(400, "CURRENT_PASSWORD_REQUIRED", "Current password required");
    }
    if (msg === "INVALID_CURRENT_PASSWORD") {
      return jsonError(400, "INVALID_CURRENT_PASSWORD", "Current password is incorrect");
    }
    console.error(e);
    return jsonError(500, "INTERNAL", "Something went wrong");
  }
}
