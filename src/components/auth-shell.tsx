"use client";

import Link from "next/link";
import { LocaleSwitcher } from "./locale-switcher";
import { BrandLogo } from "./brand-logo";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/dictionaries";

export function AuthShell({
  dict,
  locale,
  mode,
  children,
}: {
  dict: Dictionary;
  locale: Locale;
  mode: "login" | "register" | "forgot" | "reset" | "verify";
  children: React.ReactNode;
}) {
  const hero =
    mode === "register" ? dict.authHeroRegister : dict.authHeroLogin;

  return (
    <div className="min-h-screen bg-[#070a12] text-white">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_rgba(79,70,229,0.28),_transparent_50%),radial-gradient(ellipse_at_bottom_right,_rgba(14,165,233,0.16),_transparent_45%)]" />
      </div>

      <div className="mx-auto grid min-h-screen max-w-6xl lg:grid-cols-2">
        <div className="hidden flex-col justify-between p-10 lg:flex">
          <Link href="/" className="inline-flex items-center gap-2">
            <BrandLogo size={36} />
            <span className="text-sm font-semibold">{dict.appName}</span>
          </Link>
          <div>
            <p className="mb-3 text-xs uppercase tracking-[0.2em] text-sky-300/80">TeCloud</p>
            <h2 className="max-w-md text-3xl font-semibold leading-tight tracking-tight">{hero}</h2>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-slate-300">{dict.authSideNote}</p>
            <ul className="mt-8 space-y-2 text-sm text-slate-300">
              <li>• {dict.featureFolders}</li>
              <li>• {dict.featureShare}</li>
              <li>• {dict.featureAdmin}</li>
            </ul>
          </div>
          <p className="text-xs text-slate-500">{dict.landingFooterNote}</p>
        </div>

        <div className="flex items-center justify-center p-6 sm:p-10">
          <div className="w-full max-w-md">
            <div className="mb-6 flex items-center justify-between lg:hidden">
              <Link href="/" className="inline-flex items-center gap-2">
                <BrandLogo size={32} rounded="lg" />
                <span className="text-sm font-medium">{dict.appName}</span>
              </Link>
              <LocaleSwitcher locale={locale} />
            </div>
            <div className="rounded-2xl border border-white/10 bg-[#0b1220]/80 p-6 shadow-2xl shadow-black/30 backdrop-blur">
              <div className="mb-4 hidden justify-end lg:flex">
                <LocaleSwitcher locale={locale} />
              </div>
              {children}
              <div className="mt-5 text-center text-xs text-slate-400">
                {mode === "login" && (
                  <p>
                    {dict.noAccount}{" "}
                    <Link href="/register" className="text-indigo-300 hover:underline">
                      {dict.signUp}
                    </Link>
                  </p>
                )}
                {mode === "register" && (
                  <p>
                    {dict.hasAccount}{" "}
                    <Link href="/login" className="text-indigo-300 hover:underline">
                      {dict.signIn}
                    </Link>
                  </p>
                )}
                {(mode === "forgot" || mode === "reset" || mode === "verify") && (
                  <p>
                    <Link href="/login" className="text-indigo-300 hover:underline">
                      {dict.signIn}
                    </Link>
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
