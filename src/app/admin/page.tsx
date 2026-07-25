import { redirect } from "next/navigation";
import { AdminApp } from "@/components/admin/admin-app";
import { getCurrentUser } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/locale";

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/app");
  const locale = await getLocale();
  const dict = getDictionary(user.locale || locale);
  return <AdminApp dict={dict} locale={user.locale || locale} user={user} />;
}
