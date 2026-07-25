import { redirect } from "next/navigation";
import { DriveApp } from "@/components/drive/drive-app";
import { getCurrentUser } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/locale";
import { getActiveStorageDriver } from "@/lib/storage";

export default async function AppPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const locale = await getLocale();
  const dict = getDictionary(user.locale || locale);
  const storageDriver = getActiveStorageDriver();
  return (
    <DriveApp
      dict={dict}
      locale={user.locale || locale}
      user={user}
      storageDriver={storageDriver}
    />
  );
}
