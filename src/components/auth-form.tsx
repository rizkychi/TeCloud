"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Eye, EyeOff, Send } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export function AuthForm({
  mode,
  dict,
  initialUsername = "",
}: {
  mode: "login" | "register" | "forgot" | "reset";
  dict: Dictionary;
  initialUsername?: string;
}) {
  const router = useRouter();
  const [username, setUsername] = useState(initialUsername);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [name, setName] = useState("");
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [botUrl, setBotUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [registerDone, setRegisterDone] = useState(false);
  const [awaitingVerify, setAwaitingVerify] = useState(false);

  useEffect(() => {
    if (mode === "reset" && typeof window !== "undefined") {
      setToken(new URLSearchParams(window.location.search).get("token") || "");
    }
  }, [mode]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);
    if (mode !== "login") setBotUrl(null);
    try {
      if (mode === "forgot") {
        const res = await fetch("/api/auth/forgot-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data?.error?.message || dict.errorGeneric);
          return;
        }
        setInfo(dict.resetSent);
        if (data.botUrl) setBotUrl(data.botUrl);
        return;
      }

      if (mode === "reset") {
        if (password !== confirm) {
          setError(dict.passwordMismatch);
          return;
        }
        const res = await fetch("/api/auth/reset-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, password }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data?.error?.message || dict.errorGeneric);
          return;
        }
        router.push("/app");
        router.refresh();
        return;
      }

      if (mode === "register" && password !== confirm) {
        setError(dict.passwordMismatch);
        return;
      }

      const res = await fetch(mode === "login" ? "/api/auth/login" : "/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "login" ? { username, password } : { username, password, name },
        ),
      });
      const data = await res.json();
      if (!res.ok) {
        const code = data?.error?.code;
        if (code === "INVALID_CREDENTIALS") setError(dict.invalidCredentials);
        else if (code === "USERNAME_TAKEN") setError(dict.usernameTaken);
        else if (code === "NOT_VERIFIED") {
          setError(dict.notVerified);
          setAwaitingVerify(true);
        } else if (code === "ACCOUNT_DISABLED") setError(dict.userDisabled);
        else if (code === "INVALID_USERNAME") setError(dict.invalidUsername);
        else setError(data?.error?.message || dict.errorGeneric);

        if (code === "NOT_VERIFIED" && username) {
          const r2 = await fetch("/api/auth/resend-verification", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username }),
          });
          const d2 = await r2.json();
          if (d2.botUrl) setBotUrl(d2.botUrl);
        }
        return;
      }

      if (mode === "register" && data.needsVerification) {
        setRegisterDone(true);
        setInfo(dict.verifyViaTelegram);
        if (data.botUrl) setBotUrl(data.botUrl);
        return;
      }

      router.push("/app");
      router.refresh();
    } catch {
      setError(dict.errorGeneric);
    } finally {
      setLoading(false);
    }
  }

  async function openBotChallenge(kind: "verify" | "reset") {
    if (!username) return;
    setLoading(true);
    setError(null);
    try {
      const path = kind === "verify" ? "/api/auth/resend-verification" : "/api/auth/forgot-password";
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message || dict.errorGeneric);
        return;
      }
      if (data.botUrl) {
        setBotUrl(data.botUrl);
        window.open(data.botUrl, "_blank", "noopener,noreferrer");
      } else {
        setInfo(kind === "verify" ? dict.verificationSent : dict.resetSent);
      }
    } catch {
      setError(dict.errorGeneric);
    } finally {
      setLoading(false);
    }
  }

  const title =
    mode === "login"
      ? dict.signIn
      : mode === "register"
        ? dict.createAccount
        : mode === "forgot"
          ? dict.forgotPasswordTitle
          : dict.resetPasswordTitle;

  if (registerDone) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-emerald-200">
            <CheckCircle2 className="h-4 w-4" />
            {dict.registerSuccessTitle}
          </div>
          <p className="text-xs leading-relaxed text-slate-200">{dict.verifyViaTelegram}</p>
          <ol className="mt-3 list-decimal space-y-1 pl-4 text-xs text-slate-300">
            <li>{dict.verifyStep1}</li>
            <li>{dict.verifyStep2}</li>
            <li>{dict.verifyStep3}</li>
          </ol>
          <p className="mt-3 text-[11px] text-slate-400">
            @{username}
          </p>
        </div>
        {botUrl && (
          <a
            href={botUrl}
            target="_blank"
            rel="noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#2AABEE] px-4 py-3 text-sm font-semibold text-white hover:bg-[#229ED9]"
          >
            <Send className="h-4 w-4" />
            {dict.openTelegramVerify}
          </a>
        )}
        <Button type="button" variant="subtle" className="w-full" onClick={() => openBotChallenge("verify")} disabled={loading}>
          {dict.resendVerification}
        </Button>
        <a href="/login" className="block text-center text-xs text-indigo-300 hover:underline">
          {dict.signIn}
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-[var(--text)]">{title}</h1>
        <p className="mt-1 text-xs text-[var(--muted)]">
          {mode === "forgot"
            ? dict.forgotPasswordDesc
            : mode === "reset"
              ? dict.resetPasswordTitle
              : dict.authSideNote}
        </p>
      </div>

      {mode === "register" && (
        <div className="space-y-1.5">
          <label className="text-xs text-[var(--muted)]">{dict.name}</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} autoComplete="name" />
        </div>
      )}

      {(mode === "login" || mode === "register" || mode === "forgot") && (
        <div className="space-y-1.5">
          <label className="text-xs text-[var(--muted)]">{dict.username}</label>
          <Input
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase())}
            required
            minLength={3}
            maxLength={32}
            pattern="[A-Za-z0-9_]+"
            autoComplete="username"
            placeholder="nama_kamu"
          />
          {/* Username format tip only on register/forgot — keep login clean */}
          {mode !== "login" && (
            <p className="text-[11px] text-[var(--faint)]">{dict.usernameHint}</p>
          )}
        </div>
      )}

      {(mode === "login" || mode === "register" || mode === "reset") && (
        <div className="space-y-1.5">
          <label className="text-xs text-[var(--muted)]">{dict.password}</label>
          <div className="relative">
            <Input
              type={showPw ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={mode === "login" ? 1 : 8}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              className="pr-10"
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--text)]"
              onClick={() => setShowPw((v) => !v)}
              tabIndex={-1}
              aria-label={showPw ? "Hide password" : "Show password"}
            >
              {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
      )}

      {(mode === "register" || mode === "reset") && (
        <div className="space-y-1.5">
          <label className="text-xs text-[var(--muted)]">{dict.confirmPassword}</label>
          <Input
            type={showPw ? "text" : "password"}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
          />
        </div>
      )}

      {mode === "login" && (
        <div className="flex justify-end text-xs">
          <a href="/forgot-password" className="text-[var(--brand-hover)] hover:underline">
            {dict.forgotPassword}
          </a>
        </div>
      )}

      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300" role="alert">
          {error}
        </p>
      )}
      {info && (
        <p className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-sm text-sky-100" role="status">
          {info}
        </p>
      )}
      {(botUrl || awaitingVerify) && (
        <div className="space-y-2">
          {awaitingVerify && (
            <p className="text-[11px] text-amber-200">{dict.notVerifiedHint}</p>
          )}
          {botUrl && (
            <a
              href={botUrl}
              target="_blank"
              rel="noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#2AABEE] px-4 py-3 text-sm font-semibold text-white hover:bg-[#229ED9]"
            >
              <Send className="h-4 w-4" />
              {mode === "forgot" ? dict.openTelegramReset : dict.openTelegramVerify}
            </a>
          )}
        </div>
      )}

      <Button type="submit" variant="primary" className="w-full" disabled={loading}>
        {loading
          ? dict.loading
          : mode === "login"
            ? dict.signIn
            : mode === "register"
              ? dict.createAccount
              : mode === "forgot"
                ? dict.sendResetLink
                : dict.resetPassword}
      </Button>

      {mode === "forgot" && username && !botUrl && (
        <Button type="button" variant="subtle" className="w-full" disabled={loading} onClick={() => openBotChallenge("reset")}>
          <Send className="h-4 w-4" /> {dict.openTelegramReset}
        </Button>
      )}
    </form>
  );
}
