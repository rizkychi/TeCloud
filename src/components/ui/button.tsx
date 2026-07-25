import { cn } from "@/lib/cn";
import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger" | "subtle";
  size?: "sm" | "md" | "icon";
};

export function Button({
  className,
  variant = "ghost",
  size = "md",
  ...props
}: Props) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition disabled:opacity-50 disabled:pointer-events-none",
        size === "sm" && "h-8 px-3 text-xs",
        size === "md" && "h-9 px-4 text-sm",
        size === "icon" && "h-9 w-9 p-0",
        variant === "primary" && "tc-primary",
        variant === "ghost" && "border tc-border tc-hover text-[var(--text-2)]",
        variant === "subtle" && "bg-[var(--surface-2)] text-[var(--text-2)] hover:opacity-90",
        variant === "danger" && "border border-red-500/30 text-[var(--danger)] hover:bg-red-500/10",
        className,
      )}
      {...props}
    />
  );
}
