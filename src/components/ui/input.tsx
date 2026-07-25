import { cn } from "@/lib/cn";
import type { InputHTMLAttributes } from "react";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full rounded-lg border tc-border bg-transparent px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--faint)] outline-none focus:ring-2 focus:ring-[var(--brand)]/40",
        className,
      )}
      {...props}
    />
  );
}
