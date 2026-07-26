"use client";

import { useEffect, useState } from "react";
import {
  Download,
  File as FileIcon,
  Folder,
  Lock,
  ShieldCheck,
} from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { LocaleSwitcher } from "./locale-switcher";
import { BrandLogo } from "./brand-logo";
import { formatBytes } from "@/lib/format";

export function PublicShareView({
  token,
  dict,
  locale,
}: {
  token: string;
  dict: Dictionary;
  locale: string;
}) {
  const [loading, setLoading] = useState(true);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [unlocking, setUnlocking] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [pwShake, setPwShake] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/public/${token}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message || dict.notFound);
        setData(null);
        return;
      }
      if (json.needsPassword) {
        setNeedsPassword(true);
        setData(json);
      } else {
        setNeedsPassword(false);
        setData(json);
      }
    } catch {
      setError(dict.errorGeneric);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function unlock() {
    setError(null);
    setUnlocking(true);
    try {
      const res = await fetch(`/api/public/${token}/unlock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const json = await res.json();
      if (!res.ok) {
        const invalid = json?.error?.code === "INVALID_PASSWORD";
        setError(invalid ? dict.invalidPassword : json?.error?.message || dict.errorGeneric);
        if (invalid) {
          setPassword("");
          setPwShake(true);
          setAttempts((n) => n + 1);
          window.setTimeout(() => setPwShake(false), 450);
        }
        return;
      }
      setPassword("");
      setAttempts(0);
      await load();
    } finally {
      setUnlocking(false);
    }
  }

  const year = String(new Date().getFullYear());

  return (
    <div className="min-h-screen bg-[#070a12] text-[#f7f8f8]">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(79,70,229,0.22),_transparent_55%),radial-gradient(ellipse_at_bottom_right,_rgba(14,165,233,0.12),_transparent_45%),linear-gradient(180deg,#070a12_0%,#0b1220_100%)]" />
      </div>

      <header className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
        <div className="flex items-center gap-2.5">
          <BrandLogo size={28} rounded="lg" />
          <div>
            <div className="text-sm font-semibold tracking-tight text-white">{dict.appName}</div>
            <div className="text-[10px] text-slate-400">{dict.publicSecureShare}</div>
          </div>
        </div>
        <LocaleSwitcher locale={locale} />
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-16 pt-4 sm:px-6">
        <div className="mb-5">
          <h1 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
            {dict.publicPageTitle}
          </h1>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-[#0b1220]/80 p-8 text-center text-sm text-slate-400 shadow-xl shadow-black/20 backdrop-blur">
            {dict.loading}
          </div>
        ) : error && !needsPassword ? (
          <div className="rounded-2xl border border-red-500/25 bg-red-500/10 p-6 text-sm text-red-200">
            {error}
          </div>
        ) : needsPassword ? (
          <div
            className={`overflow-hidden rounded-2xl border bg-[#0b1220]/90 shadow-2xl shadow-black/30 backdrop-blur ${
              error ? "border-red-500/40" : "border-white/10"
            }`}
          >
            <div
              className={`border-b px-5 py-4 ${
                error
                  ? "border-red-500/20 bg-gradient-to-r from-red-500/15 to-rose-500/10"
                  : "border-white/10 bg-gradient-to-r from-indigo-500/15 to-sky-500/10"
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-xl ${
                    error ? "bg-red-500/20 text-red-300" : "bg-indigo-500/20 text-indigo-300"
                  }`}
                >
                  <Lock className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-white">
                    {data?.name || dict.publicPageTitle}
                  </div>
                  <div className="text-xs text-slate-400">{dict.enterPassword}</div>
                </div>
              </div>
            </div>
            <div className="space-y-3 p-5">
              <div className={`space-y-1.5 ${pwShake ? "animate-pw-shake" : ""}`}>
                <label className="text-xs text-slate-400">{dict.password}</label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder={dict.password}
                  onKeyDown={(e) => e.key === "Enter" && unlock()}
                  autoFocus
                  aria-invalid={Boolean(error)}
                  className={error ? "border-red-500/50 focus:ring-red-500/30" : undefined}
                />
                <p className="text-[11px] text-slate-500">{dict.publicPasswordHint}</p>
              </div>
              {error && (
                <div className="rounded-xl border border-red-500/35 bg-red-500/10 px-3 py-2.5" role="alert">
                  <p className="text-sm font-medium text-red-200">{error}</p>
                  <p className="mt-1 text-[11px] text-red-200/75">
                    {dict.publicPasswordRetry}
                    {attempts > 1 ? ` (${attempts})` : ""}
                  </p>
                </div>
              )}
              <Button
                variant="primary"
                className="w-full sm:w-auto"
                onClick={unlock}
                disabled={unlocking || !password}
              >
                {unlocking ? dict.loading : dict.unlock}
              </Button>
            </div>
          </div>
        ) : data?.kind === "file" ? (
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0b1220]/90 shadow-2xl shadow-black/30 backdrop-blur">
            <div className="border-b border-white/10 bg-gradient-to-r from-indigo-500/15 to-sky-500/10 px-5 py-5">
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-300">
                  <FileIcon className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="break-all text-base font-semibold text-white">{data.file.name}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400">
                    <span>{formatBytes(Number(data.file.size) || 0)}</span>
                    {data.file.mimeType ? (
                      <>
                        <span className="text-slate-600">·</span>
                        <span className="truncate">{data.file.mimeType}</span>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
            <div className="space-y-4 p-5">
              <div className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2.5 text-xs text-slate-400">
                <div className="mb-1 text-[10px] uppercase tracking-wide text-slate-500">
                  {dict.publicFileMeta}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  <span>
                    {dict.sizeCol}:{" "}
                    <span className="text-slate-200">{formatBytes(Number(data.file.size) || 0)}</span>
                  </span>
                  {data.file.mimeType && (
                    <span className="truncate">
                      Type: <span className="text-slate-200">{data.file.mimeType}</span>
                    </span>
                  )}
                </div>
              </div>
              <a
                href={`/api/public/${token}/download`}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-indigo-500 px-5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 hover:bg-indigo-400"
              >
                <Download className="h-4 w-4" />
                {dict.downloadFile}
              </a>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400/80" />
                {dict.publicSecureShare}
              </div>
            </div>
          </div>
        ) : data?.kind === "folder" ? (
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0b1220]/90 shadow-2xl shadow-black/30 backdrop-blur">
            <div className="border-b border-white/10 bg-gradient-to-r from-indigo-500/15 to-sky-500/10 px-5 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/15 text-amber-300">
                  <Folder className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-base font-semibold text-white">{data.folder.name}</div>
                  <div className="text-xs text-slate-400">{dict.folderContents}</div>
                </div>
              </div>
            </div>
            <ul className="divide-y divide-white/5">
              {(data.folders || []).map((f: any) => (
                <li key={f.id} className="flex items-center gap-3 px-5 py-3 text-sm text-slate-200">
                  <Folder className="h-4 w-4 shrink-0 text-amber-300/90" />
                  <span className="min-w-0 truncate">{f.name}</span>
                  <span className="ml-auto shrink-0 text-[11px] text-slate-500">{dict.folder}</span>
                </li>
              ))}
              {(data.files || []).map((f: any) => (
                <li key={f.id} className="flex items-center gap-3 px-5 py-3 text-sm text-slate-200">
                  <FileIcon className="h-4 w-4 shrink-0 text-indigo-300/90" />
                  <span className="min-w-0 truncate">{f.name}</span>
                  <span className="ml-auto shrink-0 text-[11px] tabular-nums text-slate-500">
                    {formatBytes(Number(f.size) || 0)}
                  </span>
                </li>
              ))}
              {!data.folders?.length && !data.files?.length && (
                <li className="px-5 py-8 text-center text-sm text-slate-500">{dict.noItems}</li>
              )}
            </ul>
          </div>
        ) : null}

        <p className="mt-8 text-center text-[11px] text-slate-600">
          {dict.landingFooterNote.replace("{year}", year)}
        </p>
      </main>
    </div>
  );
}
