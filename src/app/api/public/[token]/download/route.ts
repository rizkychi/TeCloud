import { jsonError } from "@/lib/api";
import { canAccessShare } from "@/lib/share-access";
import { getStorage } from "@/lib/storage";
import { Readable } from "stream";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ token: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const { token } = await ctx.params;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const rl = rateLimit(`pubdl:${token}:${ip}`, 60, 60_000);
  if (!rl.ok) return jsonError(429, "RATE_LIMIT", "Too many requests");

  const access = await canAccessShare(token);
  if (!access.ok) {
    if (access.reason === "PASSWORD_REQUIRED") {
      return jsonError(401, "PASSWORD_REQUIRED", "Password required");
    }
    return jsonError(404, "NOT_FOUND", "Not found");
  }
  if (access.target.kind !== "file") {
    return jsonError(400, "NOT_A_FILE", "Not a file share");
  }

  const stream = await getStorage().get(access.target.storageKey);
  const webStream = Readable.toWeb(stream) as unknown as ReadableStream;
  const disposition = `attachment; filename*=UTF-8''${encodeURIComponent(access.target.name)}`;
  return new Response(webStream, {
    headers: {
      "Content-Type": access.target.mimeType || "application/octet-stream",
      "Content-Length": String(access.target.size),
      "Content-Disposition": disposition,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
