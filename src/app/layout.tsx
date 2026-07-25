import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { getLocale } from "@/lib/i18n/locale";
import { getCurrentUser } from "@/lib/auth";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "TeCloud",
  description: "Telegram-ready personal cloud storage — Drive-like UX",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const user = await getCurrentUser().catch(() => null);
  const theme = user?.theme === "light" ? "light" : "dark";
  return (
    <html
      lang={locale}
      className={`${inter.variable} ${jetbrains.variable} ${theme} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
