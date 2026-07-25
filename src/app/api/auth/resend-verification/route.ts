import { resendVerificationSchema } from "@/lib/validations";
import { getVerifyChallengeForUsername } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const rl = rateLimit(`resend-verify:${ip}`, 5, 60_000);
  if (!rl.ok) return jsonError(429, "RATE_LIMIT", "Too many requests");

  const body = await req.json().catch(() => null);
  const parsed = resendVerificationSchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "VALIDATION_ERROR", "Invalid username");

  try {
    const result = await getVerifyChallengeForUsername(parsed.data.username);
    return jsonOk(result);
  } catch (e) {
    console.error(e);
    return jsonError(500, "INTERNAL", "Something went wrong");
  }
}
