import { NextResponse } from "next/server";
import { checkDatabaseHealth } from "../../../lib/file-store";
import { getEnvironmentReport } from "../../../lib/env-validation";

export async function GET() {
  const envReport = getEnvironmentReport();
  const databaseOk = await checkDatabaseHealth().catch(() => false);
  const ok = databaseOk && envReport.ok;

  return NextResponse.json(
    {
      ok,
      database: databaseOk ? "ok" : "error",
      environment: envReport,
      checkedAt: new Date().toISOString(),
    },
    { status: ok ? 200 : 503 },
  );
}
