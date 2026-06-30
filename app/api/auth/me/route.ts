import { NextResponse } from "next/server";
import { getCurrentUser, publicUser } from "../../../../lib/security";

export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  return NextResponse.json({ user: user ? publicUser(user) : null });
}
