"use client";

import { useEffect } from "react";
import { themeClass } from "@/lib/units";

export function ThemeProvider({
  theme,
  children,
}: {
  theme: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove(
      "light",
      "dark",
      "theme-ocean",
      "theme-forest",
      "theme-sunset",
      "theme-campus",
    );
    root.classList.add(themeClass(theme));
  }, [theme]);

  return <>{children}</>;
}
