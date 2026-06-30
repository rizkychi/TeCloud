"use client";

import { FormEvent, useEffect, useState } from "react";

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

  useEffect(() => {
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

  return (
    <main className="app-shell share-page">
      <section className="share-panel">
        <div className="brand share-brand">
          <span className="brand-mark">T</span>
          <div>
            <p className="eyebrow">TeCloud Share</p>
            <h1>Unduh File</h1>
          </div>
        </div>

        {file ? (
          <form className="share-card" onSubmit={download}>
            <strong>{file.name}</strong>
            <span>{formatBytes(file.size)} · {file.mimeType}</span>
            {file.shareMode === "password" && (
              <label className="auth-field">
                Password share
                <input
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Masukkan password"
                  type="password"
                  value={password}
                />
              </label>
            )}
            <button className="primary-button" type="submit">Download</button>
          </form>
        ) : (
          <div className="empty-state">{error || "Memuat link..."}</div>
        )}
      </section>
    </main>
  );
}
