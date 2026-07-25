"use client";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/loading";

export function ConfirmModal({
  title,
  message,
  confirmLabel,
  cancelLabel,
  danger,
  busy,
  onConfirm,
  onClose,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded-2xl border tc-border bg-[var(--surface)] p-4 shadow-[var(--shadow)]"
      >
        <h2 className="mb-2 text-sm font-medium">{title}</h2>
        <p className="mb-4 text-sm text-[var(--muted)]">{message}</p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button
            variant={danger ? "danger" : "primary"}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? <Spinner className="h-4 w-4" /> : null}
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
