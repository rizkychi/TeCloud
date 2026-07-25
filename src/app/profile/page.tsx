import { redirect } from "next/navigation";
import { ProfileForm } from "@/components/profile-form";
import { getCurrentUser } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/locale";

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const locale = await getLocale();
  const dict = getDictionary(user.locale || locale);
  return <ProfileForm dict={dict} user={user} />;
}
