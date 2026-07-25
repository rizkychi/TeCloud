"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, UserRound } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Select } from "./ui/select";
import { Spinner } from "./ui/loading";
import { ToastHost, pushToast } from "./ui/toast";
import { ThemeProvider } from "./theme-provider";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { SessionUser } from "@/lib/auth";

export function ProfileForm({
  dict,
  user,
}: {
  dict: Dictionary;
  user: SessionUser;
}) {
  const router = useRouter();
  const [name, setName] = useState(user.name);
  const [locale, setLocale] = useState(user.locale === "en" ? "en" : "id");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword && newPassword !== confirm) {
      setError(dict.passwordMismatch);
      return;
    }
    setBusy(true);
    try {
      const body: Record<string, string> = { name, locale };
      if (newPassword) {
        body.currentPassword = currentPassword;
        body.newPassword = newPassword;
      }
      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        const code = data?.error?.code;
        if (code === "INVALID_CURRENT_PASSWORD") setError(dict.invalidCredentials);
        else setError(data?.error?.message || dict.errorGeneric);
        return;
      }
      if (locale !== user.locale) {
        await fetch("/api/locale", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ locale }),
        }).catch(() => undefined);
      }
      pushToast("success", newPassword ? dict.passwordUpdated : dict.profileUpdated);
      if (locale !== user.locale) {
        window.location.reload();
        return;
      }
      router.refresh();
      setCurrentPassword("");
      setNewPassword("");
      setConfirm("");
    } catch {
      setError(dict.errorGeneric);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ThemeProvider theme={user.theme || "dark"}>
      <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
        <header className="border-b tc-border bg-[var(--panel)]">
          <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
            <Button
              size="icon"
              variant="subtle"
              type="button"
              title={dict.backToDrive}
              aria-label={dict.backToDrive}
              onClick={() => router.push("/app")}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0">
              <h1 className="text-sm font-semibold">{dict.profileTitle}</h1>
              <p className="text-xs text-[var(--muted)]">{dict.profileSubtitle}</p>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-3xl px-4 py-6">
          <div className="rounded-2xl border tc-border bg-[var(--surface)] p-5 shadow-[var(--shadow)] sm:p-6">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--surface-2)] text-[var(--brand)]">
                <UserRound className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <div className="truncate text-base font-semibold">{user.name}</div>
                <div className="truncate text-sm text-[var(--muted)]">@{user.username}</div>
              </div>
            </div>

            <form onSubmit={save} className="space-y-4">
              <div className="rounded-xl border tc-border bg-[var(--surface-2)] px-3 py-3 text-xs">
                <div className="text-[var(--muted)]">{dict.username}</div>
                <div className="mt-0.5 text-sm font-medium">@{user.username}</div>
                <div className={`mt-1.5 ${user.verified ? "text-emerald-400" : "text-amber-300"}`}>
                  {user.verified ? dict.verifiedLabel : dict.unverifiedLabel}
                </div>
                <div className={`mt-1 ${user.telegramId ? "text-sky-300" : "text-[var(--faint)]"}`}>
                  {user.telegramId ? (
                    <>
                      {dict.telegramLinked}
                      <span className="ml-1 text-[var(--muted)]">
                        · {dict.telegramIdLabel}: {user.telegramId}
                      </span>
                    </>
                  ) : (
                    dict.telegramNotLinked
                  )}
                </div>
                <div className="mt-1 text-[var(--muted)]">
                  {dict.role}: {user.role} ·{" "}
                  {user.usedBytes
                    ? Math.round((user.usedBytes / Math.max(user.quotaBytes, 1)) * 100)
                    : 0}
                  % quota
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs text-[var(--muted)]">{dict.name}</label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} />
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs text-[var(--muted)]">{dict.language}</label>
                  <Select
                    size="sm"
                    value={locale}
                    options={[
                      { value: "id", label: "Indonesia" },
                      { value: "en", label: "English" },
                    ]}
                    onChange={(v) => setLocale(v as "en" | "id")}
                  />
                </div>
              </div>

              <div className="border-t tc-border pt-4">
                <div className="mb-2 text-xs font-medium text-[var(--text-2)]">{dict.changePassword}</div>
                <div className="grid gap-2 sm:grid-cols-1">
                  <Input
                    type="password"
                    placeholder={dict.currentPassword}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                  <Input
                    type="password"
                    placeholder={dict.newPassword}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                  <Input
                    type="password"
                    placeholder={dict.confirmPassword}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    autoComplete="new-password"
                  />
                </div>
              </div>

              {error && <p className="text-sm text-[var(--danger)]">{error}</p>}

              <div className="flex flex-wrap justify-end gap-2 pt-1">
                <Button type="button" variant="ghost" onClick={() => router.push("/app")} disabled={busy}>
                  {dict.backToDrive}
                </Button>
                <Button type="submit" variant="primary" disabled={busy}>
                  {busy ? <Spinner className="h-4 w-4" /> : null}
                  {dict.saveProfile}
                </Button>
              </div>
            </form>
          </div>
        </main>
        <ToastHost />
      </div>
    </ThemeProvider>
  );
}
