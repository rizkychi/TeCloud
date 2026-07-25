import { registerSchema } from "@/lib/validations";
import { registerUser } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const rl = rateLimit(`register:${ip}`, 5, 60_000);
  if (!rl.ok) return jsonError(429, "RATE_LIMIT", "Too many requests");

  const body = await req.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "VALIDATION_ERROR", "Invalid input", parsed.error.flatten());
  }
  try {
    const result = await registerUser(parsed.data);
    if (result.needsVerification) {
      return jsonOk(
        {
          needsVerification: true,
          username: result.username,
          botUrl: result.botUrl,
          message: "Open Telegram bot to get your verification link.",
        },
        { status: 201 },
      );
    }
    return jsonOk({ user: result.user, needsVerification: false }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "USERNAME_TAKEN") return jsonError(409, "USERNAME_TAKEN", "Username already taken");
    if (msg === "INVALID_USERNAME") return jsonError(400, "INVALID_USERNAME", "Invalid username");
    console.error(e);
    return jsonError(500, "INTERNAL", "Something went wrong");
  }
}
