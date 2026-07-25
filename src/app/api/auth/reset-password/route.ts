import { resetPasswordSchema } from "@/lib/validations";
import { resetPasswordWithToken } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const rl = rateLimit(`reset:${ip}`, 8, 60_000);
  if (!rl.ok) return jsonError(429, "RATE_LIMIT", "Too many requests");

  const body = await req.json().catch(() => null);
  const parsed = resetPasswordSchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "VALIDATION_ERROR", "Invalid input");

  try {
    const user = await resetPasswordWithToken(parsed.data.token, parsed.data.password);
    return jsonOk({ user });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "INVALID_TOKEN" || msg === "TOKEN_USED" || msg === "TOKEN_EXPIRED") {
      return jsonError(400, msg, "Invalid or expired reset link");
    }
    console.error(e);
    return jsonError(500, "INTERNAL", "Something went wrong");
  }
}
