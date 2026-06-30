"use client";

import { ChangeEvent, DragEvent, FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  isTelegramFileTooLarge,
  maxTelegramFileLabel,
  telegramFileLimitMessage,
} from "../../lib/upload-limits";

type User = {
  id: string;
  name: string;
  username: string;
  telegramChatId: string;
  role: "admin" | "user";
  status: "pending" | "active" | "suspended";
  quotaBytes: number;
  usedBytes: number;
};

type StoredFile = {
  id: string;
  ownerId: string;
  name: string;
  originalName: string;
  mimeType: string;
  size: number;
  messageId: number;
  uploadedAt: string;
  updatedAt: string;
  version: number;
  shareMode: "private" | "public" | "password";
  shareToken?: string;
  downloadCount: number;
};

type Notice = { tone: "good" | "warn" | "bad"; text: string };
type AuthMode = "signin" | "signup" | "verify" | "forgot" | "reset";
type MainView = "files" | "admin";
type PendingVerification = {
  username: string;
  token: string;
  verifyCommand: string;
  botUrl?: string | null;
};

type AdminSummary = {
  totalUsers: number;
  totalFiles: number;
  totalStorage: number;
  totalDownloads: number;
  recentEvents: { type: string; bytes: number; createdAt: string }[];
};

type AdminUser = User & {
  createdAt: string;
  updatedAt: string;
  verifiedAt?: string;
};

const fileTypes = ["Semua", "Gambar", "Dokumen", "Video", "Lainnya"];
let csrfTokenCache = "";

function Icon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    upload: "M12 15V4m0 0 4 4m-4-4-4 4M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3",
    search: "m21 21-4.3-4.3M10.8 18a7.2 7.2 0 1 1 0-14.4 7.2 7.2 0 0 1 0 14.4Z",
    download: "M12 4v11m0 0 4-4m-4 4-4-4M5 20h14",
    edit: "m16.9 4.6 2.5 2.5L8.4 18.1 5 19l.9-3.4L16.9 4.6Z",
    trash: "M4 7h16M9 7V5h6v2m-8 0 1 13h8l1-13",
    refresh: "M20 12a8 8 0 0 1-14.4 4.8M4 12A8 8 0 0 1 18.4 7.2M18 3v4h-4M6 21v-4h4",
    replace: "M7 7h10v4M17 7l-3-3m3 3-3 3M17 17H7v-4m0 4 3 3m-3-3 3-3",
    check: "m5 13 4 4L19 7",
    close: "M6 6l12 12M18 6 6 18",
    share: "M8 12h8M13 7l5 5-5 5M6 5h5M6 19h5",
    copy: "M8 8h10v12H8zM6 16H4V4h12v2",
    telegram: "M21 4 3 11l5 2 2 5 3-4 4 3 3-17Z",
    alert: "M12 9v4m0 4h.01M10.3 4.6 2.2-1.2 2.2 1.2 7.2 12.5-2.2 3.8H5.8l-2.2-3.8z",
  };

  return (
    <svg aria-hidden="true" className="icon" fill="none" viewBox="0 0 24 24">
      <path d={paths[name]} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

function formatBytes(value: number) {
  if (!value) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function getType(file: StoredFile) {
  if (file.mimeType.startsWith("image/")) return "Gambar";
  if (file.mimeType.startsWith("video/")) return "Video";
  if (file.mimeType.includes("pdf") || file.mimeType.includes("document") || file.mimeType.includes("sheet") || file.mimeType.includes("text")) return "Dokumen";
  return "Lainnya";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function extractVerifyToken(value: string) {
  const text = value.trim();
  if (!text) return "";
  const startMatch = text.match(/\/start(?:@\w+)?\s+verify_([A-Za-z0-9_-]+)/i);
  if (startMatch?.[1]) return startMatch[1];
  const verifyMatch = text.match(/\/verify(?:@\w+)?\s+([A-Za-z0-9_-]+)/i);
  if (verifyMatch?.[1]) return verifyMatch[1];
  return text;
}

async function jsonRequest(path: string, init?: RequestInit) {
  const method = init?.method?.toUpperCase() || "GET";
  const headers = { ...(init?.headers || {}) } as Record<string, string>;
  if (method !== "GET" && method !== "HEAD") {
    headers["x-csrf-token"] = await getCsrfToken();
  }

  const response = await fetch(path, {
    ...init,
    headers:
      init?.body instanceof FormData
        ? headers
        : { "Content-Type": "application/json", ...headers },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Permintaan gagal.");
  return data;
}

async function getCsrfToken() {
  if (csrfTokenCache) return csrfTokenCache;
  const response = await fetch("/api/auth/csrf");
  const data = await response.json();
  csrfTokenCache = data.token || "";
  return csrfTokenCache;
}

async function sendFormWithProgress(
  method: "POST" | "PATCH",
  path: string,
  formData: FormData,
  onProgress: (progress: number) => void,
) {
  const csrfToken = await getCsrfToken();

  return new Promise<any>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open(method, path);
    request.setRequestHeader("x-csrf-token", csrfToken);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    request.onload = () => {
      const data = JSON.parse(request.responseText || "{}");
      if (request.status >= 200 && request.status < 300) {
        resolve(data);
      } else {
        reject(new Error(data.error || "Upload gagal."));
      }
    };
    request.onerror = () => reject(new Error("Koneksi upload terputus."));
    request.send(formData);
  });
}

export default function CloudDrive() {
  const [user, setUser] = useState<User | null>(null);
  const [files, setFiles] = useState<StoredFile[]>([]);
  const [configured, setConfigured] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("Semua");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [authMode, setAuthMode] = useState<AuthMode>("signin");
  const [view, setView] = useState<MainView>("files");
  const [verifyUsername, setVerifyUsername] = useState("");
  const [pendingVerification, setPendingVerification] = useState<PendingVerification | null>(null);
  const [shareFile, setShareFile] = useState<StoredFile | null>(null);
  const [sharePassword, setSharePassword] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [adminSummary, setAdminSummary] = useState<AdminSummary | null>(null);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  const filteredFiles = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return files.filter((file) => {
      const matchesQuery = !normalized || file.name.toLowerCase().includes(normalized) || file.originalName.toLowerCase().includes(normalized);
      const matchesType = filter === "Semua" || getType(file) === filter;
      return matchesQuery && matchesType;
    });
  }, [files, filter, query]);

  const loadFiles = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await jsonRequest("/api/files");
      setFiles(data.files);
      setConfigured(data.configured);
      setUser(data.user);
      setNotice(data.configured ? null : { tone: "warn", text: "Tambahkan TELEGRAM_BOT_TOKEN dan TELEGRAM_CHAT_ID agar upload aktif." });
    } catch (error) {
      setNotice({ tone: "bad", text: error instanceof Error ? error.message : "Gagal membaca daftar file." });
    } finally {
      setLoading(false);
    }
  }, [user]);

  const loadAdmin = useCallback(async () => {
    if (user?.role !== "admin") return;
    const [summary, users] = await Promise.all([jsonRequest("/api/admin/summary"), jsonRequest("/api/admin/users")]);
    setAdminSummary(summary);
    setAdminUsers(users.users);
  }, [user]);

  useEffect(() => {
    void getCsrfToken();
    const pending = window.localStorage.getItem("tecloud_pending_verify");
    if (pending) {
      try {
        const parsed = JSON.parse(pending) as PendingVerification;
        if (parsed.username && parsed.token && parsed.verifyCommand) {
          setPendingVerification(parsed);
          setVerifyUsername(parsed.username);
        }
      } catch {
        window.localStorage.removeItem("tecloud_pending_verify");
      }
    }
    jsonRequest("/api/auth/me")
      .then((data) => {
        setUser(data.user);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (user) void loadFiles();
  }, [user?.id]);

  useEffect(() => {
    if (view === "admin") void loadAdmin();
  }, [view, loadAdmin]);

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const value = (name: string) => String(form.get(name) || "").trim();

    try {
      if (authMode === "signin") {
        const data = await jsonRequest("/api/auth/signin", { method: "POST", body: JSON.stringify({ username: value("username"), password: value("password") }) });
        setUser(data.user);
      } else if (authMode === "signup") {
        const data = await jsonRequest("/api/auth/signup", {
          method: "POST",
          body: JSON.stringify({ username: value("username"), password: value("password") }),
        });
        const pending = {
          username: data.username,
          token: data.token,
          verifyCommand: data.verifyCommand,
          botUrl: data.botUrl,
        } satisfies PendingVerification;
        setPendingVerification(pending);
        window.localStorage.setItem("tecloud_pending_verify", JSON.stringify(pending));
        setVerifyUsername(data.username);
        setAuthMode("verify");
        setNotice({ tone: "good", text: "Akun dibuat. Lanjutkan verifikasi lewat bot Telegram." });
      } else if (authMode === "verify") {
        const token = pendingVerification?.token || extractVerifyToken(value("verifyCommand"));
        const data = await jsonRequest("/api/auth/verify", {
          method: "POST",
          body: JSON.stringify({ username: value("username") || verifyUsername || pendingVerification?.username, token }),
        });
        window.localStorage.removeItem("tecloud_pending_verify");
        setPendingVerification(null);
        setUser(data.user);
      } else if (authMode === "forgot") {
        await jsonRequest("/api/auth/forgot", { method: "POST", body: JSON.stringify({ username: value("username") }) });
        setVerifyUsername(value("username"));
        setAuthMode("reset");
        setNotice({ tone: "good", text: "Kode reset dikirim jika akun ditemukan." });
      } else {
        await jsonRequest("/api/auth/reset", { method: "POST", body: JSON.stringify({ username: value("username") || verifyUsername, code: value("code"), password: value("password") }) });
        setAuthMode("signin");
        setNotice({ tone: "good", text: "Password berhasil diganti." });
      }
    } catch (error) {
      setNotice({ tone: "bad", text: error instanceof Error ? error.message : "Proses akun gagal." });
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await jsonRequest("/api/auth/logout", { method: "POST", body: "{}" });
    setUser(null);
    setFiles([]);
    setView("files");
  }

  async function copyVerifyCommand() {
    const command = pendingVerification?.verifyCommand;
    if (!command) return;
    try {
      await navigator.clipboard.writeText(command);
      setNotice({ tone: "good", text: "Command verifikasi disalin." });
    } catch {
      setNotice({ tone: "warn", text: "Salin command secara manual dari kotak verifikasi." });
    }
  }

  async function uploadFiles(selectedFiles: FileList | File[]) {
    const queue = Array.from(selectedFiles);
    if (!queue.length) return;
    const oversized = queue.find((file) => isTelegramFileTooLarge(file.size));
    if (oversized) {
      setNotice({
        tone: "bad",
        text: `${oversized.name}: ${telegramFileLimitMessage()}`,
      });
      setDragging(false);
      return;
    }

    setBusy(true);
    setNotice({ tone: "good", text: `Mengunggah ${queue.length} file...` });
    setUploadProgress(0);

    try {
      for (let index = 0; index < queue.length; index += 1) {
        const file = queue[index];
        const formData = new FormData();
        formData.set("file", file);
        await sendFormWithProgress("POST", "/api/files", formData, (progress) => {
          setUploadProgress(
            Math.round(((index + progress / 100) / queue.length) * 100),
          );
        });
      }
      setNotice({ tone: "good", text: "File berhasil disimpan ke Telegram." });
      await loadFiles();
    } catch (error) {
      setNotice({ tone: "bad", text: error instanceof Error ? error.message : "Upload gagal." });
    } finally {
      setBusy(false);
      setUploadProgress(null);
      setDragging(false);
    }
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    uploadFiles(event.dataTransfer.files);
  }

  function onPick(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files) {
      uploadFiles(event.target.files);
      event.target.value = "";
    }
  }

  async function saveRename(event: FormEvent<HTMLFormElement>, file: StoredFile) {
    event.preventDefault();
    const name = draftName.trim();
    if (!name || name === file.name) {
      setEditingId(null);
      return;
    }

    try {
      const data = await jsonRequest(`/api/files/${file.id}`, { method: "PATCH", body: JSON.stringify({ name }) });
      setFiles((current) => current.map((item) => (item.id === file.id ? data.file : item)));
      setEditingId(null);
      setNotice({ tone: "good", text: "Nama file diperbarui." });
    } catch (error) {
      setNotice({ tone: "bad", text: error instanceof Error ? error.message : "Rename gagal." });
    }
  }

  async function replaceFile(file: StoredFile, selected: FileList | null) {
    if (!selected?.[0]) return;
    if (isTelegramFileTooLarge(selected[0].size)) {
      setNotice({
        tone: "bad",
        text: `${selected[0].name}: ${telegramFileLimitMessage()}`,
      });
      return;
    }

    const formData = new FormData();
    formData.set("file", selected[0]);
    formData.set("name", file.name);
    setUploadProgress(0);
    try {
      const data = await sendFormWithProgress(
        "PATCH",
        `/api/files/${file.id}`,
        formData,
        setUploadProgress,
      );
      setFiles((current) => current.map((item) => (item.id === file.id ? data.file : item)));
      setNotice({ tone: "good", text: "Isi file berhasil diganti." });
    } catch (error) {
      setNotice({ tone: "bad", text: error instanceof Error ? error.message : "Ganti file gagal." });
    } finally {
      setUploadProgress(null);
    }
  }

  async function deleteFile(file: StoredFile) {
    if (!window.confirm(`Hapus ${file.name}?`)) return;
    try {
      await jsonRequest(`/api/files/${file.id}`, { method: "DELETE" });
      setFiles((current) => current.filter((item) => item.id !== file.id));
      setNotice({ tone: "good", text: "File dihapus dari Telegram." });
    } catch (error) {
      setNotice({ tone: "bad", text: error instanceof Error ? error.message : "Hapus file gagal." });
    }
  }

  async function updateShare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!shareFile) return;
    const form = new FormData(event.currentTarget);
    const mode = String(form.get("mode"));
    try {
      const data = await jsonRequest(`/api/files/${shareFile.id}/share`, {
        method: "PATCH",
        body: JSON.stringify({ mode, password: sharePassword }),
      });
      setShareUrl(data.shareUrl || "");
      setFiles((current) => current.map((item) => (item.id === shareFile.id ? data.file : item)));
      setShareFile(data.file);
      setNotice({ tone: "good", text: mode === "private" ? "File dibuat privat." : "Link share siap." });
    } catch (error) {
      setNotice({ tone: "bad", text: error instanceof Error ? error.message : "Share gagal." });
    }
  }

  async function updateAdminUser(target: AdminUser, patch: Partial<{ quotaMb: number; role: string; status: string }>) {
    try {
      const data = await jsonRequest(`/api/admin/users/${target.id}`, { method: "PATCH", body: JSON.stringify(patch) });
      setAdminUsers((current) => current.map((item) => (item.id === target.id ? data.user : item)));
      setNotice({ tone: "good", text: "Akun diperbarui." });
    } catch (error) {
      setNotice({ tone: "bad", text: error instanceof Error ? error.message : "Update akun gagal." });
    }
  }

  if (loading && !user) {
    return <main className="app-shell"><section className="workspace"><div className="empty-state">Memuat TeCloud...</div></section></main>;
  }

  if (!user) {
    return (
      <main className="app-shell auth-shell">
        <section className="auth-layout">
          <div className="auth-hero">
            <div className="brand">
              <span className="brand-mark">T</span>
              <div>
                <p className="eyebrow">Telegram Cloud Drive</p>
                <h1>TeCloud</h1>
              </div>
            </div>
            <div className="auth-points">
              <span>File terenkripsi akses akun</span>
              <span>Share public, password, atau privat</span>
              <span>Verifikasi langsung lewat bot</span>
            </div>
          </div>

          <section className="auth-panel">
            <div className="auth-tabs compact">
              {(["signin", "signup", "verify", "forgot", "reset"] as AuthMode[]).map((mode) => (
                <button className={authMode === mode ? "active" : ""} key={mode} onClick={() => setAuthMode(mode)} type="button">
                  {mode === "signin" ? "Masuk" : mode === "signup" ? "Daftar" : mode === "verify" ? "Verifikasi" : mode === "forgot" ? "Lupa" : "Reset"}
                </button>
              ))}
            </div>
            {notice && <AlertNotice notice={notice} />}

            {authMode === "verify" ? (
              <form className="auth-form verify-card" onSubmit={submitAuth}>
                <div>
                  <h2>Verifikasi Telegram</h2>
                  <p>Kirim command ini ke bot TeCloud, lalu kembali ke halaman ini untuk mengecek statusnya.</p>
                </div>
                <label className="auth-field">Username<input defaultValue={pendingVerification?.username || verifyUsername} name="username" placeholder="username" /></label>
                {pendingVerification ? (
                  <div className="command-box">
                    <code>{pendingVerification.verifyCommand}</code>
                    <button className="icon-button" onClick={copyVerifyCommand} title="Salin command" type="button"><Icon name="copy" /></button>
                  </div>
                ) : (
                  <label className="auth-field">Command verifikasi<input name="verifyCommand" placeholder="/verify xxxxxxxxx" /></label>
                )}
                <div className="verify-actions">
                  {pendingVerification?.botUrl && (
                    <a className="telegram-button" href={pendingVerification.botUrl} rel="noreferrer" target="_blank">
                      <Icon name="telegram" /> Buka bot Telegram
                    </a>
                  )}
                  <button className="primary-button" disabled={busy} type="submit">Saya sudah kirim command</button>
                </div>
              </form>
            ) : (
              <form className="auth-form" onSubmit={submitAuth}>
                {(authMode === "signin" || authMode === "signup" || authMode === "forgot" || authMode === "reset") && (
                  <label className="auth-field">Username<input defaultValue={verifyUsername} name="username" placeholder="username" /></label>
                )}
                {(authMode === "signin" || authMode === "signup" || authMode === "reset") && (
                  <label className="auth-field">Password<input name="password" placeholder="Minimal 8 karakter" type="password" /></label>
                )}
                {authMode === "reset" && <label className="auth-field">Kode Telegram<input name="code" placeholder="6 digit" /></label>}
                <button className="primary-button" disabled={busy} type="submit">
                  {authMode === "signin" ? "Masuk" : authMode === "signup" ? "Buat akun" : authMode === "forgot" ? "Kirim kode reset" : "Reset password"}
                </button>
              </form>
            )}
          </section>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <section className="workspace">
        <header className="topbar">
          <div className="brand">
            <span className="brand-mark">T</span>
            <div>
              <p className="eyebrow">Telegram Cloud Drive</p>
              <h1>TeCloud</h1>
            </div>
          </div>
          <div className="top-actions">
            <span className={configured ? "status ready" : "status"}>{configured ? "Telegram siap" : "Perlu konfigurasi"}</span>
            {user.role === "admin" && <button className="text-button" onClick={() => setView(view === "admin" ? "files" : "admin")} type="button">{view === "admin" ? "File" : "Admin"}</button>}
            <button className="text-button" onClick={logout} type="button">Keluar</button>
            <button className="icon-button" disabled={loading} onClick={loadFiles} title="Muat ulang" type="button"><Icon name="refresh" /></button>
          </div>
        </header>

        {notice && <AlertNotice notice={notice} />}
        {uploadProgress !== null && (
          <div className="upload-progress" aria-label="Progress upload">
            <span style={{ width: `${uploadProgress}%` }} />
            <strong>{uploadProgress}%</strong>
          </div>
        )}

        {view === "admin" ? (
          <AdminPanel adminSummary={adminSummary} adminUsers={adminUsers} updateAdminUser={updateAdminUser} />
        ) : (
          <>
            <section className="summary-strip">
              <div><span>Total file</span><strong>{files.length}</strong></div>
              <div><span>Terpakai</span><strong>{formatBytes(totalSize)}</strong></div>
              <div><span>Kuota</span><strong>{formatBytes(user.quotaBytes)}</strong></div>
            </section>

            <label className={`upload-zone ${dragging ? "dragging" : ""}`} onDragEnter={() => setDragging(true)} onDragLeave={() => setDragging(false)} onDragOver={(event) => event.preventDefault()} onDrop={onDrop}>
              <input multiple onChange={onPick} type="file" />
              <span className="upload-icon"><Icon name="upload" /></span>
              <span className="upload-title">Pilih atau tarik file ke sini</span>
              <span className="upload-copy">Maksimal di bawah {maxTelegramFileLabel} per file. File disimpan di Telegram dan hanya owner/admin yang bisa mengelola.</span>
            </label>

            <section className="toolbar">
              <label className="search-field"><Icon name="search" /><input onChange={(event) => setQuery(event.target.value)} placeholder="Cari file" value={query} /></label>
              <div className="tabs" role="tablist" aria-label="Filter tipe file">
                {fileTypes.map((type) => <button aria-selected={filter === type} className={filter === type ? "active" : ""} key={type} onClick={() => setFilter(type)} role="tab" type="button">{type}</button>)}
              </div>
            </section>

            <section aria-busy={loading || busy} className="file-list">
              <div className="list-head"><span>Nama</span><span>Tipe</span><span>Ukuran</span><span>Share</span><span>Aksi</span></div>
              {loading ? <div className="empty-state">Memuat file...</div> : filteredFiles.length ? filteredFiles.map((file) => (
                <article className="file-row" key={file.id}>
                  <div className="file-name">
                    <Image alt="" height={34} src="/file.svg" width={34} />
                    {editingId === file.id ? (
                      <form className="rename-form" onSubmit={(event) => saveRename(event, file)}>
                        <input autoFocus onChange={(event) => setDraftName(event.target.value)} value={draftName} />
                        <button aria-label="Simpan nama" type="submit"><Icon name="check" /></button>
                        <button aria-label="Batal" onClick={() => setEditingId(null)} type="button"><Icon name="close" /></button>
                      </form>
                    ) : (
                      <div><strong>{file.name}</strong><small>v{file.version} · {formatDate(file.updatedAt)} · {file.downloadCount} download</small></div>
                    )}
                  </div>
                  <span>{getType(file)}</span>
                  <span>{formatBytes(file.size)}</span>
                  <span className={`share-pill ${file.shareMode}`}>{file.shareMode}</span>
                  <div className="row-actions">
                    <a className="icon-button" href={`/api/files/${file.id}/download`} title="Unduh"><Icon name="download" /></a>
                    <button className="icon-button" onClick={() => { setEditingId(file.id); setDraftName(file.name); }} title="Ubah nama" type="button"><Icon name="edit" /></button>
                    <button className="icon-button" onClick={() => { setShareFile(file); setShareUrl(file.shareToken ? `${window.location.origin}/share/${file.shareToken}` : ""); }} title="Bagikan" type="button"><Icon name="share" /></button>
                    <label className="icon-button" title="Ganti file"><Icon name="replace" /><input onChange={(event) => { replaceFile(file, event.target.files); event.target.value = ""; }} type="file" /></label>
                    <button className="icon-button danger" onClick={() => deleteFile(file)} title="Hapus" type="button"><Icon name="trash" /></button>
                  </div>
                </article>
              )) : <div className="empty-state">Belum ada file yang cocok.</div>}
            </section>
          </>
        )}
      </section>

      {shareFile && (
        <div className="modal-backdrop">
          <form className="modal" onSubmit={updateShare}>
            <div className="modal-head">
              <strong>Bagikan file</strong>
              <button className="icon-button" onClick={() => setShareFile(null)} type="button"><Icon name="close" /></button>
            </div>
            <p>{shareFile.name}</p>
            <label className="auth-field">Mode
              <select defaultValue={shareFile.shareMode} name="mode" onChange={() => setSharePassword("")}>
                <option value="private">Privat</option>
                <option value="public">Public</option>
                <option value="password">Public dengan password</option>
              </select>
            </label>
            <label className="auth-field">Password baru
              <input onChange={(event) => setSharePassword(event.target.value)} placeholder="Isi jika mode password" type="password" value={sharePassword} />
            </label>
            {shareUrl && <label className="auth-field">Link share<input readOnly value={shareUrl} /></label>}
            <button className="primary-button" type="submit">Simpan share</button>
          </form>
        </div>
      )}
    </main>
  );
}

function AlertNotice({ notice }: { notice: Notice }) {
  return (
    <div className={`notice ${notice.tone}`} role="alert">
      <Icon name={notice.tone === "good" ? "check" : "alert"} />
      <span>{notice.text}</span>
    </div>
  );
}

function AdminPanel({ adminSummary, adminUsers, updateAdminUser }: {
  adminSummary: AdminSummary | null;
  adminUsers: AdminUser[];
  updateAdminUser: (target: AdminUser, patch: Partial<{ quotaMb: number; role: string; status: string }>) => void;
}) {
  return (
    <section className="admin-area">
      <section className="summary-strip">
        <div><span>User</span><strong>{adminSummary?.totalUsers ?? 0}</strong></div>
        <div><span>File</span><strong>{adminSummary?.totalFiles ?? 0}</strong></div>
        <div><span>Storage</span><strong>{formatBytes(adminSummary?.totalStorage ?? 0)}</strong></div>
        <div><span>Download</span><strong>{adminSummary?.totalDownloads ?? 0}</strong></div>
      </section>
      <section className="admin-grid">
        <div className="admin-card">
          <h2>Manajemen Akun</h2>
          {adminUsers.map((account) => (
            <article className="admin-user" key={account.id}>
              <div>
                <strong>{account.name}</strong>
                <small>@{account.username} · {account.telegramChatId} · {formatBytes(account.usedBytes)} / {formatBytes(account.quotaBytes)}</small>
              </div>
              <select defaultValue={account.status} onChange={(event) => updateAdminUser(account, { status: event.target.value })}>
                <option value="pending">pending</option>
                <option value="active">active</option>
                <option value="suspended">suspended</option>
              </select>
              <select defaultValue={account.role} onChange={(event) => updateAdminUser(account, { role: event.target.value })}>
                <option value="user">user</option>
                <option value="admin">admin</option>
              </select>
              <input defaultValue={Math.round(account.quotaBytes / 1024 / 1024)} onBlur={(event) => updateAdminUser(account, { quotaMb: Number(event.target.value) })} type="number" />
            </article>
          ))}
        </div>
        <div className="admin-card">
          <h2>Aktivitas Terbaru</h2>
          {adminSummary?.recentEvents.length ? adminSummary.recentEvents.map((event) => (
            <article className="activity-row" key={`${event.type}-${event.createdAt}`}>
              <strong>{event.type}</strong>
              <span>{formatBytes(event.bytes)} · {formatDate(event.createdAt)}</span>
            </article>
          )) : <div className="empty-state">Belum ada aktivitas.</div>}
        </div>
      </section>
    </section>
  );
}
