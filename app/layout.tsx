import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "TeCloud - Telegram Cloud Drive",
    template: "%s | TeCloud",
  },
  description: "File manager modern untuk menyimpan, mengelola, dan membagikan file menggunakan Telegram Bot API sebagai storage.",
  applicationName: "TeCloud",
  keywords: ["cloud drive", "telegram storage", "file manager", "secure sharing", "dashboard admin"],
  openGraph: {
    title: "TeCloud - Telegram Cloud Drive",
    description: "Workspace file manager dengan Telegram storage, secure sharing, dan dashboard admin.",
    siteName: "TeCloud",
    type: "website",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f8fc" },
    { media: "(prefers-color-scheme: dark)", color: "#080b12" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
