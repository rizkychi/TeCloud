import { redirect } from "next/navigation";

export default async function LegacyVerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const sp = await searchParams;
  redirect(sp.token ? `/verify?token=${encodeURIComponent(sp.token)}` : "/login");
}
