import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";
import { getCurrentUser } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/locale";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/app");
  const locale = await getLocale();
  const dict = getDictionary(locale);

  return (
    <AuthShell dict={dict} locale={locale} mode="login">
      <AuthForm mode="login" dict={dict} />
    </AuthShell>
  );
}
