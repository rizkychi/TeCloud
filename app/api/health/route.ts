import { NextResponse } from "next/server";
import { checkDatabaseHealth } from "../../../lib/file-store";
import { getEnvironmentReport } from "../../../lib/env-validation";

export async function GET() {
  const envReport = getEnvironmentReport();
  const databaseOk = await checkDatabaseHealth().catch(() => false);
  const ok = databaseOk;

  return NextResponse.json(
    {
      ok,
      database: databaseOk ? "ok" : "error",
      environment: {
        ...envReport,
        status: envReport.ok ? "ready" : "needs_configuration",
      },
      checkedAt: new Date().toISOString(),
    },
    { status: ok ? 200 : 503 },
  );
}
