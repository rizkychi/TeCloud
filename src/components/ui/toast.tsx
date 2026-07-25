"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import { cn } from "@/lib/cn";

export type ToastKind = "success" | "error" | "info";
export type ToastItem = { id: number; kind: ToastKind; message: string };

let toastSeq = 1;
const listeners = new Set<(t: ToastItem) => void>();

export function pushToast(kind: ToastKind, message: string) {
  const item: ToastItem = { id: toastSeq++, kind, message };
  listeners.forEach((fn) => fn(item));
}

export function ToastHost() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    const onToast = (t: ToastItem) => {
      setItems((prev) => [...prev.slice(-4), t]);
      window.setTimeout(() => {
        setItems((prev) => prev.filter((x) => x.id !== t.id));
      }, 3200);
    };
    listeners.add(onToast);
    return () => {
      listeners.delete(onToast);
    };
  }, []);

  if (!items.length) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[120] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2">
      {items.map((t) => (
        <div
          key={t.id}
          className={cn(
            "pointer-events-auto flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm shadow-[var(--shadow)]",
            "bg-[var(--surface)] tc-border",
            t.kind === "success" && "border-emerald-500/30",
            t.kind === "error" && "border-red-500/30",
            t.kind === "info" && "border-[var(--brand)]/30",
          )}
        >
          {t.kind === "success" ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
          ) : t.kind === "error" ? (
            <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
          ) : (
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand-hover)]" />
          )}
          <div className="min-w-0 flex-1 text-[var(--text-2)]">{t.message}</div>
          <button
            type="button"
            className="rounded p-0.5 text-[var(--faint)] hover:text-[var(--text)]"
            onClick={() => setItems((prev) => prev.filter((x) => x.id !== t.id))}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
