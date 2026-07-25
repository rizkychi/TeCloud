import { AuthShell } from "@/components/auth-shell";
import { VerifyClient } from "@/components/verify-email-client";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/locale";

export default async function VerifyPage() {
  const locale = await getLocale();
  const dict = getDictionary(locale);
  return (
    <AuthShell dict={dict} locale={locale} mode="verify">
      <VerifyClient dict={dict} />
    </AuthShell>
  );
}
