"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/cn";

type Props = {
  value: string | number;
  onChange: (value: string) => void;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
};

export function NumberInput({
  value,
  onChange,
  min,
  max,
  step = 1,
  placeholder,
  className,
  disabled,
  id,
}: Props) {
  const n = Number(String(value).replace(",", "."));
  const current = Number.isFinite(n) ? n : 0;

  function clamp(v: number) {
    let x = v;
    if (min != null && x < min) x = min;
    if (max != null && x > max) x = max;
    return x;
  }

  function bump(dir: 1 | -1) {
    if (disabled) return;
    const next = clamp(current + dir * step);
    // keep one decimal when step is fractional
    const digits = String(step).includes(".") ? String(step).split(".")[1].length : 0;
    onChange(digits ? next.toFixed(digits) : String(Math.round(next)));
  }

  return (
    <div className={cn("tc-number-input", className)}>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        disabled={disabled}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="tc-number-field"
      />
      <div className="tc-number-spinners">
        <button type="button" tabIndex={-1} disabled={disabled} onClick={() => bump(1)} aria-label="Increase">
          <ChevronUp className="h-3 w-3" />
        </button>
        <button type="button" tabIndex={-1} disabled={disabled} onClick={() => bump(-1)} aria-label="Decrease">
          <ChevronDown className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
