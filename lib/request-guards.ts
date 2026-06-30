import { NextResponse } from "next/server";
import { hitRateLimit } from "./file-store";
import { randomToken } from "./security";

export const csrfCookieName = "tecloud_csrf";
export const csrfHeaderName = "x-csrf-token";
const secureCookies = process.env.NODE_ENV === "production";

type RateLimitOptions = {
  scope: string;
  limit: number;
  windowSeconds: number;
};

function getCookie(request: Request, name: string) {
  const cookies = request.headers.get("cookie") || "";
  const found = cookies
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  return found ? decodeURIComponent(found.slice(name.length + 1)) : null;
}

export function issueCsrfToken(response: NextResponse) {
  const token = randomToken(32);
  response.cookies.set(csrfCookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookies,
    path: "/",
    maxAge: 60 * 60 * 24,
  });
  return token;
}

export function csrfResponse() {
  const token = randomToken(32);
  const response = NextResponse.json({ token });
  response.cookies.set(csrfCookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookies,
    path: "/",
    maxAge: 60 * 60 * 24,
  });
  return response;
}

export function requireCsrf(request: Request) {
  const cookieToken = getCookie(request, csrfCookieName);
  const headerToken = request.headers.get(csrfHeaderName);

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return NextResponse.json(
      { error: "Token keamanan tidak valid. Muat ulang halaman lalu coba lagi." },
      { status: 403 },
    );
  }

  return null;
}

export function getClientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return (
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip") ||
    "unknown"
  );
}

export async function requireRateLimit(
  request: Request,
  { scope, limit, windowSeconds }: RateLimitOptions,
) {
  const ip = getClientIp(request);
  const result = await hitRateLimit(
    `${scope}:${ip}`,
    limit,
    windowSeconds,
  );

  if (result.allowed) return null;

  return NextResponse.json(
    { error: "Terlalu banyak percobaan. Coba lagi beberapa saat lagi." },
    {
      status: 429,
      headers: {
        "Retry-After": String(
          Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000)),
        ),
      },
    },
  );
}

export async function guardMutation(
  request: Request,
  rateLimit: RateLimitOptions,
) {
  return requireCsrf(request) || (await requireRateLimit(request, rateLimit));
}
