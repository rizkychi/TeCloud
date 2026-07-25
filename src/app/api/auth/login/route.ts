import { loginSchema } from "@/lib/validations";
import { loginUser } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const rl = rateLimit(`login:${ip}`, 10, 60_000);
  if (!rl.ok) return jsonError(429, "RATE_LIMIT", "Too many requests");

  const body = await req.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "VALIDATION_ERROR", "Invalid input", parsed.error.flatten());
  }
  try {
    const user = await loginUser(parsed.data);
    return jsonOk({ user });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "INVALID_CREDENTIALS") return jsonError(401, "INVALID_CREDENTIALS", "Invalid username or password");
    if (msg === "ACCOUNT_DISABLED") return jsonError(403, "ACCOUNT_DISABLED", "Account disabled");
    if (msg === "NOT_VERIFIED") {
      return jsonError(403, "NOT_VERIFIED", "Please verify your account via Telegram before signing in");
    }
    if (msg.startsWith("Invalid environment:")) {
      console.error(e);
      return jsonError(500, "ENV_INVALID", msg);
    }
    console.error("[auth/login]", e);
    return jsonError(500, "INTERNAL", "Something went wrong");
  }
}
