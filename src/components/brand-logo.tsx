import Image from "next/image";
import { cn } from "@/lib/cn";

/** App brand mark — uses /logo.png (copied from icon.png) */
export function BrandLogo({
  size = 36,
  className,
  rounded = "xl",
}: {
  size?: number;
  className?: string;
  rounded?: "lg" | "xl" | "2xl" | "full";
}) {
  const radius =
    rounded === "full"
      ? "rounded-full"
      : rounded === "2xl"
        ? "rounded-2xl"
        : rounded === "lg"
          ? "rounded-lg"
          : "rounded-xl";

  return (
    <Image
      src="/logo.png"
      alt="TeCloud"
      width={size}
      height={size}
      priority={size >= 32}
      className={cn(
        "shrink-0 object-cover shadow-sm ring-1 ring-black/5 dark:ring-white/10",
        radius,
        className,
      )}
    />
  );
}
