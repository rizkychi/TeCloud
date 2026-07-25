"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

export type SelectOption = { value: string; label: string };

export function Select({
  value,
  options,
  onChange,
  placeholder,
  disabled,
  className,
  size = "md",
  leading,
}: {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  size?: "sm" | "md";
  leading?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center justify-between gap-1.5 rounded-lg border tc-border bg-[var(--panel)] text-[var(--text)]",
          "hover:bg-[var(--hover)] disabled:opacity-50",
          size === "sm" ? "h-8 px-2.5 text-xs" : "h-9 px-3 text-sm",
        )}
      >
        <span className="flex min-w-0 items-center gap-1.5">
          {leading}
          <span className={cn("truncate", !selected && "text-[var(--faint)]")}>
            {selected?.label || placeholder || "Select"}
          </span>
        </span>
        <ChevronDown
          className={cn(
            "shrink-0 text-[var(--muted)] transition",
            size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4",
            open && "rotate-180",
          )}
        />
      </button>
      {open && (
        <div
          className={cn(
            "absolute left-0 right-0 z-50 mt-1 max-h-56 overflow-auto rounded-xl border tc-border bg-[var(--surface)] p-1 shadow-[var(--shadow)]",
            size === "sm" ? "min-w-[9rem]" : "",
          )}
        >
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              className={cn(
                "flex w-full items-center justify-between rounded-lg text-left tc-hover",
                size === "sm" ? "px-2.5 py-1.5 text-xs" : "px-3 py-2 text-sm",
                o.value === value && "tc-selected",
              )}
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
            >
              <span className="truncate">{o.label}</span>
              {o.value === value && <Check className="h-3.5 w-3.5 shrink-0 text-[var(--brand)]" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
