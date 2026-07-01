"use client";

import { FormEvent, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Cloud, Download, FileText, KeyRound, Moon, Sun } from "lucide-react";

type SharedFile = {
  name: string;
  size: number;
  mimeType: string;
  shareMode: "public" | "password";
  downloadCount: number;
  updatedAt: string;
};

function formatBytes(value: number) {
  if (!value) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export default function ShareDownload({ token }: { token: string }) {
  const [file, setFile] = useState<SharedFile | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    setDarkMode(window.localStorage.getItem("tecloud_theme") === "dark");
    fetch(`/api/s/${token}`)
      .then((response) => response.json())
      .then((data) => {
        if (data.file) setFile(data.file);
        else setError(data.error || "Link tidak ditemukan.");
      })
      .catch(() => setError("Link tidak bisa dibuka."));
  }, [token]);

  function download(event: FormEvent) {
    event.preventDefault();
    const suffix = file?.shareMode === "password" ? `?password=${encodeURIComponent(password)}` : "";
    window.location.href = `/api/s/${token}/download${suffix}`;
  }

  function toggleTheme() {
    setDarkMode((current) => {
      const next = !current;
      window.localStorage.setItem("tecloud_theme", next ? "dark" : "light");
      return next;
    });
  }

  return (
    <main className={`${darkMode ? "theme-dark" : ""} min-h-screen bg-[var(--page)] text-[var(--text)] transition-colors duration-300`}>
      <div className="mx-auto grid min-h-screen w-full max-w-xl place-items-center px-4 py-8">
        <motion.section
          animate={{ opacity: 1, y: 0 }}
          className="w-full rounded-lg border border-[var(--line)] bg-[var(--glass)] p-4 shadow-[var(--shadow)] backdrop-blur-xl sm:p-5"
          initial={{ opacity: 0, y: 14 }}
        >
          <header className="mb-6 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-lg bg-[linear-gradient(135deg,#1769e0,#0f9f8f)] text-white shadow-[0_16px_40px_rgba(23,105,224,0.28)]">
                <Cloud size={24} />
              </span>
              <div>
                <p className="text-xs font-black uppercase tracking-normal text-[var(--muted)]">TeCloud Share</p>
                <h1 className="mt-1 text-2xl font-black leading-none">Unduh File</h1>
              </div>
            </div>
            <button
              aria-label="Ganti tema"
              className="grid h-11 w-11 place-items-center rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] text-[var(--text)] transition hover:border-[var(--brand)] hover:text-[var(--brand)]"
              onClick={toggleTheme}
              type="button"
            >
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </header>

          {file ? (
            <form className="grid gap-4" onSubmit={download}>
              <div className="rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] p-4">
                <span className="mb-3 grid h-11 w-11 place-items-center rounded-lg bg-[var(--brand-soft)] text-[var(--brand)]">
                  <FileText size={21} />
                </span>
                <strong className="block break-words text-lg font-black">{file.name}</strong>
                <span className="mt-2 block text-sm font-semibold text-[var(--muted)]">{formatBytes(file.size)} / {file.mimeType}</span>
              </div>
              {file.shareMode === "password" && (
                <label className="grid gap-2 text-sm font-extrabold text-[var(--muted)]">
                  Password share
                  <span className="relative block">
                    <KeyRound className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={17} />
                    <input
                      className="field-input pl-10"
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="Masukkan password"
                      type="password"
                      value={password}
                    />
                  </span>
                </label>
              )}
              <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[var(--brand)] px-4 text-sm font-extrabold text-white shadow-[0_16px_35px_rgba(23,105,224,0.25)] transition hover:brightness-95" type="submit">
                <Download size={17} /> Download
              </button>
            </form>
          ) : (
            <div className="grid min-h-48 place-items-center rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] p-6 text-center text-sm font-bold text-[var(--muted)]">
              {error || "Memuat link..."}
            </div>
          )}
        </motion.section>
      </div>
    </main>
  );
}
