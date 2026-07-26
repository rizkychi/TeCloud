import Link from "next/link";
import {
  FolderTree,
  KeyRound,
  Layers3,
  Share2,
  ShieldCheck,
  Sparkles,
  Trash2,
  UploadCloud,
  Zap,
} from "lucide-react";
import { getLocale } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { BrandLogo } from "@/components/brand-logo";
import { getCurrentUser } from "@/lib/auth";

export default async function HomePage() {
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const user = await getCurrentUser();

  const features = [
    { icon: ShieldCheck, title: dict.featureAuth, desc: dict.landingHow2Desc },
    { icon: FolderTree, title: dict.featureFolders, desc: dict.landingHow1Desc },
    { icon: Share2, title: dict.featureShare, desc: dict.landingStatsShare },
    { icon: Trash2, title: dict.featureTrash, desc: dict.landingHow3Desc },
    { icon: Layers3, title: dict.featurePreview, desc: dict.landingDemoDesc },
    { icon: Zap, title: dict.featureAdmin, desc: dict.landingHow3Title },
  ];

  const steps = [
    { n: "01", title: dict.landingHow1Title, desc: dict.landingHow1Desc, icon: UploadCloud },
    { n: "02", title: dict.landingHow2Title, desc: dict.landingHow2Desc, icon: KeyRound },
    { n: "03", title: dict.landingHow3Title, desc: dict.landingHow3Desc, icon: Sparkles },
  ];

  const mockFolders = [
    { name: "Docs", tint: "bg-indigo-100 text-indigo-700" },
    { name: "Design", tint: "bg-sky-100 text-sky-700" },
    { name: "Media", tint: "bg-violet-100 text-violet-700" },
    { name: "Archive", tint: "bg-amber-100 text-amber-800" },
    { name: "Shared", tint: "bg-emerald-100 text-emerald-700" },
    { name: "Work", tint: "bg-rose-100 text-rose-700" },
  ];

  return (
    <div className="landing-page min-h-screen overflow-x-hidden bg-[#070a12] text-[#f8fafc]">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(79,70,229,0.28),_transparent_55%),radial-gradient(ellipse_at_bottom_right,_rgba(14,165,233,0.18),_transparent_45%),linear-gradient(180deg,#070a12_0%,#0b1220_100%)]" />
        <div className="absolute left-1/2 top-[-10%] h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-indigo-500/20 blur-[120px]" />
      </div>

      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2.5">
          <BrandLogo size={36} className="shadow-lg shadow-indigo-500/30" />
          <div>
            <div className="text-sm font-semibold tracking-tight text-white">{dict.appName}</div>
            <div className="text-[10px] text-slate-400">Drive-like personal cloud</div>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Guest-only: logged-in users change language in Profile */}
          {!user && <LocaleSwitcher locale={locale} />}
          {user ? (
            <Link
              href="/app"
              className="rounded-xl bg-indigo-500 px-3.5 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-500/25 hover:bg-indigo-400"
            >
              {dict.landingSecondaryCta}
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="hidden rounded-xl border border-white/20 bg-white/10 px-3.5 py-2 text-xs font-semibold text-white hover:bg-white/15 sm:inline-flex"
              >
                {dict.signIn}
              </Link>
              <Link
                href="/register"
                className="rounded-xl bg-indigo-500 px-3.5 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-500/25 hover:bg-indigo-400"
              >
                {dict.signUp}
              </Link>
            </>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-24 pt-10 md:pt-16">
        <section className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold text-sky-100">
              <Sparkles className="h-3.5 w-3.5" />
              {dict.landingHeroBadge}
            </div>
            <h1 className="max-w-2xl text-4xl font-semibold leading-[1.1] tracking-tight text-white md:text-6xl">
              {dict.landingHeroTitle}
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-300 md:text-lg">
              {dict.landingHeroSub}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {user ? (
                <>
                  <Link
                    href="/app"
                    className="rounded-xl bg-gradient-to-r from-indigo-500 to-sky-500 px-5 py-3 text-sm font-semibold text-white shadow-xl shadow-indigo-500/25 hover:opacity-95"
                  >
                    {dict.landingSecondaryCta}
                  </Link>
                  <a
                    href="#features"
                    className="rounded-xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold text-white hover:bg-white/15"
                  >
                    {dict.landingExplore}
                  </a>
                </>
              ) : (
                <>
                  <Link
                    href="/register"
                    className="rounded-xl bg-gradient-to-r from-indigo-500 to-sky-500 px-5 py-3 text-sm font-semibold text-white shadow-xl shadow-indigo-500/25 hover:opacity-95"
                  >
                    {dict.landingPrimaryCta}
                  </Link>
                  <a
                    href="#how"
                    className="rounded-xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold text-white hover:bg-white/15"
                  >
                    {dict.landingOpenDocs}
                  </a>
                </>
              )}
            </div>

            <div className="mt-10 grid max-w-xl grid-cols-3 gap-3">
              {[dict.landingStatsUsers, dict.landingStatsFiles, dict.landingStatsShare].map((label) => (
                <div
                  key={label}
                  className="rounded-2xl border border-white/15 bg-slate-900/60 px-3 py-3 text-center"
                >
                  <div className="text-[11px] font-semibold leading-snug text-slate-100">{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Product mock — light chrome for readable contrast on dark hero */}
          <div className="relative">
            <div className="absolute -inset-4 rounded-[28px] bg-gradient-to-br from-indigo-500/35 via-sky-400/15 to-transparent blur-2xl" />
            <div className="relative overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-2xl shadow-black/50">
              <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <div className="h-2.5 w-2.5 rounded-full bg-rose-400" />
                  <div className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                  <div className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                  <BrandLogo size={16} rounded="lg" className="ml-1.5" />
                  <span className="font-semibold text-slate-800">{dict.appName} Drive</span>
                </div>
                <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                  live UI
                </span>
              </div>
              <div className="grid grid-cols-[92px_1fr] bg-white">
                <div className="space-y-1 border-r border-slate-200 bg-slate-50 p-3 text-[10px]">
                  <div className="rounded-lg bg-indigo-600 px-2 py-1.5 font-semibold text-white">
                    {dict.myDrive}
                  </div>
                  <div className="rounded-lg px-2 py-1.5 font-medium text-slate-600">{dict.starred}</div>
                  <div className="rounded-lg px-2 py-1.5 font-medium text-slate-600">{dict.recent}</div>
                  <div className="rounded-lg px-2 py-1.5 font-medium text-slate-600">{dict.trash}</div>
                </div>
                <div className="p-4">
                  <div className="mb-3 flex h-8 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5">
                    <div className="h-2 w-16 rounded bg-slate-300" />
                    <div className="ml-auto h-5 w-14 rounded-md bg-indigo-600" />
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {mockFolders.map(({ name, tint }) => (
                      <div
                        key={name}
                        className="rounded-xl border border-slate-200 bg-slate-50 p-3 shadow-sm"
                      >
                        <div className={`mb-3 flex h-8 w-8 items-center justify-center rounded-lg ${tint}`}>
                          <FolderTree className="h-4 w-4" />
                        </div>
                        <div className="truncate text-xs font-semibold text-slate-800">{name}</div>
                        <div className="mt-1 text-[10px] font-medium text-slate-500">{dict.folder}</div>
                      </div>
                    ))}
                  </div>
                  <p className="mt-4 text-[11px] leading-relaxed text-slate-600">{dict.landingDemoDesc}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="mt-20 scroll-mt-20">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold tracking-tight text-white">{dict.features}</h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">{dict.landingDesc}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="rounded-2xl border border-white/12 bg-slate-900/50 p-5 transition hover:border-indigo-400/40 hover:bg-slate-900/70"
              >
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-200">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="text-sm font-semibold text-white">{title}</div>
                <p className="mt-2 text-xs leading-relaxed text-slate-400">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="how" className="mt-20 scroll-mt-20">
          <h2 className="text-2xl font-semibold tracking-tight text-white">{dict.landingHowTitle}</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {steps.map(({ n, title, desc, icon: Icon }) => (
              <div
                key={n}
                className="relative overflow-hidden rounded-2xl border border-white/12 bg-slate-900/45 p-5"
              >
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-xs font-semibold tracking-[0.2em] text-sky-300">{n}</span>
                  <Icon className="h-4 w-4 text-indigo-300" />
                </div>
                <div className="text-sm font-semibold text-white">{title}</div>
                <p className="mt-2 text-xs leading-relaxed text-slate-400">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-20 overflow-hidden rounded-[28px] border border-indigo-400/20 bg-gradient-to-br from-indigo-600 via-indigo-700 to-sky-700 p-8 md:p-10">
          <div className="grid items-center gap-6 md:grid-cols-[1.2fr_0.8fr]">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">
                {dict.landingDemoTitle}
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-indigo-50">
                {dict.landingHeroSub}
              </p>
              <div className="mt-6">
                <Link
                  href={user ? "/app" : "/register"}
                  className="landing-cta-solid inline-flex rounded-xl px-5 py-3 text-sm font-semibold shadow-lg"
                >
                  {user ? dict.landingSecondaryCta : dict.landingPrimaryCta}
                </Link>
              </div>
            </div>
            <div className="rounded-2xl border border-white/25 bg-black/25 p-4 text-xs text-indigo-50 backdrop-blur-sm">
              <div className="mb-2 font-semibold text-white">{dict.landingDemoTitle}</div>
              <ul className="space-y-2 font-medium">
                <li>• {dict.featureFolders}</li>
                <li>• {dict.featureShare}</li>
                <li>• {dict.featurePreview}</li>
                <li>• {dict.featureAdmin}</li>
                <li>• {dict.featureCoolify}</li>
              </ul>
              {!user && (
                <p className="mt-4 text-[11px] text-indigo-100/80">
                  {dict.hasAccount}{" "}
                  <Link href="/login" className="font-semibold text-white underline">
                    {dict.signIn}
                  </Link>
                </p>
              )}
            </div>
          </div>
        </section>

        <footer className="mt-16 border-t border-white/10 pt-6 text-center text-xs text-slate-500">
          {dict.landingFooterNote.replace("{year}", String(new Date().getFullYear()))}
        </footer>
      </main>
    </div>
  );
}
