"use client";

import { ChangeEvent, DragEvent, FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import QRCode from "qrcode";
import {
  Activity,
  ArrowDownToLine,
  BarChart3,
  Check,
  CheckSquare,
  Clock3,
  Copy,
  Database,
  Download,
  Edit3,
  Eye,
  FileArchive,
  FileText,
  FolderPlus,
  FolderOpen,
  FolderTree,
  Gauge,
  HardDrive,
  KeyRound,
  Link2,
  Lock,
  LogOut,
  Moon,
  MoreHorizontal,
  QrCode,
  RefreshCw,
  Replace,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  Share2,
  Sparkles,
  Square,
  Star,
  Sun,
  Tags,
  Trash2,
  UploadCloud,
  Users,
  X,
} from "lucide-react";
import {
  AlertNotice,
  BrandBlock,
  Button,
  cx,
  EmptyState,
  FeaturePill,
  FormField,
  IconButton,
  LogoMark,
  Panel,
  ProgressBar,
  SectionHeading,
  StatCard,
  StatusBadge,
} from "./ui/primitives";
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
  folderPath: string;
  isFavorite: boolean;
  tags: string[];
  deletedAt?: string;
  deleteExpiresAt?: string;
  shareExpiresAt?: string;
  shareDownloadLimit?: number;
  shareDownloadCount: number;
};

type Notice = { tone: "good" | "warn" | "bad"; text: string };
type AuthMode = "signin" | "signup" | "verify" | "forgot" | "reset";
type MainView = "files" | "shares" | "trash" | "analytics" | "admin";
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

type ActivityEvent = {
  id: string;
  fileId?: string | null;
  type: string;
  bytes: number;
  createdAt: string;
};

type SortKey = "name" | "updatedAt" | "size" | "type" | "downloads";
type SortDirection = "asc" | "desc";
type UploadQueueItem = {
  id: string;
  name: string;
  size: number;
  progress: number;
  status: "queued" | "uploading" | "done" | "failed";
  error?: string;
};

type StorageAnalytics = {
  totalBytes: number;
  totalFiles: number;
  largestFiles: Array<{ id: string; name: string; size: number; folderPath: string }>;
  byType: Array<{ type: string; bytes: number; count: number }>;
  byFolder: Array<{ folderPath: string; bytes: number; count: number }>;
};

const fileTypes = ["Semua", "Gambar", "Dokumen", "Video", "Lainnya"];
const authModes: AuthMode[] = ["signin", "signup", "verify", "forgot", "reset"];
let csrfTokenCache = "";

const fadeUp = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

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

function getFileIcon(file?: StoredFile) {
  if (!file) return FileArchive;
  if (file.mimeType.startsWith("image/")) return Eye;
  if (file.mimeType.startsWith("video/")) return FileArchive;
  if (file.mimeType.includes("pdf") || file.mimeType.includes("document") || file.mimeType.includes("text")) return FileText;
  return FileArchive;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function normalizeClientFolderPath(value: string) {
  const cleaned = value.trim().replace(/\\/g, "/").replace(/\/+/g, "/");
  const withRoot = cleaned.startsWith("/") ? cleaned : `/${cleaned}`;
  const normalized = withRoot.length > 1 ? withRoot.replace(/\/+$/g, "") : withRoot;
  return normalized || "/";
}

function getFolderName(path: string) {
  if (path === "/") return "Root";
  return path.split("/").filter(Boolean).at(-1) || "Folder";
}

function getParentFolder(path: string) {
  if (path === "/") return "/";
  const segments = path.split("/").filter(Boolean);
  segments.pop();
  return segments.length ? `/${segments.join("/")}` : "/";
}

function getChildFolders(files: StoredFile[], currentFolder: string) {
  const prefix = currentFolder === "/" ? "/" : `${currentFolder}/`;
  const folders = new Map<string, { path: string; name: string; count: number }>();

  for (const file of files) {
    const folderPath = normalizeClientFolderPath(file.folderPath || "/");
    if (folderPath === currentFolder || !folderPath.startsWith(prefix)) continue;
    const remainder = folderPath.slice(prefix.length);
    const nextSegment = remainder.split("/").filter(Boolean)[0];
    if (!nextSegment) continue;
    const path = currentFolder === "/" ? `/${nextSegment}` : `${currentFolder}/${nextSegment}`;
    const existing = folders.get(path);
    folders.set(path, {
      path,
      name: nextSegment,
      count: (existing?.count || 0) + 1,
    });
  }

  return Array.from(folders.values()).sort((a, b) => a.name.localeCompare(b.name));
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
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    request.onload = () => {
      const data = JSON.parse(request.responseText || "{}");
      if (request.status >= 200 && request.status < 300) resolve(data);
      else reject(new Error(data.error || "Upload gagal."));
    };
    request.onerror = () => reject(new Error("Koneksi upload terputus."));
    request.send(formData);
  });
}

export default function CloudDrive() {
  const [user, setUser] = useState<User | null>(null);
  const [files, setFiles] = useState<StoredFile[]>([]);
  const [trashFiles, setTrashFiles] = useState<StoredFile[]>([]);
  const [sharedFiles, setSharedFiles] = useState<StoredFile[]>([]);
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
  const [activityEvents, setActivityEvents] = useState<ActivityEvent[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);
  const [darkMode, setDarkMode] = useState(false);
  const [currentFolder, setCurrentFolder] = useState("/");
  const [folderDraft, setFolderDraft] = useState("/");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("updatedAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [previewFile, setPreviewFile] = useState<StoredFile | null>(null);
  const [detailsFile, setDetailsFile] = useState<StoredFile | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkFolderDraft, setBulkFolderDraft] = useState("/");
  const [bulkTagsDraft, setBulkTagsDraft] = useState("");
  const [storageAnalytics, setStorageAnalytics] = useState<StorageAnalytics | null>(null);

  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  const quotaPercent = user?.quotaBytes ? Math.min(100, Math.round((totalSize / user.quotaBytes) * 100)) : 0;
  const childFolders = useMemo(() => getChildFolders(files, currentFolder), [files, currentFolder]);
  const filteredFiles = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const visible = files.filter((file) => {
      const folderPath = normalizeClientFolderPath(file.folderPath || "/");
      const matchesFolder = folderPath === currentFolder;
      const matchesQuery =
        !normalized ||
        file.name.toLowerCase().includes(normalized) ||
        file.originalName.toLowerCase().includes(normalized) ||
        folderPath.toLowerCase().includes(normalized) ||
        (file.tags || []).some((tag) => tag.toLowerCase().includes(normalized));
      const matchesType = filter === "Semua" || getType(file) === filter;
      const matchesFavorite = !showFavoritesOnly || file.isFavorite;
      return matchesFolder && matchesQuery && matchesType && matchesFavorite;
    });

    return visible.sort((a, b) => {
      const direction = sortDirection === "asc" ? 1 : -1;
      if (sortKey === "name") return a.name.localeCompare(b.name) * direction;
      if (sortKey === "type") return getType(a).localeCompare(getType(b)) * direction;
      if (sortKey === "size") return (a.size - b.size) * direction;
      if (sortKey === "downloads") return (a.downloadCount - b.downloadCount) * direction;
      return (new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()) * direction;
    });
  }, [currentFolder, files, filter, query, showFavoritesOnly, sortDirection, sortKey]);
  const selectedCount = selectedIds.size;
  const selectedVisibleCount = filteredFiles.filter((file) => selectedIds.has(file.id)).length;

  const loadFiles = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await jsonRequest("/api/files");
      setFiles(data.files || []);
      setTrashFiles(data.trash || []);
      setSharedFiles(data.shared || []);
      setConfigured(data.configured);
      setUser(data.user);
      setSelectedIds((current) => {
        const validIds = new Set((data.files || []).map((file: StoredFile) => file.id));
        return new Set(Array.from(current).filter((id) => validIds.has(id)));
      });
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

  const loadActivity = useCallback(async () => {
    if (!user) return;
    try {
      const data = await jsonRequest("/api/activity?limit=12");
      setActivityEvents(data.events || []);
    } catch {
      setActivityEvents([]);
    }
  }, [user]);

  const loadAnalytics = useCallback(async () => {
    if (!user) return;
    try {
      const data = await jsonRequest("/api/analytics/storage");
      setStorageAnalytics(data);
    } catch {
      setStorageAnalytics(null);
    }
  }, [user]);

  useEffect(() => {
    setDarkMode(window.localStorage.getItem("tecloud_theme") === "dark");
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
    if (user) {
      void loadFiles();
      void loadActivity();
    }
  }, [user?.id]);

  useEffect(() => {
    if (view === "admin") void loadAdmin();
  }, [view, loadAdmin]);

  useEffect(() => {
    if (view === "analytics") void loadAnalytics();
  }, [view, loadAnalytics]);

  function toggleTheme() {
    setDarkMode((current) => {
      const next = !current;
      window.localStorage.setItem("tecloud_theme", next ? "dark" : "light");
      return next;
    });
  }

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
    setTrashFiles([]);
    setSharedFiles([]);
    setSelectedIds(new Set());
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
      setNotice({ tone: "bad", text: `${oversized.name}: ${telegramFileLimitMessage()}` });
      setDragging(false);
      return;
    }

    setBusy(true);
    setNotice({ tone: "good", text: `Mengunggah ${queue.length} file...` });
    setUploadProgress(0);
    const queueItems = queue.map((file) => ({
      id: window.crypto?.randomUUID?.() || `${file.name}-${file.size}-${file.lastModified}-${Date.now()}`,
      name: file.name,
      size: file.size,
      progress: 0,
      status: "queued" as const,
    }));
    setUploadQueue((current) => [...queueItems, ...current].slice(0, 12));

    try {
      for (let index = 0; index < queue.length; index += 1) {
        const file = queue[index];
        const queueItem = queueItems[index];
        const formData = new FormData();
        formData.set("file", file);
        formData.set("folderPath", currentFolder);
        setUploadQueue((current) => current.map((item) => (item.id === queueItem.id ? { ...item, status: "uploading", progress: 0 } : item)));
        await sendFormWithProgress("POST", "/api/files", formData, (progress) => {
          setUploadQueue((current) => current.map((item) => (item.id === queueItem.id ? { ...item, progress } : item)));
          setUploadProgress(Math.round(((index + progress / 100) / queue.length) * 100));
        });
        setUploadQueue((current) => current.map((item) => (item.id === queueItem.id ? { ...item, status: "done", progress: 100 } : item)));
      }
      setNotice({ tone: "good", text: "File berhasil disimpan ke Telegram." });
      await loadFiles();
      await loadActivity();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload gagal.";
      setUploadQueue((current) => current.map((item) => (item.status === "uploading" ? { ...item, status: "failed", error: message } : item)));
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
      await loadActivity();
    } catch (error) {
      setNotice({ tone: "bad", text: error instanceof Error ? error.message : "Rename gagal." });
    }
  }

  async function replaceFile(file: StoredFile, selected: FileList | null) {
    if (!selected?.[0]) return;
    if (isTelegramFileTooLarge(selected[0].size)) {
      setNotice({ tone: "bad", text: `${selected[0].name}: ${telegramFileLimitMessage()}` });
      return;
    }

    const formData = new FormData();
    formData.set("file", selected[0]);
    formData.set("name", file.name);
    formData.set("folderPath", file.folderPath || "/");
    setUploadProgress(0);
    try {
      const data = await sendFormWithProgress("PATCH", `/api/files/${file.id}`, formData, setUploadProgress);
      setFiles((current) => current.map((item) => (item.id === file.id ? data.file : item)));
      setNotice({ tone: "good", text: "Isi file berhasil diganti." });
      await loadActivity();
    } catch (error) {
      setNotice({ tone: "bad", text: error instanceof Error ? error.message : "Ganti file gagal." });
    } finally {
      setUploadProgress(null);
    }
  }

  async function deleteFile(file: StoredFile) {
    if (!window.confirm(`Pindahkan ${file.name} ke Trash?`)) return;
    try {
      const data = await jsonRequest(`/api/files/${file.id}`, { method: "DELETE" });
      setFiles((current) => current.filter((item) => item.id !== file.id));
      setTrashFiles((current) => [data.file, ...current.filter((item) => item.id !== file.id)]);
      setSelectedIds((current) => {
        const next = new Set(current);
        next.delete(file.id);
        return next;
      });
      setNotice({ tone: "good", text: "File dipindahkan ke Trash." });
      await loadActivity();
    } catch (error) {
      setNotice({ tone: "bad", text: error instanceof Error ? error.message : "Hapus file gagal." });
    }
  }

  async function updateShare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!shareFile) return;
    const form = new FormData(event.currentTarget);
    const mode = String(form.get("mode"));
    const expiresAtValue = String(form.get("expiresAt") || "").trim();
    const downloadLimitValue = String(form.get("downloadLimit") || "").trim();
    try {
      const data = await jsonRequest(`/api/files/${shareFile.id}/share`, {
        method: "PATCH",
        body: JSON.stringify({
          mode,
          password: sharePassword,
          expiresAt: expiresAtValue ? new Date(expiresAtValue).toISOString() : null,
          downloadLimit: downloadLimitValue ? Number(downloadLimitValue) : null,
        }),
      });
      setShareUrl(data.shareUrl || "");
      setFiles((current) => current.map((item) => (item.id === shareFile.id ? data.file : item)));
      setSharedFiles((current) => {
        const rest = current.filter((item) => item.id !== shareFile.id);
        return data.file.shareMode === "private" ? rest : [data.file, ...rest];
      });
      setShareFile(data.file);
      setNotice({ tone: "good", text: mode === "private" ? "File dibuat privat." : "Link share siap." });
      await loadActivity();
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

  async function updateFileMetadata(file: StoredFile, patch: Partial<Pick<StoredFile, "folderPath" | "isFavorite" | "tags">>) {
    try {
      const data = await jsonRequest(`/api/files/${file.id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      setFiles((current) => current.map((item) => (item.id === file.id ? data.file : item)));
      setNotice({ tone: "good", text: patch.isFavorite !== undefined ? "Favorite diperbarui." : patch.tags ? "Tag file diperbarui." : "Folder file diperbarui." });
      await loadActivity();
    } catch (error) {
      setNotice({ tone: "bad", text: error instanceof Error ? error.message : "Metadata file gagal diperbarui." });
    }
  }

  async function restoreFileFromTrash(file: StoredFile) {
    try {
      const data = await jsonRequest(`/api/files/${file.id}/restore`, { method: "POST", body: "{}" });
      setTrashFiles((current) => current.filter((item) => item.id !== file.id));
      setFiles((current) => [data.file, ...current.filter((item) => item.id !== file.id)]);
      setNotice({ tone: "good", text: "File dipulihkan dari Trash." });
      await loadActivity();
    } catch (error) {
      setNotice({ tone: "bad", text: error instanceof Error ? error.message : "Restore file gagal." });
    }
  }

  async function purgeFile(file: StoredFile) {
    if (!window.confirm(`Hapus permanen ${file.name} dari Telegram?`)) return;
    try {
      await jsonRequest(`/api/files/${file.id}/purge`, { method: "DELETE" });
      setTrashFiles((current) => current.filter((item) => item.id !== file.id));
      setNotice({ tone: "good", text: "File dihapus permanen." });
      await loadActivity();
    } catch (error) {
      setNotice({ tone: "bad", text: error instanceof Error ? error.message : "Hapus permanen gagal." });
    }
  }

  function toggleSelectFile(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectVisibleFiles() {
    setSelectedIds((current) => {
      const next = new Set(current);
      const allSelected = filteredFiles.length > 0 && selectedVisibleCount === filteredFiles.length;
      for (const file of filteredFiles) {
        if (allSelected) next.delete(file.id);
        else next.add(file.id);
      }
      return next;
    });
  }

  async function runBulkAction(action: "trash" | "favorite" | "move" | "tags", payload: Record<string, unknown> = {}) {
    if (!selectedIds.size) return;
    try {
      await jsonRequest("/api/files/bulk", {
        method: "POST",
        body: JSON.stringify({ action, ids: Array.from(selectedIds), ...payload }),
      });
      setSelectedIds(new Set());
      setNotice({ tone: "good", text: "Aksi massal selesai." });
      await loadFiles();
      await loadActivity();
    } catch (error) {
      setNotice({ tone: "bad", text: error instanceof Error ? error.message : "Aksi massal gagal." });
    }
  }

  function createVirtualFolder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextFolder = normalizeClientFolderPath(folderDraft);
    setCurrentFolder(nextFolder);
    setFolderDraft(nextFolder);
    setNotice({ tone: "good", text: `Folder virtual ${nextFolder} siap dipakai untuk upload berikutnya.` });
  }

  const shellClass = cx(
    darkMode && "theme-dark",
    "min-h-screen bg-[var(--page)] text-[var(--text)] transition-colors duration-300",
  );

  if (loading && !user) {
    return (
      <main className={shellClass}>
        <div className="grid min-h-screen place-items-center px-6">
          <motion.div {...fadeUp} className="flex items-center gap-3 text-[var(--muted)]">
            <LogoMark />
            <span className="text-sm font-semibold">Memuat TeCloud...</span>
          </motion.div>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className={shellClass}>
        <AuthExperience
          authMode={authMode}
          busy={busy}
          darkMode={darkMode}
          notice={notice}
          pendingVerification={pendingVerification}
          setAuthMode={setAuthMode}
          submitAuth={submitAuth}
          toggleTheme={toggleTheme}
          verifyUsername={verifyUsername}
          copyVerifyCommand={copyVerifyCommand}
        />
      </main>
    );
  }

  return (
    <main className={shellClass}>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <header className="sticky top-3 z-20 rounded-lg border border-[var(--line)] bg-[var(--glass)] shadow-[var(--shadow)] backdrop-blur-xl">
          <div className="flex flex-col gap-4 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
            <BrandBlock eyebrow="Private Cloud Workspace" title="TeCloud" />
            <nav aria-label="Navigasi utama" className="flex flex-wrap items-center gap-2">
              <StatusBadge tone={configured ? "good" : "warn"}>{configured ? "Telegram siap" : "Perlu konfigurasi"}</StatusBadge>
              <Button onClick={() => setView("files")} variant={view === "files" ? "primary" : "secondary"} type="button"><FolderOpen size={17} /> Files</Button>
              <Button onClick={() => setView("shares")} variant={view === "shares" ? "primary" : "secondary"} type="button"><Share2 size={17} /> Shared</Button>
              <Button onClick={() => setView("trash")} variant={view === "trash" ? "primary" : "secondary"} type="button"><Trash2 size={17} /> Trash</Button>
              <Button onClick={() => setView("analytics")} variant={view === "analytics" ? "primary" : "secondary"} type="button"><BarChart3 size={17} /> Analytics</Button>
              {user.role === "admin" && (
                <Button onClick={() => setView("admin")} variant={view === "admin" ? "primary" : "secondary"} type="button">
                  <Gauge size={17} /> Admin
                </Button>
              )}
              <IconButton ariaLabel="Ganti tema" onClick={toggleTheme}>
                {darkMode ? <Sun size={18} /> : <Moon size={18} />}
              </IconButton>
              <Button onClick={logout} variant="ghost" type="button">
                <LogOut size={17} />
                Keluar
              </Button>
              <IconButton ariaLabel="Muat ulang file" disabled={loading} onClick={loadFiles}>
                <RefreshCw className={loading ? "animate-spin" : ""} size={18} />
              </IconButton>
            </nav>
          </div>
        </header>

        <AnimatePresence mode="popLayout">
          {notice && <AlertNotice key={notice.text} notice={notice} />}
        </AnimatePresence>

        {uploadProgress !== null && <ProgressBar value={uploadProgress} />}

        {view === "admin" ? (
          <AdminPanel adminSummary={adminSummary} adminUsers={adminUsers} updateAdminUser={updateAdminUser} />
        ) : view === "trash" ? (
          <TrashPanel files={trashFiles} purgeFile={purgeFile} restoreFile={restoreFileFromTrash} />
        ) : view === "shares" ? (
          <SharesPanel files={sharedFiles} setShareFile={setShareFile} setShareUrl={setShareUrl} />
        ) : view === "analytics" ? (
          <AnalyticsPanel analytics={storageAnalytics} files={files} loadAnalytics={loadAnalytics} />
        ) : (
          <motion.section {...fadeUp} className="grid gap-4">
            <section className="grid gap-3 sm:grid-cols-3">
              <StatCard icon={<FolderOpen size={20} />} label="Total file" value={String(files.length)} />
              <StatCard icon={<HardDrive size={20} />} label="Terpakai" value={formatBytes(totalSize)} detail={`${quotaPercent}% dari kuota`} />
              <StatCard icon={<Database size={20} />} label="Kuota" value={formatBytes(user.quotaBytes)} detail={`@${user.username}`} />
            </section>

            <FolderTreePanel currentFolder={currentFolder} files={files} setCurrentFolder={setCurrentFolder} />

            <Panel className="p-3">
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-normal text-[var(--muted)]">Virtual folder</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Button disabled={currentFolder === "/"} onClick={() => setCurrentFolder(getParentFolder(currentFolder))} type="button" variant="ghost">
                      <FolderOpen size={17} /> Naik
                    </Button>
                    <button
                      className={cx(
                        "min-h-10 rounded-lg px-3 text-sm font-extrabold transition",
                        currentFolder === "/" ? "bg-[var(--text)] text-[var(--surface)]" : "border border-[var(--line)] bg-[var(--surface-strong)] text-[var(--muted)]",
                      )}
                      onClick={() => setCurrentFolder("/")}
                      type="button"
                    >
                      Root
                    </button>
                    {childFolders.map((folder) => (
                      <button
                        className="min-h-10 rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] px-3 text-sm font-extrabold text-[var(--text)] transition hover:border-[var(--brand)]"
                        key={folder.path}
                        onClick={() => setCurrentFolder(folder.path)}
                        type="button"
                      >
                        {folder.name} <span className="text-[var(--muted)]">({folder.count})</span>
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 truncate text-sm font-semibold text-[var(--muted)]">Lokasi aktif: {currentFolder}</p>
                </div>
                <form className="grid gap-2 sm:grid-cols-[220px_auto]" onSubmit={createVirtualFolder}>
                  <input className="field-input" onChange={(event) => setFolderDraft(event.target.value)} placeholder="/Project/Invoice" value={folderDraft} />
                  <Button type="submit" variant="secondary"><FolderPlus size={17} /> Buat/Pilih</Button>
                </form>
              </div>
            </Panel>

            <UploadDropzone
              dragging={dragging}
              onDrop={onDrop}
              onPick={onPick}
              setDragging={setDragging}
            />

            <UploadQueuePanel items={uploadQueue} clearDone={() => setUploadQueue((current) => current.filter((item) => item.status !== "done"))} />

            <Panel className="p-3">
              <div className="grid gap-3 lg:grid-cols-[minmax(240px,1fr)_auto] lg:items-center">
                <label className="flex min-h-11 items-center gap-3 rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] px-3 text-[var(--muted)] focus-within:border-[var(--brand)] focus-within:ring-4 focus-within:ring-[var(--focus)]">
                  <Search size={18} />
                  <span className="sr-only">Cari file</span>
                  <input
                    className="w-full bg-transparent text-sm font-medium text-[var(--text)] outline-none placeholder:text-[var(--muted)]"
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Cari nama file, dokumen, atau arsip"
                    value={query}
                  />
                </label>
                <div className="flex gap-1 overflow-x-auto rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] p-1" role="tablist" aria-label="Filter tipe file">
                  {fileTypes.map((type) => (
                    <button
                      aria-selected={filter === type}
                      className={cx(
                        "min-h-9 whitespace-nowrap rounded-[7px] px-3 text-sm font-semibold transition",
                        filter === type ? "bg-[var(--text)] text-[var(--surface)] shadow-sm" : "text-[var(--muted)] hover:text-[var(--text)]",
                      )}
                      key={type}
                      onClick={() => setFilter(type)}
                      role="tab"
                      type="button"
                    >
                      {type}
                    </button>
                  ))}
                </div>
                <div className="grid gap-2 sm:grid-cols-[auto_1fr_auto] sm:items-center">
                  <Button onClick={() => setShowFavoritesOnly((value) => !value)} type="button" variant={showFavoritesOnly ? "primary" : "secondary"}>
                    <Star size={17} /> Favorite
                  </Button>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="sr-only" htmlFor="sort-key">Urutkan file</label>
                    <select id="sort-key" className="field-input" onChange={(event) => setSortKey(event.target.value as SortKey)} value={sortKey}>
                      <option value="updatedAt">Tanggal update</option>
                      <option value="name">Nama</option>
                      <option value="size">Ukuran</option>
                      <option value="type">Tipe</option>
                      <option value="downloads">Download</option>
                    </select>
                    <label className="sr-only" htmlFor="sort-direction">Arah urutan</label>
                    <select id="sort-direction" className="field-input" onChange={(event) => setSortDirection(event.target.value as SortDirection)} value={sortDirection}>
                      <option value="desc">Desc</option>
                      <option value="asc">Asc</option>
                    </select>
                  </div>
                  <StatusBadge tone="neutral">{filteredFiles.length} item</StatusBadge>
                </div>
              </div>
            </Panel>

            <BulkToolbar
              bulkFolderDraft={bulkFolderDraft}
              bulkTagsDraft={bulkTagsDraft}
              clearSelection={() => setSelectedIds(new Set())}
              runBulkAction={runBulkAction}
              selectedCount={selectedCount}
              setBulkFolderDraft={setBulkFolderDraft}
              setBulkTagsDraft={setBulkTagsDraft}
            />

            <FileTable
              busy={busy}
              deleteFile={deleteFile}
              editingId={editingId}
              files={filteredFiles}
              loading={loading}
              replaceFile={replaceFile}
              saveRename={saveRename}
              setDraftName={setDraftName}
              setEditingId={setEditingId}
              setShareFile={setShareFile}
              setShareUrl={setShareUrl}
              setPreviewFile={setPreviewFile}
              setDetailsFile={setDetailsFile}
              selectedIds={selectedIds}
              selectedVisibleCount={selectedVisibleCount}
              toggleSelectFile={toggleSelectFile}
              toggleSelectVisibleFiles={toggleSelectVisibleFiles}
              updateFileMetadata={updateFileMetadata}
              draftName={draftName}
            />

            <ActivityPanel events={activityEvents} />
          </motion.section>
        )}
      </div>

      <AnimatePresence>
        {shareFile && (
          <ShareModal
            file={shareFile}
            setNotice={setNotice}
            sharePassword={sharePassword}
            shareUrl={shareUrl}
            setShareFile={setShareFile}
            setSharePassword={setSharePassword}
            updateShare={updateShare}
          />
        )}
        {previewFile && (
          <PreviewModal file={previewFile} setPreviewFile={setPreviewFile} />
        )}
        {detailsFile && (
          <PropertiesModal file={detailsFile} setDetailsFile={setDetailsFile} updateFileMetadata={updateFileMetadata} />
        )}
      </AnimatePresence>
    </main>
  );
}

function AuthExperience({
  authMode,
  busy,
  copyVerifyCommand,
  darkMode,
  notice,
  pendingVerification,
  setAuthMode,
  submitAuth,
  toggleTheme,
  verifyUsername,
}: {
  authMode: AuthMode;
  busy: boolean;
  copyVerifyCommand: () => void;
  darkMode: boolean;
  notice: Notice | null;
  pendingVerification: PendingVerification | null;
  setAuthMode: (mode: AuthMode) => void;
  submitAuth: (event: FormEvent<HTMLFormElement>) => void;
  toggleTheme: () => void;
  verifyUsername: string;
}) {
  return (
    <div className="mx-auto grid min-h-screen w-full max-w-6xl gap-4 px-4 py-4 sm:px-6 lg:grid-cols-[0.92fr_1fr] lg:px-8">
      <motion.section {...fadeUp} className="relative flex min-h-[420px] flex-col justify-between overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--glass)] p-6 shadow-[var(--shadow)] backdrop-blur-xl">
        <div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,#1769e0,#0f9f8f,#d946ef)]" />
        <div className="flex items-start justify-between gap-3">
          <BrandBlock eyebrow="Telegram Cloud Drive" title="TeCloud" />
          <IconButton ariaLabel="Ganti tema" onClick={toggleTheme}>
            {darkMode ? <Sun size={18} /> : <Moon size={18} />}
          </IconButton>
        </div>
        <div className="max-w-xl py-10">
          <p className="mb-4 inline-flex items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] px-3 py-2 text-xs font-bold uppercase tracking-normal text-[var(--muted)]">
            <Sparkles size={15} /> Premium secure file hub
          </p>
          <h1 className="text-4xl font-black leading-[1.02] tracking-normal text-[var(--text)] sm:text-5xl">
            Simpan, kelola, dan bagikan file lewat Telegram API.
          </h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-[var(--muted)]">
            Workspace pribadi dengan verifikasi bot, link publik berpassword, dashboard admin, dan kuota akun dalam satu pengalaman yang ringan.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <FeaturePill icon={<ShieldCheck size={17} />} text="Akses aman" />
          <FeaturePill icon={<Link2 size={17} />} text="Share fleksibel" />
          <FeaturePill icon={<Send size={17} />} text="Verifikasi bot" />
        </div>
      </motion.section>

      <motion.section {...fadeUp} transition={{ delay: 0.08 }} className="self-center rounded-lg border border-[var(--line)] bg-[var(--glass)] p-4 shadow-[var(--shadow)] backdrop-blur-xl sm:p-5">
        <div className="mb-4 grid grid-cols-2 gap-1 rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] p-1 sm:grid-cols-5">
          {authModes.map((mode) => (
            <button
              className={cx(
                "min-h-10 rounded-[7px] px-2 text-sm font-bold transition",
                authMode === mode ? "bg-[var(--text)] text-[var(--surface)] shadow-sm" : "text-[var(--muted)] hover:text-[var(--text)]",
              )}
              key={mode}
              onClick={() => setAuthMode(mode)}
              type="button"
            >
              {mode === "signin" ? "Masuk" : mode === "signup" ? "Daftar" : mode === "verify" ? "Verifikasi" : mode === "forgot" ? "Lupa" : "Reset"}
            </button>
          ))}
        </div>
        <AnimatePresence mode="popLayout">
          {notice && <AlertNotice key={notice.text} notice={notice} />}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {authMode === "verify" ? (
            <motion.form key="verify" {...fadeUp} className="mt-4 grid gap-4" onSubmit={submitAuth}>
              <SectionHeading
                kicker="Telegram verification"
                title="Aktifkan akun via bot"
                text="Kirim command unik ke bot TeCloud. Setelah itu, aplikasi akan menghubungkan akunmu dengan Telegram user ID secara otomatis."
              />
              <FormField label="Username">
                <input className="field-input" defaultValue={pendingVerification?.username || verifyUsername} name="username" placeholder="username" />
              </FormField>
              {pendingVerification ? (
                <div className="grid grid-cols-[minmax(0,1fr)_44px] gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] p-2">
                  <code className="min-w-0 overflow-hidden px-2 py-3 text-sm font-black text-[var(--text)] text-ellipsis whitespace-nowrap">{pendingVerification.verifyCommand}</code>
                  <IconButton ariaLabel="Salin command" onClick={copyVerifyCommand}>
                    <Copy size={18} />
                  </IconButton>
                </div>
              ) : (
                <FormField label="Command verifikasi">
                  <input className="field-input" name="verifyCommand" placeholder="/verify xxxxxxxxx" />
                </FormField>
              )}
              <div className="grid gap-2 sm:grid-cols-2">
                {pendingVerification?.botUrl && (
                  <a className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#e8f7ff] px-4 text-sm font-extrabold text-[#09649a] transition hover:brightness-95" href={pendingVerification.botUrl} rel="noreferrer" target="_blank">
                    <Send size={17} /> Buka bot Telegram
                  </a>
                )}
                <Button disabled={busy} type="submit" variant="primary">
                  <Check size={17} /> Saya sudah kirim
                </Button>
              </div>
            </motion.form>
          ) : (
            <motion.form key={authMode} {...fadeUp} className="mt-4 grid gap-4" onSubmit={submitAuth}>
              <SectionHeading
                kicker={authMode === "signin" ? "Welcome back" : authMode === "signup" ? "Create workspace" : authMode === "forgot" ? "Account recovery" : "Secure reset"}
                title={authMode === "signin" ? "Masuk ke TeCloud" : authMode === "signup" ? "Buat akun baru" : authMode === "forgot" ? "Pulihkan akses" : "Reset password"}
                text={authMode === "signup" ? "Tidak perlu mengisi Telegram Chat ID. Verifikasi dilakukan lewat command bot setelah akun dibuat." : "Gunakan username akun untuk melanjutkan."}
              />
              {(authMode === "signin" || authMode === "signup" || authMode === "forgot" || authMode === "reset") && (
                <FormField label="Username">
                  <input className="field-input" defaultValue={verifyUsername} name="username" placeholder="username" />
                </FormField>
              )}
              {(authMode === "signin" || authMode === "signup" || authMode === "reset") && (
                <FormField label="Password">
                  <input className="field-input" name="password" placeholder="Minimal 8 karakter" type="password" />
                </FormField>
              )}
              {authMode === "reset" && (
                <FormField label="Kode Telegram">
                  <input className="field-input" name="code" placeholder="6 digit" />
                </FormField>
              )}
              <Button disabled={busy} type="submit" variant="primary">
                {authMode === "signin" ? <Lock size={17} /> : authMode === "signup" ? <Sparkles size={17} /> : <KeyRound size={17} />}
                {authMode === "signin" ? "Masuk" : authMode === "signup" ? "Buat akun" : authMode === "forgot" ? "Kirim kode reset" : "Reset password"}
              </Button>
            </motion.form>
          )}
        </AnimatePresence>
      </motion.section>
    </div>
  );
}

function FileTable({
  busy,
  deleteFile,
  draftName,
  editingId,
  files,
  loading,
  replaceFile,
  saveRename,
  setDraftName,
  setDetailsFile,
  setEditingId,
  setPreviewFile,
  selectedIds,
  selectedVisibleCount,
  setShareFile,
  setShareUrl,
  toggleSelectFile,
  toggleSelectVisibleFiles,
  updateFileMetadata,
}: {
  busy: boolean;
  deleteFile: (file: StoredFile) => void;
  draftName: string;
  editingId: string | null;
  files: StoredFile[];
  loading: boolean;
  replaceFile: (file: StoredFile, selected: FileList | null) => void;
  saveRename: (event: FormEvent<HTMLFormElement>, file: StoredFile) => void;
  setDraftName: (value: string) => void;
  setDetailsFile: (value: StoredFile | null) => void;
  setEditingId: (value: string | null) => void;
  setPreviewFile: (value: StoredFile | null) => void;
  selectedIds: Set<string>;
  selectedVisibleCount: number;
  setShareFile: (value: StoredFile | null) => void;
  setShareUrl: (value: string) => void;
  toggleSelectFile: (id: string) => void;
  toggleSelectVisibleFiles: () => void;
  updateFileMetadata: (file: StoredFile, patch: Partial<Pick<StoredFile, "folderPath" | "isFavorite" | "tags">>) => void;
}) {
  const allVisibleSelected = files.length > 0 && selectedVisibleCount === files.length;
  return (
    <Panel className="overflow-hidden">
      <div className="hidden grid-cols-[44px_minmax(260px,1.5fr)_120px_120px_140px_220px] gap-4 border-b border-[var(--line)] bg-[var(--surface-strong)] px-4 py-3 text-xs font-black uppercase tracking-normal text-[var(--muted)] lg:grid">
        <button aria-label="Pilih semua file terlihat" className="text-[var(--muted)] transition hover:text-[var(--brand)]" onClick={toggleSelectVisibleFiles} type="button">
          {allVisibleSelected ? <CheckSquare size={18} /> : <Square size={18} />}
        </button>
        <span>Nama</span>
        <span>Tipe</span>
        <span>Ukuran</span>
        <span>Share</span>
        <span className="text-right">Aksi</span>
      </div>
      <div aria-busy={loading || busy} className="divide-y divide-[var(--line)]">
        {loading ? (
          <EmptyState icon={<RefreshCw className="animate-spin" size={24} />} text="Memuat file..." />
        ) : files.length ? (
          files.map((file, index) => (
            <FileRow
              deleteFile={deleteFile}
              draftName={draftName}
              editingId={editingId}
              file={file}
              index={index}
              key={file.id}
              replaceFile={replaceFile}
              saveRename={saveRename}
              setDraftName={setDraftName}
              setDetailsFile={setDetailsFile}
              setEditingId={setEditingId}
              setPreviewFile={setPreviewFile}
              setShareFile={setShareFile}
              setShareUrl={setShareUrl}
              selected={selectedIds.has(file.id)}
              toggleSelectFile={toggleSelectFile}
              updateFileMetadata={updateFileMetadata}
            />
          ))
        ) : (
          <EmptyState icon={<FolderOpen size={24} />} text="Belum ada file yang cocok." />
        )}
      </div>
    </Panel>
  );
}

function FileRow({
  deleteFile,
  draftName,
  editingId,
  file,
  index,
  replaceFile,
  saveRename,
  setDraftName,
  setDetailsFile,
  setEditingId,
  setPreviewFile,
  setShareFile,
  setShareUrl,
  selected,
  toggleSelectFile,
  updateFileMetadata,
}: {
  deleteFile: (file: StoredFile) => void;
  draftName: string;
  editingId: string | null;
  file: StoredFile;
  index: number;
  replaceFile: (file: StoredFile, selected: FileList | null) => void;
  saveRename: (event: FormEvent<HTMLFormElement>, file: StoredFile) => void;
  setDraftName: (value: string) => void;
  setDetailsFile: (value: StoredFile | null) => void;
  setEditingId: (value: string | null) => void;
  setPreviewFile: (value: StoredFile | null) => void;
  setShareFile: (value: StoredFile | null) => void;
  setShareUrl: (value: string) => void;
  selected: boolean;
  toggleSelectFile: (id: string) => void;
  updateFileMetadata: (file: StoredFile, patch: Partial<Pick<StoredFile, "folderPath" | "isFavorite" | "tags">>) => void;
}) {
  const FileIcon = getFileIcon(file);
  return (
    <motion.article
      animate={{ opacity: 1, y: 0 }}
      className={cx(
        "grid gap-3 px-4 py-4 lg:grid-cols-[44px_minmax(260px,1.5fr)_120px_120px_140px_220px] lg:items-center",
        selected && "bg-[var(--brand-soft)]",
      )}
      initial={{ opacity: 0, y: 10 }}
      transition={{ delay: Math.min(index * 0.025, 0.2) }}
    >
      <button aria-label={selected ? "Batalkan pilihan file" : "Pilih file"} className="hidden text-[var(--muted)] transition hover:text-[var(--brand)] lg:block" onClick={() => toggleSelectFile(file.id)} type="button">
        {selected ? <CheckSquare size={19} /> : <Square size={19} />}
      </button>
      <div className="flex min-w-0 items-center gap-3">
        <button aria-label={selected ? "Batalkan pilihan file" : "Pilih file"} className="text-[var(--muted)] transition hover:text-[var(--brand)] lg:hidden" onClick={() => toggleSelectFile(file.id)} type="button">
          {selected ? <CheckSquare size={19} /> : <Square size={19} />}
        </button>
        <span className="grid h-10 w-10 flex-none place-items-center rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] text-[var(--brand)]">
          <FileIcon size={19} />
        </span>
        {editingId === file.id ? (
          <form className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_40px_40px] gap-2" onSubmit={(event) => saveRename(event, file)}>
            <input autoFocus className="field-input min-h-10" onChange={(event) => setDraftName(event.target.value)} value={draftName} />
            <IconButton ariaLabel="Simpan nama" type="submit"><Check size={18} /></IconButton>
            <IconButton ariaLabel="Batal" onClick={() => setEditingId(null)} type="button"><X size={18} /></IconButton>
          </form>
        ) : (
          <div className="min-w-0">
            <strong className="block truncate text-sm font-black text-[var(--text)]">{file.name}</strong>
            <small className="mt-1 block truncate text-xs font-medium text-[var(--muted)]">v{file.version} / {formatDate(file.updatedAt)} / {file.downloadCount} download</small>
            {!!file.tags?.length && (
              <span className="mt-2 flex flex-wrap gap-1">
                {file.tags.slice(0, 3).map((tag) => (
                  <span className="rounded-[7px] bg-[var(--surface-strong)] px-2 py-1 text-[11px] font-black text-[var(--muted)]" key={tag}>#{tag}</span>
                ))}
              </span>
            )}
          </div>
        )}
      </div>
      <span className="text-sm font-semibold text-[var(--muted)]">{getType(file)}</span>
      <span className="text-sm font-semibold text-[var(--muted)]">{formatBytes(file.size)}</span>
      <StatusBadge tone={file.shareMode === "public" ? "good" : file.shareMode === "password" ? "warn" : "neutral"}>{file.shareMode}</StatusBadge>
      <div className="flex flex-wrap gap-2 lg:justify-end">
        <IconButton ariaLabel={file.isFavorite ? "Hapus dari favorite" : "Tambah ke favorite"} onClick={() => updateFileMetadata(file, { isFavorite: !file.isFavorite })}>
          <Star className={file.isFavorite ? "fill-current text-[var(--warn)]" : ""} size={18} />
        </IconButton>
        <IconButton ariaLabel="Preview file" onClick={() => setPreviewFile(file)}><Eye size={18} /></IconButton>
        <a className="icon-action" href={`/api/files/${file.id}/download`} title="Unduh"><Download size={18} /></a>
        <IconButton ariaLabel="Ubah nama" onClick={() => { setEditingId(file.id); setDraftName(file.name); }}><Edit3 size={18} /></IconButton>
        <IconButton ariaLabel="Properti file" onClick={() => setDetailsFile(file)}><FileText size={18} /></IconButton>
        <IconButton ariaLabel="Bagikan" onClick={() => { setShareFile(file); setShareUrl(file.shareToken ? `${window.location.origin}/share/${file.shareToken}` : ""); }}><Link2 size={18} /></IconButton>
        <label className="icon-action cursor-pointer" title="Ganti file">
          <Replace size={18} />
          <input className="hidden" onChange={(event) => { replaceFile(file, event.target.files); event.target.value = ""; }} type="file" />
        </label>
        <IconButton ariaLabel="Hapus file" danger onClick={() => deleteFile(file)}><Trash2 size={18} /></IconButton>
      </div>
    </motion.article>
  );
}

function UploadDropzone({
  dragging,
  onDrop,
  onPick,
  setDragging,
}: {
  dragging: boolean;
  onDrop: (event: DragEvent<HTMLLabelElement>) => void;
  onPick: (event: ChangeEvent<HTMLInputElement>) => void;
  setDragging: (value: boolean) => void;
}) {
  return (
    <motion.label
      animate={{ scale: dragging ? 1.01 : 1 }}
      className={cx(
        "group grid min-h-52 cursor-pointer place-items-center rounded-lg border border-dashed p-6 text-center shadow-[var(--shadow)] backdrop-blur-xl transition",
        dragging ? "border-[var(--brand)] bg-[var(--surface-strong)]" : "border-[var(--line)] bg-[var(--glass)] hover:border-[var(--brand)]",
      )}
      onDragEnter={() => setDragging(true)}
      onDragLeave={() => setDragging(false)}
      onDragOver={(event) => event.preventDefault()}
      onDrop={onDrop}
    >
      <input className="hidden" multiple onChange={onPick} type="file" />
      <span className="mb-4 grid h-14 w-14 place-items-center rounded-lg bg-[var(--brand-soft)] text-[var(--brand)] transition group-hover:scale-105">
        <UploadCloud size={26} />
      </span>
      <span className="text-lg font-black text-[var(--text)]">Pilih atau tarik file ke sini</span>
      <span className="mt-2 max-w-xl text-sm leading-6 text-[var(--muted)]">
        Maksimal di bawah {maxTelegramFileLabel} per file. File dikirim ke Telegram dan akses tetap dikontrol oleh akun TeCloud.
      </span>
    </motion.label>
  );
}

function FolderTreePanel({
  currentFolder,
  files,
  setCurrentFolder,
}: {
  currentFolder: string;
  files: StoredFile[];
  setCurrentFolder: (path: string) => void;
}) {
  const folders = useMemo(() => {
    const map = new Map<string, number>();
    for (const file of files) {
      const folder = normalizeClientFolderPath(file.folderPath || "/");
      map.set(folder, (map.get(folder) || 0) + 1);
      const segments = folder.split("/").filter(Boolean);
      for (let index = 0; index < segments.length; index += 1) {
        const path = `/${segments.slice(0, index + 1).join("/")}`;
        map.set(path, map.get(path) || 0);
      }
    }
    return Array.from(map.entries())
      .map(([path, count]) => ({ path, count, depth: Math.max(0, path.split("/").filter(Boolean).length - 1) }))
      .sort((a, b) => a.path.localeCompare(b.path));
  }, [files]);

  return (
    <Panel className="p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <SectionHeading kicker="Folder tree" title="Struktur folder" text="Folder virtual untuk mengatur file tanpa membuat folder fisik di Telegram." />
        <span className="grid h-11 w-11 place-items-center rounded-lg bg-[var(--brand-soft)] text-[var(--brand)]"><FolderTree size={20} /></span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button
          className={cx("min-h-10 whitespace-nowrap rounded-lg px-3 text-sm font-extrabold transition", currentFolder === "/" ? "bg-[var(--text)] text-[var(--surface)]" : "border border-[var(--line)] bg-[var(--surface-strong)] text-[var(--muted)]")}
          onClick={() => setCurrentFolder("/")}
          type="button"
        >
          Root
        </button>
        {folders.filter((folder) => folder.path !== "/").map((folder) => (
          <button
            className={cx(
              "min-h-10 whitespace-nowrap rounded-lg border px-3 text-sm font-extrabold transition",
              currentFolder === folder.path ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand)]" : "border-[var(--line)] bg-[var(--surface-strong)] text-[var(--text)] hover:border-[var(--brand)]",
            )}
            key={folder.path}
            onClick={() => setCurrentFolder(folder.path)}
            style={{ marginLeft: `${Math.min(folder.depth, 3) * 4}px` }}
            type="button"
          >
            {getFolderName(folder.path)} <span className="text-[var(--muted)]">({folder.count})</span>
          </button>
        ))}
      </div>
    </Panel>
  );
}

function UploadQueuePanel({ clearDone, items }: { clearDone: () => void; items: UploadQueueItem[] }) {
  if (!items.length) return null;

  return (
    <Panel className="p-4">
      <div className="flex items-center justify-between gap-3">
        <SectionHeading kicker="Upload queue" title="Antrian upload" text="Pantau proses upload per file, termasuk item yang gagal." />
        <Button onClick={clearDone} type="button" variant="ghost">Bersihkan selesai</Button>
      </div>
      <div className="mt-4 grid gap-2">
        {items.map((item) => (
          <article className="grid gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] p-3 sm:grid-cols-[minmax(0,1fr)_140px] sm:items-center" key={item.id}>
            <div className="min-w-0">
              <strong className="block truncate text-sm font-black text-[var(--text)]">{item.name}</strong>
              <span className="mt-1 block text-xs font-semibold text-[var(--muted)]">{formatBytes(item.size)} / {item.error || item.status}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[var(--line)]">
              <span className={cx("block h-full rounded-full", item.status === "failed" ? "bg-[var(--bad)]" : "bg-[var(--brand)]")} style={{ width: `${item.progress}%` }} />
            </div>
          </article>
        ))}
      </div>
    </Panel>
  );
}

function BulkToolbar({
  bulkFolderDraft,
  bulkTagsDraft,
  clearSelection,
  runBulkAction,
  selectedCount,
  setBulkFolderDraft,
  setBulkTagsDraft,
}: {
  bulkFolderDraft: string;
  bulkTagsDraft: string;
  clearSelection: () => void;
  runBulkAction: (action: "trash" | "favorite" | "move" | "tags", payload?: Record<string, unknown>) => void;
  selectedCount: number;
  setBulkFolderDraft: (value: string) => void;
  setBulkTagsDraft: (value: string) => void;
}) {
  if (!selectedCount) return null;

  return (
    <Panel className="p-3">
      <div className="grid gap-3 xl:grid-cols-[auto_minmax(180px,1fr)_minmax(180px,1fr)_auto] xl:items-center">
        <StatusBadge tone="good">{selectedCount} dipilih</StatusBadge>
        <input className="field-input" onChange={(event) => setBulkFolderDraft(event.target.value)} placeholder="/Project/Invoice" value={bulkFolderDraft} />
        <input className="field-input" onChange={(event) => setBulkTagsDraft(event.target.value)} placeholder="tag: invoice, penting" value={bulkTagsDraft} />
        <div className="flex flex-wrap gap-2 xl:justify-end">
          <Button onClick={() => runBulkAction("favorite", { isFavorite: true })} type="button" variant="secondary"><Star size={17} /> Favorite</Button>
          <Button onClick={() => runBulkAction("move", { folderPath: bulkFolderDraft })} type="button" variant="secondary"><FolderOpen size={17} /> Pindah</Button>
          <Button onClick={() => runBulkAction("tags", { tags: bulkTagsDraft.split(",").map((tag) => tag.trim()).filter(Boolean) })} type="button" variant="secondary"><Tags size={17} /> Tag</Button>
          <Button onClick={() => runBulkAction("trash")} type="button" variant="secondary"><Trash2 size={17} /> Trash</Button>
          <Button onClick={clearSelection} type="button" variant="ghost">Batal</Button>
        </div>
      </div>
    </Panel>
  );
}

function AdminPanel({
  adminSummary,
  adminUsers,
  updateAdminUser,
}: {
  adminSummary: AdminSummary | null;
  adminUsers: AdminUser[];
  updateAdminUser: (target: AdminUser, patch: Partial<{ quotaMb: number; role: string; status: string }>) => void;
}) {
  return (
    <motion.section {...fadeUp} className="grid gap-4">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<Users size={20} />} label="User" value={String(adminSummary?.totalUsers ?? 0)} />
        <StatCard icon={<FolderOpen size={20} />} label="File" value={String(adminSummary?.totalFiles ?? 0)} />
        <StatCard icon={<HardDrive size={20} />} label="Storage" value={formatBytes(adminSummary?.totalStorage ?? 0)} />
        <StatCard icon={<ArrowDownToLine size={20} />} label="Download" value={String(adminSummary?.totalDownloads ?? 0)} />
      </section>
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <Panel className="p-4">
          <SectionHeading kicker="Admin console" title="Manajemen akun" text="Atur status, role, dan kuota pengguna dari satu dashboard." />
          <div className="mt-4 grid gap-3">
            {adminUsers.map((account) => (
              <article className="grid gap-3 rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] p-3 lg:grid-cols-[minmax(220px,1fr)_130px_110px_110px] lg:items-center" key={account.id}>
                <div className="min-w-0">
                  <strong className="block truncate text-sm font-black text-[var(--text)]">{account.name}</strong>
                  <small className="mt-1 block truncate text-xs font-medium text-[var(--muted)]">@{account.username} / {account.telegramChatId || "belum terhubung"} / {formatBytes(account.usedBytes)} dari {formatBytes(account.quotaBytes)}</small>
                </div>
                <select className="field-input" defaultValue={account.status} onChange={(event) => updateAdminUser(account, { status: event.target.value })}>
                  <option value="pending">pending</option>
                  <option value="active">active</option>
                  <option value="suspended">suspended</option>
                </select>
                <select className="field-input" defaultValue={account.role} onChange={(event) => updateAdminUser(account, { role: event.target.value })}>
                  <option value="user">user</option>
                  <option value="admin">admin</option>
                </select>
                <input className="field-input" defaultValue={Math.round(account.quotaBytes / 1024 / 1024)} min={1} onBlur={(event) => updateAdminUser(account, { quotaMb: Number(event.target.value) })} type="number" />
              </article>
            ))}
          </div>
        </Panel>
        <Panel className="p-4">
          <SectionHeading kicker="Analytics" title="Aktivitas terbaru" text="Ringkasan event sistem dan pemakaian storage." />
          <div className="mt-4 grid gap-2">
            {adminSummary?.recentEvents.length ? adminSummary.recentEvents.map((event) => (
              <article className="rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] p-3" key={`${event.type}-${event.createdAt}`}>
                <strong className="block text-sm font-black text-[var(--text)]">{event.type}</strong>
                <span className="mt-1 block text-xs font-medium text-[var(--muted)]">{formatBytes(event.bytes)} / {formatDate(event.createdAt)}</span>
              </article>
            )) : <EmptyState icon={<MoreHorizontal size={24} />} text="Belum ada aktivitas." />}
          </div>
        </Panel>
      </section>
    </motion.section>
  );
}

function ActivityPanel({ events }: { events: ActivityEvent[] }) {
  return (
    <Panel className="p-4">
      <div className="flex items-center justify-between gap-3">
        <SectionHeading kicker="Activity log" title="Aktivitas terbaru" text="Riwayat upload, preview, download, share, dan perubahan metadata akunmu." />
        <span className="grid h-11 w-11 place-items-center rounded-lg bg-[var(--brand-soft)] text-[var(--brand)]">
          <Activity size={20} />
        </span>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {events.length ? events.map((event) => (
          <article className="rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] p-3" key={event.id}>
            <strong className="block text-sm font-black text-[var(--text)]">{event.type}</strong>
            <span className="mt-1 block text-xs font-semibold text-[var(--muted)]">
              {formatBytes(event.bytes)} / {formatDate(event.createdAt)}
            </span>
          </article>
        )) : (
          <div className="sm:col-span-2 lg:col-span-3">
            <EmptyState icon={<Activity size={24} />} text="Belum ada aktivitas." />
          </div>
        )}
      </div>
    </Panel>
  );
}

function TrashPanel({
  files,
  purgeFile,
  restoreFile,
}: {
  files: StoredFile[];
  purgeFile: (file: StoredFile) => void;
  restoreFile: (file: StoredFile) => void;
}) {
  return (
    <motion.section {...fadeUp} className="grid gap-4">
      <section className="grid gap-3 sm:grid-cols-3">
        <StatCard icon={<Trash2 size={20} />} label="Trash" value={String(files.length)} />
        <StatCard icon={<Clock3 size={20} />} label="Auto purge" value="30 hari" detail="Sejak file dipindahkan ke Trash" />
        <StatCard icon={<HardDrive size={20} />} label="Ukuran trash" value={formatBytes(files.reduce((sum, file) => sum + file.size, 0))} />
      </section>
      <Panel className="p-4">
        <SectionHeading kicker="Trash" title="File terhapus sementara" text="Pulihkan file jika masih dibutuhkan, atau hapus permanen dari Telegram saat benar-benar yakin." />
        <div className="mt-4 grid gap-3">
          {files.length ? files.map((file) => (
            <article className="grid gap-3 rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] p-3 lg:grid-cols-[minmax(0,1fr)_160px_220px] lg:items-center" key={file.id}>
              <div className="min-w-0">
                <strong className="block truncate text-sm font-black text-[var(--text)]">{file.name}</strong>
                <small className="mt-1 block truncate text-xs font-semibold text-[var(--muted)]">
                  {formatBytes(file.size)} / {file.deletedAt ? `Dihapus ${formatDate(file.deletedAt)}` : "Di Trash"} / purge {file.deleteExpiresAt ? formatDate(file.deleteExpiresAt) : "-"}
                </small>
              </div>
              <StatusBadge tone="warn">Trash</StatusBadge>
              <div className="flex flex-wrap gap-2 lg:justify-end">
                <Button onClick={() => restoreFile(file)} type="button" variant="secondary"><RotateCcw size={17} /> Restore</Button>
                <Button onClick={() => purgeFile(file)} type="button" variant="secondary"><Trash2 size={17} /> Permanen</Button>
              </div>
            </article>
          )) : <EmptyState icon={<Trash2 size={24} />} text="Trash masih kosong." />}
        </div>
      </Panel>
    </motion.section>
  );
}

function SharesPanel({
  files,
  setShareFile,
  setShareUrl,
}: {
  files: StoredFile[];
  setShareFile: (file: StoredFile | null) => void;
  setShareUrl: (value: string) => void;
}) {
  return (
    <motion.section {...fadeUp} className="grid gap-4">
      <section className="grid gap-3 sm:grid-cols-3">
        <StatCard icon={<Share2 size={20} />} label="Link aktif" value={String(files.length)} />
        <StatCard icon={<Lock size={20} />} label="Password" value={String(files.filter((file) => file.shareMode === "password").length)} />
        <StatCard icon={<ArrowDownToLine size={20} />} label="Share download" value={String(files.reduce((sum, file) => sum + (file.shareDownloadCount || 0), 0))} />
      </section>
      <Panel className="p-4">
        <SectionHeading kicker="Share center" title="Link yang dibagikan" text="Pantau semua file public atau public dengan password, termasuk masa berlaku dan batas download." />
        <div className="mt-4 grid gap-3">
          {files.length ? files.map((file) => (
            <article className="grid gap-3 rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] p-3 lg:grid-cols-[minmax(0,1fr)_150px_180px_140px] lg:items-center" key={file.id}>
              <div className="min-w-0">
                <strong className="block truncate text-sm font-black text-[var(--text)]">{file.name}</strong>
                <small className="mt-1 block truncate text-xs font-semibold text-[var(--muted)]">
                  {file.shareToken ? `/share/${file.shareToken}` : "Token belum dibuat"} / {formatBytes(file.size)}
                </small>
              </div>
              <StatusBadge tone={file.shareMode === "password" ? "warn" : "good"}>{file.shareMode}</StatusBadge>
              <span className="text-sm font-semibold text-[var(--muted)]">
                {file.shareDownloadCount || 0}{file.shareDownloadLimit ? `/${file.shareDownloadLimit}` : ""} download
              </span>
              <Button onClick={() => { setShareFile(file); setShareUrl(file.shareToken ? `${window.location.origin}/share/${file.shareToken}` : ""); }} type="button" variant="secondary">
                <Link2 size={17} /> Kelola
              </Button>
              {(file.shareExpiresAt || file.shareDownloadLimit) && (
                <p className="text-xs font-semibold text-[var(--muted)] lg:col-span-4">
                  Expiry: {file.shareExpiresAt ? formatDate(file.shareExpiresAt) : "Tidak ada"} / Limit: {file.shareDownloadLimit || "Tidak ada"}
                </p>
              )}
            </article>
          )) : <EmptyState icon={<Share2 size={24} />} text="Belum ada link share aktif." />}
        </div>
      </Panel>
    </motion.section>
  );
}

function AnalyticsPanel({
  analytics,
  files,
  loadAnalytics,
}: {
  analytics: StorageAnalytics | null;
  files: StoredFile[];
  loadAnalytics: () => void;
}) {
  const byType = analytics?.byType || [];
  const byFolder = analytics?.byFolder || [];
  const largestFiles = analytics?.largestFiles || [];

  return (
    <motion.section {...fadeUp} className="grid gap-4">
      <section className="grid gap-3 sm:grid-cols-3">
        <StatCard icon={<BarChart3 size={20} />} label="File aktif" value={String(analytics?.totalFiles ?? files.length)} />
        <StatCard icon={<HardDrive size={20} />} label="Storage aktif" value={formatBytes(analytics?.totalBytes ?? files.reduce((sum, file) => sum + file.size, 0))} />
        <StatCard icon={<FolderTree size={20} />} label="Folder" value={String(byFolder.length)} />
      </section>
      <div className="grid gap-4 xl:grid-cols-3">
        <Panel className="p-4">
          <SectionHeading kicker="Type mix" title="Tipe file" text="Distribusi storage berdasarkan tipe MIME utama." />
          <MetricList items={byType.map((item) => ({ label: item.type, value: formatBytes(item.bytes), detail: `${item.count} file` }))} />
        </Panel>
        <Panel className="p-4">
          <SectionHeading kicker="Folders" title="Folder terbesar" text="Folder virtual dengan pemakaian storage paling besar." />
          <MetricList items={byFolder.map((item) => ({ label: item.folderPath, value: formatBytes(item.bytes), detail: `${item.count} file` }))} />
        </Panel>
        <Panel className="p-4">
          <div className="flex items-start justify-between gap-3">
            <SectionHeading kicker="Largest" title="File terbesar" text="Prioritas file yang paling berdampak pada kuota." />
            <IconButton ariaLabel="Refresh analytics" onClick={loadAnalytics}><RefreshCw size={18} /></IconButton>
          </div>
          <MetricList items={largestFiles.map((file) => ({ label: file.name, value: formatBytes(file.size), detail: file.folderPath }))} />
        </Panel>
      </div>
    </motion.section>
  );
}

function MetricList({ items }: { items: Array<{ label: string; value: string; detail: string }> }) {
  return (
    <div className="mt-4 grid gap-2">
      {items.length ? items.map((item) => (
        <article className="rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] p-3" key={`${item.label}-${item.value}`}>
          <div className="flex items-start justify-between gap-3">
            <strong className="min-w-0 truncate text-sm font-black text-[var(--text)]">{item.label}</strong>
            <span className="text-sm font-black text-[var(--brand)]">{item.value}</span>
          </div>
          <span className="mt-1 block text-xs font-semibold text-[var(--muted)]">{item.detail}</span>
        </article>
      )) : <EmptyState icon={<BarChart3 size={24} />} text="Analytics belum tersedia." />}
    </div>
  );
}

function canPreview(file: StoredFile) {
  return (
    file.mimeType.startsWith("image/") ||
    file.mimeType.startsWith("video/") ||
    file.mimeType.startsWith("text/") ||
    file.mimeType.includes("pdf") ||
    file.mimeType.includes("json")
  );
}

function PreviewModal({ file, setPreviewFile }: {
  file: StoredFile;
  setPreviewFile: (file: StoredFile | null) => void;
}) {
  const previewUrl = `/api/files/${file.id}/preview`;

  return (
    <motion.div animate={{ opacity: 1 }} className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-sm" exit={{ opacity: 0 }} initial={{ opacity: 0 }}>
      <motion.section animate={{ opacity: 1, scale: 1, y: 0 }} className="max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow)]" exit={{ opacity: 0, scale: 0.98, y: 10 }} initial={{ opacity: 0, scale: 0.98, y: 10 }}>
        <header className="flex items-center justify-between gap-3 border-b border-[var(--line)] p-4">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-normal text-[var(--muted)]">Preview</p>
            <h2 className="mt-1 truncate text-lg font-black text-[var(--text)]">{file.name}</h2>
          </div>
          <IconButton ariaLabel="Tutup preview" onClick={() => setPreviewFile(null)}><X size={18} /></IconButton>
        </header>
        <div className="grid min-h-[55vh] place-items-center bg-[var(--surface-strong)] p-4">
          {!canPreview(file) ? (
            <div className="max-w-md text-center">
              <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-lg bg-[var(--brand-soft)] text-[var(--brand)]"><FileArchive size={24} /></span>
              <p className="text-sm font-bold text-[var(--muted)]">Tipe file ini belum bisa dipreview. Gunakan tombol download untuk membuka file.</p>
            </div>
          ) : file.mimeType.startsWith("image/") ? (
            <img alt={file.name} className="max-h-[70vh] max-w-full rounded-lg object-contain" src={previewUrl} />
          ) : file.mimeType.startsWith("video/") ? (
            <video className="max-h-[70vh] w-full rounded-lg" controls src={previewUrl} />
          ) : (
            <iframe className="h-[70vh] w-full rounded-lg border border-[var(--line)] bg-white" src={previewUrl} title={`Preview ${file.name}`} />
          )}
        </div>
      </motion.section>
    </motion.div>
  );
}

function PropertiesModal({
  file,
  setDetailsFile,
  updateFileMetadata,
}: {
  file: StoredFile;
  setDetailsFile: (file: StoredFile | null) => void;
  updateFileMetadata: (file: StoredFile, patch: Partial<Pick<StoredFile, "folderPath" | "isFavorite" | "tags">>) => void;
}) {
  const [folderPath, setFolderPath] = useState(file.folderPath || "/");
  const [tagsValue, setTagsValue] = useState((file.tags || []).join(", "));

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    updateFileMetadata(file, {
      folderPath,
      isFavorite: file.isFavorite,
      tags: tagsValue.split(",").map((tag) => tag.trim()).filter(Boolean),
    });
    setDetailsFile(null);
  }

  return (
    <motion.div animate={{ opacity: 1 }} className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4 backdrop-blur-sm" exit={{ opacity: 0 }} initial={{ opacity: 0 }}>
      <motion.form animate={{ opacity: 1, scale: 1, y: 0 }} className="w-full max-w-xl rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow)]" exit={{ opacity: 0, scale: 0.98, y: 10 }} initial={{ opacity: 0, scale: 0.98, y: 10 }} onSubmit={submit}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-normal text-[var(--muted)]">Properties</p>
            <h2 className="mt-1 truncate text-lg font-black text-[var(--text)]">{file.name}</h2>
          </div>
          <IconButton ariaLabel="Tutup properti" onClick={() => setDetailsFile(null)}><X size={18} /></IconButton>
        </div>
        <div className="grid gap-3">
          <FormField label="Folder virtual">
            <input className="field-input" onChange={(event) => setFolderPath(event.target.value)} placeholder="/Project/Invoice" value={folderPath} />
          </FormField>
          <FormField label="Tag">
            <input className="field-input" onChange={(event) => setTagsValue(event.target.value)} placeholder="invoice, penting, client-a" value={tagsValue} />
          </FormField>
          <div className="grid gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] p-3 text-sm font-semibold text-[var(--muted)]">
            <span>Original: {file.originalName}</span>
            <span>Tipe: {file.mimeType}</span>
            <span>Ukuran: {formatBytes(file.size)}</span>
            <span>Update: {formatDate(file.updatedAt)}</span>
            <span>Download: {file.downloadCount}</span>
            <span>Share: {file.shareMode}</span>
            <span>Favorite: {file.isFavorite ? "Ya" : "Tidak"}</span>
            <span>Tag: {file.tags?.length ? file.tags.join(", ") : "-"}</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button onClick={() => updateFileMetadata(file, { isFavorite: !file.isFavorite })} type="button" variant="secondary">
              <Star size={17} /> {file.isFavorite ? "Hapus favorite" : "Jadikan favorite"}
            </Button>
            <Button type="submit" variant="primary"><FolderOpen size={17} /> Simpan properti</Button>
          </div>
        </div>
      </motion.form>
    </motion.div>
  );
}

function ShareModal({
  file,
  setNotice,
  setShareFile,
  setSharePassword,
  sharePassword,
  shareUrl,
  updateShare,
}: {
  file: StoredFile;
  setNotice: (value: Notice | null) => void;
  setShareFile: (value: StoredFile | null) => void;
  setSharePassword: (value: string) => void;
  sharePassword: string;
  shareUrl: string;
  updateShare: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [qrStatus, setQrStatus] = useState("");
  const initialExpiresAt = file.shareExpiresAt ? new Date(file.shareExpiresAt).toISOString().slice(0, 16) : "";

  useEffect(() => {
    let cancelled = false;
    setQrStatus("");

    if (!shareUrl) {
      setQrDataUrl("");
      return;
    }

    QRCode.toDataURL(shareUrl, {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 768,
      color: {
        dark: "#111827",
        light: "#ffffff",
      },
    })
      .then((dataUrl) => {
        if (!cancelled) setQrDataUrl(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setQrStatus("QR belum bisa dibuat. Coba simpan share ulang.");
      });

    return () => {
      cancelled = true;
    };
  }, [shareUrl]);

  async function copyShareLink() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setNotice({ tone: "good", text: "Link share disalin." });
    } catch {
      setQrStatus("Link belum bisa disalin otomatis. Salin manual dari field link.");
    }
  }

  function downloadQrCode() {
    if (!qrDataUrl) return;
    const anchor = document.createElement("a");
    const safeName = file.name.replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "") || "tecloud-share";
    anchor.href = qrDataUrl;
    anchor.download = `${safeName}-qr.png`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setNotice({ tone: "good", text: "QR code siap didownload." });
  }

  return (
    <motion.div animate={{ opacity: 1 }} className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4 backdrop-blur-sm" exit={{ opacity: 0 }} initial={{ opacity: 0 }}>
      <motion.form animate={{ opacity: 1, scale: 1, y: 0 }} className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow)]" exit={{ opacity: 0, scale: 0.98, y: 10 }} initial={{ opacity: 0, scale: 0.98, y: 10 }} onSubmit={updateShare}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-normal text-[var(--muted)]">Share settings</p>
            <h2 className="mt-1 text-lg font-black text-[var(--text)]">Bagikan file</h2>
          </div>
          <IconButton ariaLabel="Tutup modal" onClick={() => setShareFile(null)}><X size={18} /></IconButton>
        </div>
        <p className="mb-4 break-words text-sm font-semibold text-[var(--muted)]">{file.name}</p>
        <div className="grid gap-3">
          <FormField label="Mode">
            <select className="field-input" defaultValue={file.shareMode} name="mode" onChange={() => setSharePassword("")}>
              <option value="private">Privat</option>
              <option value="public">Public</option>
              <option value="password">Public dengan password</option>
            </select>
          </FormField>
          <FormField label="Password baru">
            <input className="field-input" onChange={(event) => setSharePassword(event.target.value)} placeholder="Isi jika mode password" type="password" value={sharePassword} />
          </FormField>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Kadaluarsa link">
              <input className="field-input" defaultValue={initialExpiresAt} min={new Date().toISOString().slice(0, 16)} name="expiresAt" type="datetime-local" />
            </FormField>
            <FormField label="Limit download">
              <input className="field-input" defaultValue={file.shareDownloadLimit || ""} min={1} name="downloadLimit" placeholder="Tanpa batas" type="number" />
            </FormField>
          </div>
          <div className="grid gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] p-3 text-sm font-semibold text-[var(--muted)] sm:grid-cols-3">
            <span>Download share: {file.shareDownloadCount || 0}{file.shareDownloadLimit ? `/${file.shareDownloadLimit}` : ""}</span>
            <span>Expiry: {file.shareExpiresAt ? formatDate(file.shareExpiresAt) : "Tidak ada"}</span>
            <span>Mode: {file.shareMode}</span>
          </div>
          {shareUrl && (
            <FormField label="Link share">
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_44px]">
                <input className="field-input" readOnly value={shareUrl} />
                <IconButton ariaLabel="Salin link share" onClick={copyShareLink}>
                  <Copy size={18} />
                </IconButton>
              </div>
            </FormField>
          )}
          {shareUrl && (
            <div className="grid gap-3 rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] p-3 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-center">
              <div className="grid min-h-44 place-items-center rounded-lg bg-white p-3">
                {qrDataUrl ? (
                  <img alt={`QR code untuk ${file.name}`} className="h-40 w-40" src={qrDataUrl} />
                ) : (
                  <div className="grid h-40 w-40 place-items-center text-[var(--muted)]">
                    <QrCode size={36} />
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-normal text-[var(--brand)]">QR share</p>
                <h3 className="mt-1 text-lg font-black text-[var(--text)]">Bagikan lewat scan</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                  QR ini membuka link share yang sama. Cocok untuk dibagikan di chat, poster, atau perangkat lain.
                </p>
                {qrStatus && <p className="mt-2 text-sm font-semibold text-[var(--warn)]">{qrStatus}</p>}
                <Button className="mt-4 w-full sm:w-auto" disabled={!qrDataUrl} onClick={downloadQrCode} type="button" variant="secondary">
                  <Download size={17} /> Download QR PNG
                </Button>
              </div>
            </div>
          )}
          <Button type="submit" variant="primary"><Link2 size={17} /> Simpan share</Button>
        </div>
      </motion.form>
    </motion.div>
  );
}
