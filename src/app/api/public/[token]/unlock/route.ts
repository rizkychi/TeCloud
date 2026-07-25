import { unlockSchema } from "@/lib/validations";
import { jsonError, jsonOk } from "@/lib/api";
import { unlockShare } from "@/lib/share-access";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ token: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const { token } = await ctx.params;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const rl = rateLimit(`unlock:${token}:${ip}`, 10, 60_000);
  if (!rl.ok) return jsonError(429, "RATE_LIMIT", "Too many attempts");

  const body = await req.json().catch(() => null);
  const parsed = unlockSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "VALIDATION_ERROR", "Invalid input");
  }
  try {
    const target = await unlockShare(token, parsed.data.password);
    return jsonOk({
      ok: true,
      kind: target.kind,
      name: target.name,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "NOT_FOUND") return jsonError(404, "NOT_FOUND", "Not found");
    if (msg === "INVALID_PASSWORD") {
      return jsonError(401, "INVALID_PASSWORD", "Incorrect password");
    }
    if (msg === "NOT_PASSWORD_PROTECTED") {
      return jsonError(400, "NOT_PASSWORD_PROTECTED", "Not password protected");
    }
    console.error(e);
    return jsonError(500, "INTERNAL", "Something went wrong");
  }
}
