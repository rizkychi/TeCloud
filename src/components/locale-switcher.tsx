"use client";

import { useRouter } from "next/navigation";
import { Button } from "./ui/button";

export function LocaleSwitcher({ locale }: { locale: string }) {
  const router = useRouter();
  async function setLocale(next: "en" | "id") {
    await fetch("/api/locale", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale: next }),
    });
    // also persist on user if logged in
    await fetch("/api/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale: next }),
    }).catch(() => undefined);
    router.refresh();
  }
  return (
    <div className="flex items-center gap-1 rounded-lg border tc-border p-0.5">
      <Button
        size="sm"
        variant={locale === "id" ? "primary" : "subtle"}
        onClick={() => setLocale("id")}
        type="button"
      >
        ID
      </Button>
      <Button
        size="sm"
        variant={locale === "en" ? "primary" : "subtle"}
        onClick={() => setLocale("en")}
        type="button"
      >
        EN
      </Button>
    </div>
  );
}
