"use client";

import { ButtonHTMLAttributes, ReactNode } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Check, Cloud } from "lucide-react";

export function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section className={cx("rounded-lg border border-[var(--line)] bg-[var(--glass)] shadow-[var(--shadow)] backdrop-blur-xl", className)}>
      {children}
    </section>
  );
}

export function Button({
  children,
  className,
  variant = "secondary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" }) {
  return (
    <button
      className={cx(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-extrabold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus)] disabled:cursor-wait disabled:opacity-60",
        variant === "primary" && "bg-[var(--brand)] text-white shadow-[0_16px_35px_rgba(23,105,224,0.25)] hover:brightness-95",
        variant === "secondary" && "border border-[var(--line)] bg-[var(--surface-strong)] text-[var(--text)] hover:border-[var(--brand)]",
        variant === "ghost" && "text-[var(--muted)] hover:bg-[var(--surface-strong)] hover:text-[var(--text)]",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function IconButton({
  ariaLabel,
  children,
  danger,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { ariaLabel: string; danger?: boolean }) {
  return (
    <button
      aria-label={ariaLabel}
      className={cx(
        "inline-grid h-11 w-11 flex-none place-items-center rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] text-[var(--text)] transition hover:border-[var(--brand)] hover:text-[var(--brand)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus)] disabled:cursor-wait disabled:opacity-60",
        danger && "hover:border-[#ffb8b0] hover:bg-[#fff1ef] hover:text-[var(--bad)]",
      )}
      type="button"
      {...props}
    >
      {children}
    </button>
  );
}

export function StatusBadge({ children, tone }: { children: ReactNode; tone: "good" | "warn" | "bad" | "neutral" }) {
  return (
    <span className={cx(
      "inline-flex min-h-8 w-max items-center rounded-lg px-3 text-xs font-black uppercase tracking-normal",
      tone === "good" && "bg-[var(--good-soft)] text-[var(--good)]",
      tone === "warn" && "bg-[var(--warn-soft)] text-[var(--warn)]",
      tone === "bad" && "bg-[var(--bad-soft)] text-[var(--bad)]",
      tone === "neutral" && "bg-[var(--surface-strong)] text-[var(--muted)]",
    )}>
      {children}
    </span>
  );
}

export function StatCard({ detail, icon, label, value }: { detail?: string; icon: ReactNode; label: string; value: string }) {
  return (
    <Panel className="p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-[var(--muted)]">{label}</p>
          <strong className="mt-2 block text-2xl font-black leading-none text-[var(--text)]">{value}</strong>
          {detail && <span className="mt-2 block text-xs font-semibold text-[var(--muted)]">{detail}</span>}
        </div>
        <span className="grid h-10 w-10 place-items-center rounded-lg bg-[var(--brand-soft)] text-[var(--brand)]">{icon}</span>
      </div>
    </Panel>
  );
}

export function AlertNotice({ notice }: { notice: { tone: "good" | "warn" | "bad"; text: string } }) {
  const Icon = notice.tone === "good" ? Check : AlertTriangle;
  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className={cx(
        "flex items-start gap-3 rounded-lg border px-4 py-3 text-sm font-semibold shadow-sm",
        notice.tone === "good" && "border-[#ace8d0] bg-[var(--good-soft)] text-[var(--good)]",
        notice.tone === "warn" && "border-[#f2d483] bg-[var(--warn-soft)] text-[var(--warn)]",
        notice.tone === "bad" && "border-[#ffb8b0] bg-[var(--bad-soft)] text-[var(--bad)]",
      )}
      exit={{ opacity: 0, y: -8 }}
      initial={{ opacity: 0, y: 8 }}
      role="alert"
    >
      <Icon className="mt-0.5 flex-none" size={18} />
      <span className="min-w-0 break-words">{notice.text}</span>
    </motion.div>
  );
}

export function ProgressBar({ value }: { value: number }) {
  return (
    <div className="relative min-h-11 overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--glass)] shadow-[var(--shadow)]">
      <motion.span animate={{ width: `${value}%` }} className="absolute inset-y-0 left-0 bg-[linear-gradient(90deg,#1769e0,#0f9f8f)]" initial={{ width: 0 }} />
      <strong className="relative z-10 grid min-h-11 place-items-center text-sm font-black text-[var(--text)]">{value}%</strong>
    </div>
  );
}

export function FeaturePill({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <span className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] px-3 text-sm font-bold text-[var(--muted)]">
      <span className="text-[var(--brand)]">{icon}</span>
      {text}
    </span>
  );
}

export function FormField({ children, label }: { children: ReactNode; label: string }) {
  return (
    <label className="grid gap-2 text-sm font-extrabold text-[var(--muted)]">
      {label}
      {children}
    </label>
  );
}

export function SectionHeading({ kicker, text, title }: { kicker: string; text: string; title: string }) {
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-normal text-[var(--brand)]">{kicker}</p>
      <h2 className="mt-2 text-2xl font-black leading-tight text-[var(--text)]">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{text}</p>
    </div>
  );
}

export function EmptyState({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="grid min-h-48 place-items-center p-6 text-center text-[var(--muted)]">
      <div>
        <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-lg bg-[var(--surface-strong)] text-[var(--brand)]">{icon}</span>
        <p className="text-sm font-bold">{text}</p>
      </div>
    </div>
  );
}

export function BrandBlock({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <LogoMark />
      <div className="min-w-0">
        <p className="text-xs font-black uppercase tracking-normal text-[var(--muted)]">{eyebrow}</p>
        <p className="mt-1 truncate text-2xl font-black leading-none text-[var(--text)]">{title}</p>
      </div>
    </div>
  );
}

export function LogoMark() {
  return (
    <span className="grid h-12 w-12 flex-none place-items-center rounded-lg bg-[linear-gradient(135deg,#1769e0,#0f9f8f)] text-white shadow-[0_16px_40px_rgba(23,105,224,0.28)]">
      <Cloud size={24} />
    </span>
  );
}
