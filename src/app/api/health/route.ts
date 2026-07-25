import { prisma } from "@/lib/db";
import { jsonOk, jsonError } from "@/lib/api";
import { getActiveStorageDriver, getStorage } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const storage = getActiveStorageDriver();
    let storageProbe: { ok: boolean; detail?: string } = { ok: true };

    if (storage === "telegram") {
      const drv = getStorage() as { probe?: () => Promise<{ ok: boolean; chat: string; error?: string }> };
      if (typeof drv.probe === "function") {
        const p = await drv.probe();
        storageProbe = {
          ok: p.ok,
          detail: p.ok ? `authorized chat=${p.chat}` : p.error || "unauthorized",
        };
      }
    }

    const status = storageProbe.ok ? "ok" : "degraded";
    return jsonOk({
      status,
      service: "tecloud",
      storage,
      storageProbe,
      time: new Date().toISOString(),
    });
  } catch {
    return jsonError(503, "UNHEALTHY", "Database unavailable");
  }
}
