"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/loading";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export function VerifyClient({ dict }: { dict: Dictionary }) {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [message, setMessage] = useState(dict.loading);

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token") || "";
    if (!token) {
      setStatus("error");
      setMessage(dict.verifyEmailFailed);
      return;
    }
    (async () => {
      try {
        const res = await fetch("/api/auth/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = await res.json();
        if (!res.ok) {
          setStatus("error");
          setMessage(data?.error?.message || dict.verifyEmailFailed);
          return;
        }
        setStatus("ok");
        setMessage(dict.verifyEmailSuccess);
        setTimeout(() => {
          router.push("/app");
          router.refresh();
        }, 900);
      } catch {
        setStatus("error");
        setMessage(dict.verifyEmailFailed);
      }
    })();
  }, [dict, router]);

  return (
    <div className="space-y-4 text-center">
      <h1 className="text-xl font-semibold">{dict.verifyEmailTitle}</h1>
      <div className="flex items-center justify-center gap-2 text-sm text-[var(--muted)]">
        {status === "loading" && <Spinner />}
        <span className={status === "error" ? "text-red-300" : status === "ok" ? "text-emerald-300" : ""}>
          {message}
        </span>
      </div>
      {status === "error" && (
        <div className="flex justify-center gap-2">
          <Link href="/login">
            <Button variant="primary">{dict.signIn}</Button>
          </Link>
          <Link href="/register">
            <Button variant="ghost">{dict.signUp}</Button>
          </Link>
        </div>
      )}
    </div>
  );
}
