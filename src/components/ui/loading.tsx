import { cn } from "@/lib/cn";

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent",
        className,
      )}
      aria-hidden
    />
  );
}

export function LoadingOverlay({
  show,
  label,
}: {
  show: boolean;
  label?: string;
}) {
  if (!show) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
      <div className="flex items-center gap-3 rounded-2xl border tc-border bg-[var(--surface)] px-5 py-4 shadow-[var(--shadow)]">
        <Spinner className="h-5 w-5 text-[var(--brand)]" />
        <span className="text-sm text-[var(--text-2)]">{label || "Loading…"}</span>
      </div>
    </div>
  );
}

export function InlineLoading({ label }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-xs text-[var(--muted)]">
      <Spinner className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}
