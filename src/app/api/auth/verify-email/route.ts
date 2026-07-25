import { NextResponse } from "next/server";

/** Legacy path — use POST /api/auth/verify */
export async function POST(req: Request) {
  const url = new URL(req.url);
  url.pathname = "/api/auth/verify";
  return NextResponse.redirect(url, 307);
}
