import { getCurrentUser } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/api";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return jsonError(401, "UNAUTHORIZED", "Please sign in");
  return jsonOk({ user });
}
