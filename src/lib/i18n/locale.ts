import { cookies } from "next/headers";
import type { Locale } from "./dictionaries";

export const LOCALE_COOKIE = "tecloud_locale";

export async function getLocale(): Promise<Locale> {
  const jar = await cookies();
  const v = jar.get(LOCALE_COOKIE)?.value;
  return v === "en" ? "en" : "id";
}

export async function setLocaleCookie(locale: Locale) {
  const jar = await cookies();
  jar.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}
