"use client";

import { useEffect, useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { LocaleSwitcher } from "./locale-switcher";

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
  }, [token]);

  async function unlock() {
    setError(null);
    const res = await fetch(`/api/public/${token}/unlock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(
        json?.error?.code === "INVALID_PASSWORD"
          ? dict.invalidPassword
          : json?.error?.message || dict.errorGeneric,
      );
      return;
    }
    setPassword("");
    await load();
  }

  return (
    <div className="min-h-screen bg-[#08090a] text-[#f7f8f8]">
      <header className="flex items-center justify-between border-b border-[rgba(255,255,255,0.05)] px-4 py-3">
        <div className="text-sm font-medium text-[#3ecf8e]">{dict.appName}</div>
        <LocaleSwitcher locale={locale} />
      </header>
      <main className="mx-auto max-w-2xl p-6">
        <h1 className="mb-4 text-xl font-medium tracking-tight">
          {dict.publicPageTitle}
        </h1>
        {loading ? (
          <p className="text-sm text-[#8a8f98]">{dict.loading}</p>
        ) : error ? (
          <p className="text-sm text-red-300">{error}</p>
        ) : needsPassword ? (
          <div className="space-y-3 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0f1011] p-4">
            <p className="text-sm text-[#d0d6e0]">
              {data?.name} — {dict.enterPassword}
            </p>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={dict.password}
            />
            {error && <p className="text-sm text-red-300">{error}</p>}
            <Button variant="primary" onClick={unlock}>
              {dict.unlock}
            </Button>
          </div>
        ) : data?.kind === "file" ? (
          <div className="space-y-3 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0f1011] p-4">
            <div className="text-sm text-[#d0d6e0]">{data.file.name}</div>
            <div className="text-xs text-[#8a8f98]">
              {data.file.mimeType} · {data.file.size} bytes
            </div>
            <a
              href={`/api/public/${token}/download`}
              className="inline-flex h-9 items-center rounded-md bg-[#5e6ad2] px-4 text-sm text-white hover:bg-[#828fff]"
            >
              {dict.downloadFile}
            </a>
          </div>
        ) : data?.kind === "folder" ? (
          <div className="space-y-3 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0f1011] p-4">
            <div className="text-sm font-medium">{data.folder.name}</div>
            <div className="text-xs text-[#8a8f98]">{dict.folderContents}</div>
            <ul className="divide-y divide-[rgba(255,255,255,0.05)] text-sm">
              {(data.folders || []).map((f: any) => (
                <li key={f.id} className="py-2 text-[#d0d6e0]">
                  📁 {f.name}
                </li>
              ))}
              {(data.files || []).map((f: any) => (
                <li key={f.id} className="py-2 text-[#d0d6e0]">
                  📄 {f.name}{" "}
                  <span className="text-xs text-[#62666d]">({f.size} B)</span>
                </li>
              ))}
              {!data.folders?.length && !data.files?.length && (
                <li className="py-2 text-[#8a8f98]">{dict.noItems}</li>
              )}
            </ul>
          </div>
        ) : null}
      </main>
    </div>
  );
}
