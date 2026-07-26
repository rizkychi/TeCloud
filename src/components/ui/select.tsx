"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

export type SelectOption = { value: string; label: string };

type MenuPos = {
  /** Used when menu opens downward */
  top?: number;
  /** Used when menu opens upward — anchors bottom edge to the trigger */
  bottom?: number;
  left: number;
  width: number;
  maxHeight: number;
  openUp: boolean;
};

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
  const [pos, setPos] = useState<MenuPos | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);

  function updatePosition() {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const gap = 4;
    const edge = 8;
    const preferredMax = 224; // ~max-h-56
    const rowH = size === "sm" ? 32 : 40;
    const estimatedH = Math.min(preferredMax, Math.max(rowH + 8, options.length * rowH + 8));
    const spaceBelow = window.innerHeight - rect.bottom - gap - edge;
    const spaceAbove = rect.top - gap - edge;
    // Flip upward when below has less room than the menu needs (e.g. floating bottom bar)
    const openUp = spaceBelow < estimatedH && spaceAbove > spaceBelow;
    const available = Math.max(96, openUp ? spaceAbove : spaceBelow);
    const maxHeight = Math.min(preferredMax, available);
    const width = Math.max(rect.width, size === "sm" ? 144 : rect.width);
    let left = rect.left;
    if (left + width > window.innerWidth - edge) left = Math.max(edge, window.innerWidth - edge - width);
    if (left < edge) left = edge;

    // Open-up: pin bottom edge to trigger top (no gap from using maxHeight as actual height).
    // Open-down: pin top edge to trigger bottom.
    if (openUp) {
      const bottom = Math.max(edge, window.innerHeight - rect.top + gap);
      setPos({ bottom, left, width, maxHeight, openUp: true });
    } else {
      let top = rect.bottom + gap;
      if (top + Math.min(estimatedH, maxHeight) > window.innerHeight - edge) {
        top = Math.max(edge, window.innerHeight - edge - maxHeight);
      }
      setPos({ top, left, width, maxHeight, openUp: false });
    }
  }

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    function onScrollOrResize() {
      updatePosition();
    }
    window.addEventListener("resize", onScrollOrResize);
    // capture scroll from any scrollable ancestor
    window.addEventListener("scroll", onScrollOrResize, true);
    return () => {
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("scroll", onScrollOrResize, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, options.length, size]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const menu =
    open &&
    pos &&
    typeof document !== "undefined" &&
    createPortal(
      <div
        ref={menuRef}
        role="listbox"
        className={cn(
          "fixed z-[200] overflow-auto rounded-xl border tc-border bg-[var(--surface)] p-1 shadow-[var(--shadow)]",
        )}
        style={{
          ...(pos.openUp
            ? { bottom: pos.bottom, top: "auto" as const }
            : { top: pos.top, bottom: "auto" as const }),
          left: pos.left,
          width: pos.width,
          maxHeight: pos.maxHeight,
        }}
      >
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="option"
            aria-selected={o.value === value}
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
      </div>,
      document.body,
    );

  return (
    <div className={cn("relative", className)}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
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
      {menu}
    </div>
  );
}
