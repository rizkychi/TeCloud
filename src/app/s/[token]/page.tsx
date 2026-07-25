import { PublicShareView } from "@/components/public-share-view";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/locale";

type Props = { params: Promise<{ token: string }> };

export default async function SharePage({ params }: Props) {
  const { token } = await params;
  const locale = await getLocale();
  const dict = getDictionary(locale);
  return <PublicShareView token={token} dict={dict} locale={locale} />;
}
