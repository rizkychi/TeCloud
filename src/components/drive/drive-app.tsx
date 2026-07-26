"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  ArrowLeft,
  CheckSquare,
  Clock3,
  Download,
  Eye,
  File as FileIcon,
  FileArchive,
  FileText,
  Folder,
  Grid3X3,
  History,
  Image as ImageIcon,
  LayoutList,
  LogOut,
  Menu,
  MoreVertical,
  Palette,
  Plus,
  RefreshCw,
  Rows3,
  Search,
  Share2,
  Shield,
  Square,
  Star,
  Trash2,
  Upload,
  UserRound,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { LoadingOverlay, Spinner } from "@/components/ui/loading";
import { ToastHost, pushToast } from "@/components/ui/toast";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { ThemeProvider } from "@/components/theme-provider";
import { BrandLogo } from "@/components/brand-logo";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { formatBytes, isImageMime, isPreviewable, isZip } from "@/lib/format";
import type { SessionUser } from "@/lib/auth";
import { THEME_PRESETS } from "@/lib/units";
import {
  DeleteModal,
  NewFolderModal,
  PreviewModal,
  RenameModal,
  ShareModal,
  VersionsModal,
} from "@/components/drive/drive-modals";
import { MoveModal } from "@/components/drive/move-modal";
import { UploadProgressPanel, uploadWithProgress, type UploadJob } from "@/components/drive/upload-progress";

type ViewModeNav = "drive" | "trash" | "starred" | "recent";
type SortKey = "name" | "size" | "modified" | "type";
type SortDir = "asc" | "desc";
type TypeFilter = "all" | "file" | "folder" | "image" | "pdf" | "zip";

type FolderItem = {
  id: string;
  name: string;
  parentId: string | null;
  visibility: string;
  shareToken: string | null;
  starred?: boolean;
  pathLabel?: string;
  type: "folder";
  updatedAt?: string;
  createdAt?: string;
};

type FileItem = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  folderId: string | null;
  visibility: string;
  shareToken: string | null;
  hasSharePassword?: boolean;
  starred?: boolean;
  version?: number;
  isLatest?: boolean;
  pathLabel?: string;
  type: "file";
  updatedAt?: string;
  createdAt?: string;
};

type DriveData = {
  mode: string;
  folderId: string | null;
  breadcrumb: { id: string; name: string }[];
  folders: FolderItem[];
  files: FileItem[];
};

type MenuState = {
  x: number;
  y: number;
  kind: "file" | "folder";
  id: string;
  name: string;
  visibility: string;
  shareToken: string | null;
  mimeType?: string;
  starred?: boolean;
  version?: number;
} | null;

function FileTypeIcon({ item }: { item: FileItem | FolderItem }) {
  if (item.type === "folder") return <Folder className="h-5 w-5 text-[var(--accent)]" />;
  const mime = item.mimeType || "";
  if (isImageMime(mime)) return <ImageIcon className="h-5 w-5 text-[var(--brand-hover)]" />;
  if (isZip(mime, item.name)) return <FileArchive className="h-5 w-5 text-amber-400" />;
  if (mime === "application/pdf" || item.name.toLowerCase().endsWith(".pdf"))
    return <FileText className="h-5 w-5 text-rose-400" />;
  return <FileIcon className="h-5 w-5 text-[var(--brand)]" />;
}

function SideBtn({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm ${
        active ? "tc-selected text-[var(--text)]" : "text-[var(--muted)] tc-hover"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

export function DriveApp({
  dict,
  locale,
  user,
  storageDriver = "mock",
}: {
  dict: Dictionary;
  locale: string;
  user: SessionUser;
  storageDriver?: "mock" | "telegram";
}) {
  const router = useRouter();
  const [nav, setNav] = useState<ViewModeNav>("drive");
  const [folderId, setFolderId] = useState<string | null>(null);
  const [data, setData] = useState<DriveData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState(user.theme || "dark");
  const [allowedThemes, setAllowedThemes] = useState<string[]>(THEME_PRESETS.map((t) => t.id));
  const [viewMode, setViewMode] = useState<"list" | "grid" | "compact">(
    (user.viewMode as "list" | "grid" | "compact") || "list",
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null);
  const [bulkAction, setBulkAction] = useState<"zip" | "star" | "unstar" | "move" | "delete">("zip");
  const [menu, setMenu] = useState<MenuState>(null);
  const [dropActive, setDropActive] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [quota, setQuota] = useState({ used: user.usedBytes, total: user.quotaBytes });

  const [query, setQuery] = useState("");
  const [queryDraft, setQueryDraft] = useState("");
  const [sort, setSort] = useState<SortKey>("name");
  const [dir, setDir] = useState<SortDir>("asc");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");

  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [renameTarget, setRenameTarget] = useState<{ kind: "file" | "folder"; id: string; name: string } | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [shareTarget, setShareTarget] = useState<{
    kind: "file" | "folder";
    id: string;
    name: string;
    visibility: string;
    shareToken: string | null;
  } | null>(null);
  const [shareVisibility, setShareVisibility] = useState<"private" | "public" | "password">("private");
  const [sharePassword, setSharePassword] = useState("");
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ id: string; name: string; mimeType: string } | null>(null);
  const [deleteChoice, setDeleteChoice] = useState<{ kind: "file" | "folder"; id: string; name: string } | null>(null);
  const [versionsFor, setVersionsFor] = useState<{ id: string; name: string } | null>(null);
  const [versions, setVersions] = useState<
    Array<{ id: string; name: string; version: number; size: number; isLatest: boolean; createdAt: string; mimeType: string }>
  >([]);
  const [versionsBusy, setVersionsBusy] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [crumbOpen, setCrumbOpen] = useState(false);
  const [sessionUser] = useState(user);
  const [moveTarget, setMoveTarget] = useState<{ kind: "file" | "folder"; id: string; name: string } | null>(null);
  const [confirmState, setConfirmState] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    danger?: boolean;
    action: () => Promise<void>;
  } | null>(null);
  const [softLoading, setSoftLoading] = useState(false);
  const [dropFolderId, setDropFolderId] = useState<string | null>(null);
  const [draggingKeys, setDraggingKeys] = useState<Set<string>>(new Set());
  const [uploadJobs, setUploadJobs] = useState<UploadJob[]>([]);
  const uploadAbortRef = useRef<AbortController | null>(null);
  const cancelQueuedRef = useRef(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (opts?: { soft?: boolean }) => {
    if (opts?.soft) setSoftLoading(true);
    else setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (nav === "trash") params.set("trash", "1");
      else if (nav === "starred") params.set("starred", "1");
      else if (nav === "recent") params.set("recent", "1");
      else params.set("folderId", folderId || "root");

      if (query.trim()) params.set("q", query.trim());
      params.set("sort", sort);
      params.set("dir", dir);
      params.set("type", typeFilter);

      const res = await fetch(`/api/drive?${params.toString()}`);
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || dict.errorGeneric);
      setData(json);
      setSelected(new Set());
      const me = await fetch("/api/auth/me");
      if (me.ok) {
        const m = await me.json();
        if (m.user) setQuota({ used: m.user.usedBytes ?? 0, total: m.user.quotaBytes ?? 0 });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : dict.errorGeneric);
    } finally {
      setLoading(false);
      setSoftLoading(false);
    }
  }, [nav, folderId, query, sort, dir, typeFilter, router, dict.errorGeneric]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setCrumbOpen(false);
  }, [folderId, nav]);

  useEffect(() => {
    fetch("/api/preferences")
      .then((r) => r.json())
      .then((j) => {
        if (j.allowedThemes?.length) setAllowedThemes(j.allowedThemes);
        if (j.preferences?.theme) setTheme(j.preferences.theme);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const close = () => setMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
    };
  }, []);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setQuery(queryDraft), 300);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [queryDraft]);

  async function savePrefs(partial: { theme?: string; viewMode?: string }) {
    setBusy(dict.saving);
    try {
      const res = await fetch("/api/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(partial),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) throw new Error(j?.error?.message || dict.errorGeneric);
      if (j.allowedThemes) setAllowedThemes(j.allowedThemes);
    } catch (e) {
      setError(e instanceof Error ? e.message : dict.errorGeneric);
    } finally {
      setBusy(null);
    }
  }

  async function withBusy(label: string, fn: () => Promise<void>, successToast?: string) {
    setBusy(label);
    setError(null);
    try {
      await fn();
      if (successToast) pushToast("success", successToast);
    } catch (e) {
      const msg = e instanceof Error ? e.message : dict.errorGeneric;
      setError(msg);
      pushToast("error", msg);
    } finally {
      setBusy(null);
    }
  }

  async function logout() {
    await withBusy(dict.processing, async () => {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    });
  }

  async function createFolder() {
    if (!newFolderName.trim()) return;
    await withBusy(dict.processing, async () => {
      const res = await fetch("/api/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newFolderName.trim(), parentId: folderId }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) throw new Error(j?.error?.message || dict.errorGeneric);
      setNewFolderOpen(false);
      setNewFolderName("");
      await load({ soft: true });
    }, dict.toastSaved);
  }

  async function uploadFiles(fileList: FileList | File[] | null) {
    if (!fileList || (fileList as FileList).length === 0) return;
    const files = Array.from(fileList as FileList | File[]);
    cancelQueuedRef.current = false;
    const jobs: UploadJob[] = files.map((f, i) => ({
      id: `${Date.now()}-${i}-${f.name}`,
      name: f.name,
      size: f.size,
      progress: 0,
      status: "queued" as const,
    }));
    setUploadJobs(jobs);
    let versioned = false;
    let anyOk = false;
    // Background upload: progress panel only — no full-screen LoadingOverlay.
    try {
      for (let i = 0; i < files.length; i++) {
        if (cancelQueuedRef.current) {
          setUploadJobs((prev) =>
            prev.map((j, idx) => (idx >= i && j.status === "queued" ? { ...j, status: "cancelled" } : j)),
          );
          break;
        }
        const file = files[i];
        const jobId = jobs[i].id;
        if (file.size > 1073741824) {
          setUploadJobs((prev) =>
            prev.map((j) => (j.id === jobId ? { ...j, status: "error", error: dict.maxSize } : j)),
          );
          continue;
        }
        setUploadJobs((prev) =>
          prev.map((j) => (j.id === jobId ? { ...j, status: "uploading", progress: 0 } : j)),
        );
        const ac = new AbortController();
        uploadAbortRef.current = ac;
        try {
          const result = await uploadWithProgress(
            file,
            folderId,
            (pct) => {
              setUploadJobs((prev) =>
                prev.map((j) => (j.id === jobId ? { ...j, progress: pct } : j)),
              );
            },
            ac.signal,
          );
          if (!result.ok) {
            const code = result.json?.error?.code;
            const msg =
              code === "QUOTA_EXCEEDED"
                ? dict.quotaExceeded
                : code === "MAX_SIZE"
                  ? dict.maxSize
                  : result.json?.error?.message ||
                    (result.status === 413
                      ? dict.maxSize
                      : result.status === 0
                        ? "Network error"
                        : result.status >= 500
                          ? `${dict.errorGeneric} (HTTP ${result.status})`
                          : dict.errorGeneric);
            setUploadJobs((prev) =>
              prev.map((j) => (j.id === jobId ? { ...j, status: "error", error: msg, progress: 100 } : j)),
            );
            continue;
          }
          if (result.json?.versioned) versioned = true;
          anyOk = true;
          setUploadJobs((prev) =>
            prev.map((j) => (j.id === jobId ? { ...j, status: "done", progress: 100 } : j)),
          );
        } catch (e) {
          if (e instanceof DOMException && e.name === "AbortError") {
            setUploadJobs((prev) =>
              prev.map((j) => (j.id === jobId ? { ...j, status: "cancelled" } : j)),
            );
            break;
          }
          const msg = e instanceof Error ? e.message : dict.errorGeneric;
          setUploadJobs((prev) =>
            prev.map((j) => (j.id === jobId ? { ...j, status: "error", error: msg } : j)),
          );
        }
      }
      if (anyOk) {
        await load({ soft: true });
        pushToast("success", versioned ? dict.toastVersioned : dict.toastUploaded);
      }
    } finally {
      uploadAbortRef.current = null;
    }
  }

  async function softDelete(kind: "file" | "folder", id: string) {
    await withBusy(dict.processing, async () => {
      const url = kind === "file" ? `/api/files/${id}` : `/api/folders/${id}`;
      const res = await fetch(url, { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error?.message || dict.errorGeneric);
      }
      await load({ soft: true });
    }, dict.toastDeleted);
  }

  async function permanentDelete(kind: "file" | "folder", id: string) {
    await withBusy(dict.processing, async () => {
      const url =
        kind === "file" ? `/api/files/${id}?permanent=1` : `/api/folders/${id}?permanent=1`;
      const res = await fetch(url, { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error?.message || dict.errorGeneric);
      }
      await load({ soft: true });
    }, dict.saved);
  }

  async function restore(kind: "file" | "folder", id: string) {
    await withBusy(dict.processing, async () => {
      const url =
        kind === "file" ? `/api/files/${id}?restore=1` : `/api/folders/${id}?restore=1`;
      const res = await fetch(url, { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error?.message || dict.errorGeneric);
      }
      await load({ soft: true });
    }, dict.toastRestored);
  }

  async function saveRename() {
    if (!renameTarget || !renameValue.trim()) return;
    await withBusy(dict.saving, async () => {
      const url =
        renameTarget.kind === "file"
          ? `/api/files/${renameTarget.id}`
          : `/api/folders/${renameTarget.id}`;
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: renameValue.trim() }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error?.message || dict.errorGeneric);
      }
      setRenameTarget(null);
      await load({ soft: true });
    }, dict.toastSaved);
  }

  async function saveShare() {
    if (!shareTarget) return;
    if (shareVisibility === "password" && sharePassword && sharePassword.length < 4) {
      pushToast("error", dict.sharePasswordTooShort);
      return;
    }
    await withBusy(dict.saving, async () => {
      const url =
        shareTarget.kind === "file"
          ? `/api/files/${shareTarget.id}/share`
          : `/api/folders/${shareTarget.id}/share`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visibility: shareVisibility,
          password: shareVisibility === "password" && sharePassword ? sharePassword : undefined,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error?.message || dict.errorGeneric);
      setShareUrl(j.shareUrl || null);
      await load({ soft: true });
    }, dict.toastSaved);
  }

  async function toggleStar(kind: "file" | "folder", id: string, starred: boolean) {
    await withBusy(dict.saving, async () => {
      const res = await fetch("/api/star", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, id, starred }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) throw new Error(j?.error?.message || dict.errorGeneric);
      await load({ soft: true });
    }, starred ? dict.toastStarred : dict.toastUnstarred);
  }

  async function openVersions(id: string, name: string) {
    setVersionsFor({ id, name });
    setVersionsBusy(true);
    try {
      const res = await fetch(`/api/files/${id}/versions`);
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error?.message || dict.errorGeneric);
      setVersions(j.versions || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : dict.errorGeneric);
      setVersionsFor(null);
    } finally {
      setVersionsBusy(false);
    }
  }

  async function zipSelected() {
    const fileIds: string[] = [];
    const folderIds: string[] = [];
    for (const key of selected) {
      const [kind, id] = key.split(":");
      if (kind === "file") fileIds.push(id);
      else folderIds.push(id);
    }
    if (!fileIds.length && !folderIds.length) return;
    await withBusy(dict.processing, async () => {
      const res = await fetch("/api/zip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileIds, folderIds, folderId }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) throw new Error(j?.error?.message || dict.errorGeneric);
      await load({ soft: true });
    }, dict.toastZipped);
  }

  async function unzipFile(id: string) {
    await withBusy(dict.processing, async () => {
      const res = await fetch("/api/unzip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId: id, folderId }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) throw new Error(j?.error?.message || dict.errorGeneric);
      await load({ soft: true });
    }, dict.toastUnzipped);
  }

  async function moveItem(kind: "file" | "folder", id: string, targetFolderId: string | null) {
    await withBusy(dict.processing, async () => {
      const url = kind === "file" ? `/api/files/${id}` : `/api/folders/${id}`;
      const body = kind === "file" ? { folderId: targetFolderId } : { parentId: targetFolderId };
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) throw new Error(j?.error?.message || dict.errorGeneric);
      setMoveTarget(null);
      await load({ soft: true });
    }, dict.toastMoved);
  }

  async function moveKeys(keys: string[], targetFolderId: string | null) {
    if (!keys.length) return;
    // prevent dropping folder into itself
    const filtered = keys.filter((k) => {
      const [kind, id] = k.split(":");
      if (kind === "folder" && id === targetFolderId) return false;
      return true;
    });
    if (!filtered.length) return;
    await withBusy(dict.processing, async () => {
      for (const key of filtered) {
        const [kind, id] = key.split(":") as ["file" | "folder", string];
        // skip if already in target for files
        if (kind === "file") {
          const item = data?.files.find((f) => f.id === id);
          if (item && (item.folderId || null) === (targetFolderId || null)) continue;
        }
        if (kind === "folder") {
          const item = data?.folders.find((f) => f.id === id);
          if (item && (item.parentId || null) === (targetFolderId || null)) continue;
        }
        const url = kind === "file" ? `/api/files/${id}` : `/api/folders/${id}`;
        const body = kind === "file" ? { folderId: targetFolderId } : { parentId: targetFolderId };
        const res = await fetch(url, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => null);
          throw new Error(j?.error?.message || dict.errorGeneric);
        }
      }
      setMoveTarget(null);
      setSelected(new Set());
      await load({ soft: true });
    }, dict.toastMoved);
  }

  async function bulkMoveTo(targetFolderId: string | null) {
    await moveKeys(Array.from(selected), targetFolderId);
  }

  async function emptyTrash() {
    if (!data) return;
    await withBusy(dict.processing, async () => {
      for (const f of data.files) {
        const res = await fetch(`/api/files/${f.id}?permanent=1`, { method: "DELETE" });
        if (!res.ok) {
          const j = await res.json().catch(() => null);
          throw new Error(j?.error?.message || dict.errorGeneric);
        }
      }
      for (const f of data.folders) {
        const res = await fetch(`/api/folders/${f.id}?permanent=1`, { method: "DELETE" });
        if (!res.ok) {
          const j = await res.json().catch(() => null);
          throw new Error(j?.error?.message || dict.errorGeneric);
        }
      }
      await load({ soft: true });
    }, dict.toastEmptied);
  }

  async function bulkStar(starred: boolean) {
    await withBusy(dict.saving, async () => {
      for (const key of selected) {
        const [kind, id] = key.split(":");
        const res = await fetch("/api/star", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind, id, starred }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => null);
          throw new Error(j?.error?.message || dict.errorGeneric);
        }
      }
      await load({ soft: true });
    }, starred ? dict.toastStarred : dict.toastUnstarred);
  }

  async function bulkDelete() {
    await withBusy(dict.processing, async () => {
      for (const key of Array.from(selected)) {
        const [kind, id] = key.split(":") as ["file" | "folder", string];
        const res = await fetch(kind === "file" ? `/api/files/${id}` : `/api/folders/${id}`, { method: "DELETE" });
        if (!res.ok) {
          const j = await res.json().catch(() => null);
          throw new Error(j?.error?.message || dict.errorGeneric);
        }
      }
      await load({ soft: true });
    }, dict.toastDeleted);
  }

  function openShare(item: {
    kind: "file" | "folder";
    id: string;
    name: string;
    visibility: string;
    shareToken: string | null;
  }) {
    setShareTarget(item);
    setShareVisibility((item.visibility as "private" | "public" | "password") || "private");
    setSharePassword("");
    setShareUrl(item.shareToken ? `${window.location.origin}/s/${item.shareToken}` : null);
  }

  function toggleSelect(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function selectItem(item: FolderItem | FileItem, index: number, e?: React.MouseEvent) {
    const key = `${item.type}:${item.id}`;
    const ctrl = Boolean(e && (e.ctrlKey || e.metaKey));
    const shift = Boolean(e && e.shiftKey);

    if (shift && lastClickedIndex != null && items.length) {
      const start = Math.min(lastClickedIndex, index);
      const end = Math.max(lastClickedIndex, index);
      const range = items.slice(start, end + 1).map((it) => `${it.type}:${it.id}`);
      if (ctrl) {
        setSelected((prev) => {
          const next = new Set(prev);
          for (const k of range) next.add(k);
          return next;
        });
      } else {
        setSelected(new Set(range));
      }
      return;
    }

    if (ctrl) {
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      });
      setLastClickedIndex(index);
      return;
    }

    // plain click: select only this item (mark by clicking the row/card)
    setSelected(new Set([key]));
    setLastClickedIndex(index);
  }

  async function applyBulkAction() {
    if (!selected.size) return;
    if (bulkAction === "zip") return zipSelected();
    if (bulkAction === "star") return bulkStar(true);
    if (bulkAction === "unstar") return bulkStar(false);
    if (bulkAction === "move") {
      setMoveTarget({ kind: "file", id: "__multi__", name: `${selected.size} ${dict.selected}` });
      return;
    }
    if (bulkAction === "delete") {
      setConfirmState({
        title: dict.delete,
        message: dict.confirmDelete,
        confirmLabel: dict.delete,
        danger: true,
        action: bulkDelete,
      });
    }
  }

  function goBack() {
    if (nav !== "drive") {
      setNav("drive");
      return;
    }
    if (!data?.breadcrumb?.length) {
      setFolderId(null);
      return;
    }
    const parent = data.breadcrumb[data.breadcrumb.length - 2];
    setFolderId(parent ? parent.id : null);
  }

  const items = useMemo(() => {
    if (!data) return [] as Array<FolderItem | FileItem>;
    return [
      ...data.folders.map((f) => ({ ...f, type: "folder" as const })),
      ...data.files.map((f) => ({ ...f, type: "file" as const })),
    ];
  }, [data]);

  const modalOpen = Boolean(
    newFolderOpen || renameTarget || shareTarget || deleteChoice || preview || versionsFor || moveTarget || confirmState,
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const typing =
        tag === "input" || tag === "textarea" || tag === "select" || target?.isContentEditable;
      if (typing) return;

      if (e.key === "Escape") {
        if (menu) { setMenu(null); return; }
        if (modalOpen) return; // modals have their own close
        if (selected.size) { setSelected(new Set()); return; }
        if (queryDraft || query) { setQueryDraft(""); setQuery(""); return; }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
        if (nav === "trash") return;
        e.preventDefault();
        setSelected(new Set(items.map((i) => `${i.type}:${i.id}`)));
        return;
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        if (nav !== "drive" || !selected.size || busy) return;
        e.preventDefault();
        setConfirmState({
          title: dict.delete,
          message: dict.confirmDelete,
          confirmLabel: dict.delete,
          danger: true,
          action: bulkDelete,
        });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menu, modalOpen, selected, queryDraft, query, nav, items, busy, dict]);

  function onContextMenu(e: React.MouseEvent, item: FolderItem | FileItem) {
    e.preventDefault();
    e.stopPropagation();
    setMenu({
      x: Math.min(e.clientX, window.innerWidth - 240),
      y: Math.min(e.clientY, window.innerHeight - 360),
      kind: item.type,
      id: item.id,
      name: item.name,
      visibility: item.visibility,
      shareToken: item.shareToken,
      mimeType: item.type === "file" ? item.mimeType : undefined,
      starred: item.starred,
      version: item.type === "file" ? item.version : undefined,
    });
  }

  function onDragEnter(e: React.DragEvent) {
    e.preventDefault();
    // only highlight main area for external file drops
    if ([...e.dataTransfer.types].includes("Files")) {
      dragDepth.current += 1;
      setDropActive(true);
    }
  }
  function onDragLeave(e: React.DragEvent) {
    e.preventDefault();
    if ([...e.dataTransfer.types].includes("Files") || dropActive) {
      dragDepth.current -= 1;
      if (dragDepth.current <= 0) {
        dragDepth.current = 0;
        setDropActive(false);
      }
    }
  }
  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = [...e.dataTransfer.types].includes("application/x-tecloud-items")
      ? "move"
      : "copy";
  }
  async function onDrop(e: React.DragEvent) {
    e.preventDefault();
    dragDepth.current = 0;
    setDropActive(false);
    setDropFolderId(null);
    setDraggingKeys(new Set());
    if (nav !== "drive") return;

    // Internal item move
    const raw = e.dataTransfer.getData("application/x-tecloud-items");
    if (raw) {
      try {
        const keys = JSON.parse(raw) as string[];
        // drop on empty area of current folder = no-op (already here)
        return;
      } catch {
        /* ignore */
      }
    }

    const files = e.dataTransfer.files;
    if (files?.length) await uploadFiles(files);
  }

  function itemDragStart(e: React.DragEvent, item: FolderItem | FileItem) {
    if (nav !== "drive") {
      e.preventDefault();
      return;
    }
    const key = `${item.type}:${item.id}`;
    const keys = selected.has(key) ? Array.from(selected) : [key];
    e.dataTransfer.setData("application/x-tecloud-items", JSON.stringify(keys));
    e.dataTransfer.setData("text/plain", keys.join(","));
    e.dataTransfer.effectAllowed = "move";
    setDraggingKeys(new Set(keys));
  }

  function itemDragEnd() {
    setDraggingKeys(new Set());
    setDropFolderId(null);
  }

  function folderDragOver(e: React.DragEvent, folderIdTarget: string) {
    if (nav !== "drive") return;
    if (![...e.dataTransfer.types].includes("application/x-tecloud-items") &&
        ![...e.dataTransfer.types].includes("text/plain")) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    setDropFolderId(folderIdTarget);
  }

  function folderDragLeave(e: React.DragEvent, folderIdTarget: string) {
    e.preventDefault();
    // only clear if leaving this folder target
    if (dropFolderId === folderIdTarget) setDropFolderId(null);
  }

  async function folderDrop(e: React.DragEvent, folderIdTarget: string) {
    e.preventDefault();
    e.stopPropagation();
    setDropFolderId(null);
    setDropActive(false);
    if (nav !== "drive") return;
    const raw =
      e.dataTransfer.getData("application/x-tecloud-items") ||
      e.dataTransfer.getData("text/plain");
    setDraggingKeys(new Set());
    if (!raw) return;
    try {
      const keys = raw.includes("[") ? (JSON.parse(raw) as string[]) : raw.split(",").filter(Boolean);
      await moveKeys(keys, folderIdTarget);
    } catch (err) {
      pushToast("error", err instanceof Error ? err.message : dict.errorGeneric);
    }
  }

  function openLocation(item: FolderItem | FileItem) {
    setNav("drive");
    if (item.type === "folder") {
      setFolderId(item.parentId);
    } else {
      setFolderId(item.folderId);
    }
    setQueryDraft("");
    setQuery("");
  }

  const quotaPct = quota.total > 0 ? Math.min(100, (quota.used / quota.total) * 100) : 0;
  const canGoBack = nav === "drive" && Boolean(folderId || (data?.breadcrumb?.length ?? 0) > 0);
  const emptyLabel =
    nav === "trash"
      ? dict.emptyTrash
      : nav === "starred"
        ? dict.emptyStarred
        : nav === "recent"
          ? dict.emptyRecent
          : query
            ? dict.emptySearch
            : dict.emptyFolder;

  const themeLabel = (id: string) => {
    if (id === "light") return dict.themeLight;
    if (id === "dark") return dict.themeDark;
    if (id === "ocean") return dict.themeOcean;
    if (id === "forest") return dict.themeForest;
    if (id === "sunset") return dict.themeSunset;
    if (id === "campus") return dict.themeCampus;
    return id;
  };

  return (
    <ThemeProvider theme={theme}>
      <LoadingOverlay show={Boolean(busy)} label={busy || dict.loading} />
      <ToastHost />
      <div className="flex min-h-screen bg-[var(--bg)] text-[var(--text)]">
        {mobileNav && (
          <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={() => setMobileNav(false)} />
        )}
        <aside className={`fixed inset-y-0 left-0 z-50 w-72 border-r tc-border bg-[var(--panel)] p-4 transition-transform md:static md:z-auto md:flex md:w-64 md:translate-x-0 md:flex-col ${
          mobileNav ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        } hidden md:flex ${mobileNav ? "!flex" : ""}`}>
          <div className="mb-8 flex items-center gap-2 px-2">
            <BrandLogo size={36} />
            <div>
              <div className="text-sm font-medium tracking-tight">{dict.appName}</div>
              <div className="text-[10px] text-[var(--faint)]">
                {storageDriver === "telegram" ? dict.storageTelegram : dict.storageMock}
              </div>
            </div>
          </div>

          <nav className="space-y-1">
            <SideBtn
              active={nav === "drive"}
              onClick={() => {
                setNav("drive");
                setFolderId(null);
                setQueryDraft("");
                setQuery("");
                setMobileNav(false);
              }}
              icon={<Folder className="h-4 w-4" />}
              label={dict.myDrive}
            />
            <SideBtn
              active={nav === "starred"}
              onClick={() => {
                setNav("starred");
                setFolderId(null);
                setMobileNav(false);
              }}
              icon={<Star className="h-4 w-4" />}
              label={dict.starred}
            />
            <SideBtn
              active={nav === "recent"}
              onClick={() => {
                setNav("recent");
                setFolderId(null);
                setMobileNav(false);
              }}
              icon={<Clock3 className="h-4 w-4" />}
              label={dict.recent}
            />
            <SideBtn
              active={nav === "trash"}
              onClick={() => { setNav("trash"); setMobileNav(false); }}
              icon={<Trash2 className="h-4 w-4" />}
              label={dict.trash}
            />
            {user.role === "admin" && (
              <SideBtn
                active={false}
                onClick={() => router.push("/admin")}
                icon={<Shield className="h-4 w-4" />}
                label={dict.admin}
              />
            )}
          </nav>

          <div className="mt-6 rounded-xl border tc-border p-3">
            <div className="mb-2 flex items-center justify-between text-xs text-[var(--muted)]">
              <span>{dict.quota}</span>
              <span>
                {formatBytes(quota.used)} / {formatBytes(quota.total)}
              </span>
            </div>
            <div className="quota-bar">
              <span style={{ width: `${quotaPct}%` }} />
            </div>
          </div>

          <div className="mt-4 space-y-2 rounded-xl border tc-border p-3">
            <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
              <Palette className="h-3.5 w-3.5" /> {dict.theme}
            </div>
            <Select
              value={theme}
              options={allowedThemes.map((id) => ({ value: id, label: themeLabel(id) }))}
              onChange={async (next) => {
                setTheme(next);
                await savePrefs({ theme: next });
              }}
            />
          </div>

          <div className="mt-auto space-y-3 border-t tc-border pt-4">
            <button
              type="button"
              onClick={() => router.push("/profile")}
              className="flex w-full items-center gap-2 rounded-xl border tc-border px-2 py-2 text-left text-xs tc-hover"
              title={dict.profile}
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--surface-2)] text-[var(--brand)]">
                <UserRound className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-[var(--text-2)]">{sessionUser.name}</div>
                <div className="truncate text-[var(--muted)]">{sessionUser.username}</div>
              </div>
            </button>
            <Button variant="ghost" className="w-full" onClick={logout}>
              <LogOut className="h-4 w-4" />
              {dict.signOut}
            </Button>
          </div>
        </aside>

        <main
          className={`flex min-w-0 flex-1 flex-col ${dropActive ? "drop-active" : ""}`}
          onDragEnter={onDragEnter}
          onDragLeave={onDragLeave}
          onDragOver={onDragOver}
          onDrop={onDrop}
        >
          <header className="flex flex-wrap items-center gap-2 border-b tc-border bg-[var(--panel)] px-4 py-3">
            <Button
              size="sm"
              variant="subtle"
              className="md:hidden"
              onClick={() => setMobileNav(true)}
              title={dict.menu}
            >
              <Menu className="h-4 w-4" />
            </Button>
            {canGoBack && (
              <Button
                size="icon"
                variant="subtle"
                onClick={goBack}
                title={dict.back}
                aria-label={dict.back}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}

            <div className="flex min-w-0 flex-1 items-center gap-1.5 text-sm text-[var(--muted)]">
              {nav === "drive" ? (
                (() => {
                  const crumbs = data?.breadcrumb || [];
                  const maxVisible = 2;
                  const hidden = crumbs.length > maxVisible ? crumbs.slice(0, crumbs.length - maxVisible) : [];
                  const visible = crumbs.length > maxVisible ? crumbs.slice(-maxVisible) : crumbs;
                  return (
                    <>
                      <button type="button" className="shrink-0 hover:text-[var(--text)]" onClick={() => { setFolderId(null); setCrumbOpen(false); }}>
                        {dict.breadcrumbRoot}
                      </button>
                      {hidden.length > 0 && (
                        <span className="flex items-center gap-1.5">
                          <span>/</span>
                          <span className="tc-breadcrumb-ellipsis">
                            <button
                              type="button"
                              className="rounded-md px-1.5 py-0.5 font-medium hover:bg-[var(--hover)] hover:text-[var(--text)]"
                              title={dict.showMorePath}
                              onClick={() => setCrumbOpen((v) => !v)}
                            >
                              …
                            </button>
                            {crumbOpen && (
                              <div className="tc-breadcrumb-menu">
                                {hidden.map((c) => (
                                  <button
                                    key={c.id}
                                    type="button"
                                    onClick={() => {
                                      setFolderId(c.id);
                                      setCrumbOpen(false);
                                    }}
                                  >
                                    {c.name}
                                  </button>
                                ))}
                              </div>
                            )}
                          </span>
                        </span>
                      )}
                      {visible.map((c) => (
                        <span key={c.id} className="flex min-w-0 items-center gap-1.5">
                          <span>/</span>
                          <button
                            type="button"
                            className="max-w-[140px] truncate hover:text-[var(--text)]"
                            onClick={() => setFolderId(c.id)}
                            title={c.name}
                          >
                            {c.name}
                          </button>
                        </span>
                      ))}
                    </>
                  );
                })()
              ) : (
                <span className="text-[var(--text)]">
                  {nav === "trash"
                    ? dict.trash
                    : nav === "starred"
                      ? dict.starred
                      : nav === "recent"
                        ? dict.recent
                        : dict.searchResults}
                </span>
              )}
            </div>

            <div className="w-[8.5rem] shrink-0">
              <Select
                size="sm"
                value={viewMode}
                options={[
                  { value: "list", label: dict.viewList },
                  { value: "grid", label: dict.viewGrid },
                  { value: "compact", label: dict.viewCompact },
                ]}
                onChange={async (v) => {
                  const mode = v as "list" | "grid" | "compact";
                  setViewMode(mode);
                  await savePrefs({ viewMode: mode });
                }}
                leading={
                  viewMode === "grid" ? (
                    <Grid3X3 className="h-3.5 w-3.5 shrink-0 text-[var(--muted)]" />
                  ) : viewMode === "compact" ? (
                    <Rows3 className="h-3.5 w-3.5 shrink-0 text-[var(--muted)]" />
                  ) : (
                    <LayoutList className="h-3.5 w-3.5 shrink-0 text-[var(--muted)]" />
                  )
                }
              />
            </div>

            {nav === "drive" && (
              <>
                <Button size="sm" variant="ghost" onClick={() => setNewFolderOpen(true)} disabled={!!busy}>
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">{dict.newFolder}</span>
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => uploadFiles(e.target.files)}
                />
                <input
                  ref={folderInputRef}
                  type="file"
                  className="hidden"
                  // @ts-expect-error webkitdirectory is non-standard but widely supported
                  webkitdirectory=""
                  multiple
                  onChange={(e) => uploadFiles(e.target.files)}
                />
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!!busy}
                >
                  <Upload className="h-4 w-4" />
                  <span className="hidden sm:inline">{dict.upload}</span>
                </Button>
              </>
            )}

            <Button size="sm" variant="subtle" onClick={() => load()} title={dict.refresh} disabled={!!busy}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </header>

          <div className="flex flex-wrap items-center gap-1.5 border-b tc-border bg-[var(--panel)] px-3 py-1.5">
            <div className="relative min-w-[12rem] flex-1 basis-[min(100%,18rem)]">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--faint)]" />
              <Input
                className="h-8 w-full pl-8 text-xs"
                placeholder={dict.searchPlaceholder}
                value={queryDraft}
                onChange={(e) => setQueryDraft(e.target.value)}
              />
            </div>
            <div className="ml-auto flex flex-wrap items-center justify-end gap-1.5">
              <div className="w-[7.25rem]">
                <Select
                  size="sm"
                  value={sort}
                  options={[
                    { value: "name", label: dict.sortName },
                    { value: "size", label: dict.sortSize },
                    { value: "modified", label: dict.sortModified },
                    { value: "type", label: dict.sortType },
                  ]}
                  onChange={(v) => setSort(v as SortKey)}
                />
              </div>
              <div className="w-[6.5rem]">
                <Select
                  size="sm"
                  value={dir}
                  options={[
                    { value: "asc", label: dict.ascending },
                    { value: "desc", label: dict.descending },
                  ]}
                  onChange={(v) => setDir(v as SortDir)}
                />
              </div>
              <div className="w-[7.5rem]">
                <Select
                  size="sm"
                  value={typeFilter}
                  options={[
                    { value: "all", label: dict.filterAll },
                    { value: "folder", label: dict.filterFolders },
                    { value: "file", label: dict.filterFiles },
                    { value: "image", label: dict.filterImages },
                    { value: "pdf", label: dict.filterPdf },
                    { value: "zip", label: dict.filterZip },
                  ]}
                  onChange={(v) => setTypeFilter(v as TypeFilter)}
                />
              </div>
            </div>
          </div>

          {nav === "trash" && items.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-b tc-border bg-[var(--surface-2)] px-4 py-2 text-sm">
              <Button
                size="sm"
                variant="danger"
                disabled={!!busy}
                onClick={() =>
                  setConfirmState({
                    title: dict.emptyTrashAction,
                    message: dict.confirmEmptyTrash,
                    confirmLabel: dict.emptyTrashAction,
                    danger: true,
                    action: emptyTrash,
                  })
                }
              >
                <Trash2 className="h-4 w-4" />
                {dict.emptyTrashAction}
              </Button>
            </div>
          )}

          <div className="flex-1 p-4 md:p-6">
            {softLoading && !loading && (
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border tc-border bg-[var(--panel)] px-3 py-1 text-xs text-[var(--muted)]">
                <Spinner className="h-3.5 w-3.5" /> {dict.loading}
              </div>
            )}
            {error && (
              <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {error}
              </div>
            )}

            {loading ? (
              <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
                <Spinner /> {dict.loading}
              </div>
            ) : items.length === 0 ? (
              <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed tc-border bg-[var(--panel)] px-4 py-10 text-center">
                <img
                  src={nav === "trash" ? "/illustrations/empty-trash.svg" : "/illustrations/empty-drive.svg"}
                  alt=""
                  width={180}
                  height={135}
                  className="mb-4 opacity-90"
                />
                {nav === "drive" && !query && !folderId ? (
                  <>
                    <p className="text-sm font-medium text-[var(--text)]">{dict.onboardingTitle}</p>
                    <p className="mt-2 max-w-md text-xs leading-relaxed text-[var(--muted)]">{dict.onboardingBody}</p>
                    <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                      <Button size="sm" variant="primary" onClick={() => fileInputRef.current?.click()}>
                        <Upload className="h-4 w-4" /> {dict.onboardingUpload}
                      </Button>
                      <Button size="sm" variant="subtle" onClick={() => setNewFolderOpen(true)}>
                        <Plus className="h-4 w-4" /> {dict.onboardingFolder}
                      </Button>
                    </div>
                    <p className="mt-3 max-w-sm text-[11px] text-[var(--faint)]">{dict.onboardingShare}</p>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-[var(--muted)]">{emptyLabel}</p>
                    {nav === "drive" && !query && (
                      <p className="mt-2 max-w-sm text-xs text-[var(--faint)]">{dict.dropHint}</p>
                    )}
                  </>
                )}
              </div>
            ) : viewMode === "grid" ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
                {items.map((item, index) => {
                  const key = `${item.type}:${item.id}`;
                  const isFolderDrop = item.type === "folder" && dropFolderId === item.id;
                  return (
                    <div
                      key={key}
                      draggable={nav === "drive"}
                      onDragStart={(e) => itemDragStart(e, item)}
                      onDragEnd={itemDragEnd}
                      onDragOver={item.type === "folder" ? (e) => folderDragOver(e, item.id) : undefined}
                      onDragLeave={item.type === "folder" ? (e) => folderDragLeave(e, item.id) : undefined}
                      onDrop={item.type === "folder" ? (e) => folderDrop(e, item.id) : undefined}
                      className={`group relative cursor-pointer rounded-xl border tc-border p-3 tc-hover ${selected.has(key) ? "tc-selected" : ""} ${draggingKeys.has(key) ? "item-dragging" : ""} ${isFolderDrop ? "folder-drop-target" : ""}`}
                      onContextMenu={(e) => onContextMenu(e, item)}
                      onClick={(e) => {
                        // avoid when clicking nested interactive later
                        selectItem(item, index, e);
                      }}
                      onDoubleClick={() => {
                        if (item.type === "folder") {
                          setNav("drive");
                          setFolderId(item.id);
                        } else if (item.type === "file" && isPreviewable(item.mimeType, item.name)) {
                          setPreview({ id: item.id, name: item.name, mimeType: item.mimeType });
                        }
                      }}
                    >
                      {selected.has(key) && (
                        <div className="absolute left-2 top-2 z-10 rounded bg-[var(--panel)]/80 p-1">
                          <CheckSquare className="h-4 w-4 text-[var(--brand)]" />
                        </div>
                      )}
                      {item.starred && (
                        <Star className="absolute right-2 top-2 h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                      )}
                      <div className="file-thumb mb-2">
                        {item.type === "file" && isImageMime(item.mimeType) ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={`/api/files/${item.id}/preview`} alt={item.name} />
                        ) : (
                          <FileTypeIcon item={item} />
                        )}
                      </div>
                      <div className="truncate text-sm" title={item.name}>
                        {item.name}
                        {item.type === "file" && (item.version || 1) > 1 ? (
                          <span className="ml-1 text-[10px] text-[var(--faint)]">v{item.version}</span>
                        ) : null}
                      </div>
                      <div className="mt-1 text-[10px] text-[var(--faint)]">
                        {item.type === "file" ? formatBytes(item.size) : dict.folder}
                      </div>
                      {item.pathLabel && (nav === "starred" || nav === "recent" || data?.mode === "search") && (
                        <button
                          type="button"
                          className="mt-1 block w-full truncate text-left text-[10px] text-[var(--brand-hover)] hover:underline"
                          title={item.pathLabel}
                          onClick={(e) => {
                            e.stopPropagation();
                            openLocation(item);
                          }}
                        >
                          {item.pathLabel}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border tc-border bg-[var(--panel)]">
                <table className="w-full text-left text-sm">
                  <thead className="border-b tc-border text-xs text-[var(--muted)]">
                    <tr>
                      <th className="w-10 px-3 py-3" />
                      <th className="px-3 py-3 font-medium">{dict.nameCol}</th>
                      {(nav === "starred" || nav === "recent" || data?.mode === "search") && (
                        <th className="hidden px-3 py-3 font-medium lg:table-cell">{dict.pathCol}</th>
                      )}
                      {viewMode !== "compact" && (
                        <>
                          <th className="hidden px-3 py-3 font-medium sm:table-cell">{dict.sizeCol}</th>
                          <th className="hidden px-3 py-3 font-medium md:table-cell">{dict.modifiedCol}</th>
                        </>
                      )}
                      <th className="px-3 py-3 font-medium">{dict.actions}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, index) => {
                      const key = `${item.type}:${item.id}`;
                      const isFolderDrop = item.type === "folder" && dropFolderId === item.id;
                      return (
                        <tr
                          key={key}
                          draggable={nav === "drive"}
                          onDragStart={(e) => itemDragStart(e, item)}
                          onDragEnd={itemDragEnd}
                          onDragOver={item.type === "folder" ? (e) => folderDragOver(e, item.id) : undefined}
                          onDragLeave={item.type === "folder" ? (e) => folderDragLeave(e, item.id) : undefined}
                          onDrop={item.type === "folder" ? (e) => folderDrop(e, item.id) : undefined}
                          className={`cursor-pointer border-b border-[var(--border-subtle)] tc-hover ${selected.has(key) ? "tc-selected" : ""} ${draggingKeys.has(key) ? "item-dragging" : ""} ${isFolderDrop ? "folder-drop-target" : ""}`}
                          onContextMenu={(e) => onContextMenu(e, item)}
                          onClick={(e) => selectItem(item, index, e)}
                          onDoubleClick={() => {
                            if (item.type === "folder") {
                              setNav("drive");
                              setFolderId(item.id);
                            } else if (item.type === "file" && isPreviewable(item.mimeType, item.name)) {
                              setPreview({ id: item.id, name: item.name, mimeType: item.mimeType });
                            }
                          }}
                        >
                          <td className="px-3 py-2">
                            {selected.has(key) ? (
                              <CheckSquare className="h-4 w-4 text-[var(--brand)]" />
                            ) : (
                              <Square className="h-4 w-4 text-[var(--faint)]" />
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex max-w-full items-center gap-2 text-left">
                              <FileTypeIcon item={item} />
                              <span className="truncate">{item.name}</span>
                              {item.starred && <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />}
                              {item.type === "file" && (item.version || 1) > 1 && (
                                <span className="rounded-full border tc-border px-2 py-0.5 text-[10px] text-[var(--muted)]">
                                  v{item.version}
                                </span>
                              )}
                              {item.visibility !== "private" && (
                                <span className="rounded-full border tc-border px-2 py-0.5 text-[10px] text-[var(--muted)]">
                                  {item.visibility === "password"
                                    ? dict.visibilityPassword
                                    : dict.visibilityPublic}
                                </span>
                              )}
                            </div>
                          </td>
                          {(nav === "starred" || nav === "recent" || data?.mode === "search") && (
                            <td className="hidden px-3 py-2 lg:table-cell">
                              {item.pathLabel ? (
                                <button
                                  type="button"
                                  className="max-w-[220px] truncate text-left text-xs text-[var(--brand-hover)] hover:underline"
                                  title={item.pathLabel}
                                  onClick={() => openLocation(item)}
                                >
                                  {item.pathLabel}
                                </button>
                              ) : (
                                <span className="text-xs text-[var(--faint)]">—</span>
                              )}
                            </td>
                          )}
                          {viewMode !== "compact" && (
                            <>
                              <td className="hidden px-3 py-2 text-[var(--muted)] sm:table-cell">
                                {item.type === "file" ? formatBytes(item.size) : "—"}
                              </td>
                              <td className="hidden px-3 py-2 text-[var(--muted)] md:table-cell">
                                {item.updatedAt ? new Date(item.updatedAt).toLocaleString(locale) : "—"}
                              </td>
                            </>
                          )}
                          <td className="px-3 py-2">
                            <button
                              type="button"
                              className="tc-icon-btn !h-8 !w-8"
                              onClick={(e) => {
                                e.stopPropagation();
                                onContextMenu(e, item);
                              }}
                              title={dict.more}
                            >
                              <MoreVertical className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {nav === "drive" && (
                  <p className="kbd-hint">{dict.dragHint} · {dict.shortcutsHint}</p>
                )}
              </div>
            )}
          </div>
        </main>

        {menu && (
          <div
            className="context-menu"
            style={{ left: menu.x, top: menu.y }}
            onClick={(e) => e.stopPropagation()}
          >
            {nav === "trash" ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    restore(menu.kind, menu.id);
                    setMenu(null);
                  }}
                >
                  <RefreshCw className="h-4 w-4" /> {dict.restore}
                </button>
                <button
                  type="button"
                  className="danger"
                  onClick={() => {
                    setConfirmState({
                      title: dict.deleteForever,
                      message: dict.confirmPermanent,
                      confirmLabel: dict.deleteForever,
                      danger: true,
                      action: async () => permanentDelete(menu.kind, menu.id),
                    });
                    setMenu(null);
                  }}
                >
                  <Trash2 className="h-4 w-4" /> {dict.deleteForever}
                </button>
              </>
            ) : (
              <>
                {menu.kind === "folder" && (
                  <button
                    type="button"
                    onClick={() => {
                      setNav("drive");
                      setFolderId(menu.id);
                      setMenu(null);
                    }}
                  >
                    <Folder className="h-4 w-4" /> {dict.open}
                  </button>
                )}
                {(nav === "starred" || nav === "recent") && (
                  <button
                    type="button"
                    onClick={() => {
                      const item =
                        menu.kind === "folder"
                          ? data?.folders.find((f) => f.id === menu.id)
                          : data?.files.find((f) => f.id === menu.id);
                      if (item) openLocation({ ...item, type: menu.kind } as FolderItem | FileItem);
                      setMenu(null);
                    }}
                  >
                    <Folder className="h-4 w-4" /> {dict.openLocation}
                  </button>
                )}
                {menu.kind === "file" && isPreviewable(menu.mimeType || "", menu.name) && (
                  <button
                    type="button"
                    onClick={() => {
                      setPreview({ id: menu.id, name: menu.name, mimeType: menu.mimeType || "" });
                      setMenu(null);
                    }}
                  >
                    <Eye className="h-4 w-4" /> {dict.preview}
                  </button>
                )}
                {menu.kind === "file" && (
                  <a
                    className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] hover:bg-[var(--hover)]"
                    href={`/api/files/${menu.id}/download`}
                  >
                    <Download className="h-4 w-4" /> {dict.download}
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => {
                    toggleStar(menu.kind, menu.id, !menu.starred);
                    setMenu(null);
                  }}
                >
                  <Star className="h-4 w-4" /> {menu.starred ? dict.unstar : dict.star}
                </button>
                {menu.kind === "file" && (
                  <button
                    type="button"
                    onClick={() => {
                      openVersions(menu.id, menu.name);
                      setMenu(null);
                    }}
                  >
                    <History className="h-4 w-4" /> {dict.versions}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setRenameTarget({ kind: menu.kind, id: menu.id, name: menu.name });
                    setRenameValue(menu.name);
                    setMenu(null);
                  }}
                >
                  <FileText className="h-4 w-4" /> {dict.rename}
                </button>
                {nav === "drive" && (
                  <button
                    type="button"
                    onClick={() => {
                      setMoveTarget({ kind: menu.kind, id: menu.id, name: menu.name });
                      setMenu(null);
                    }}
                  >
                    <Folder className="h-4 w-4" /> {dict.move}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    openShare({
                      kind: menu.kind,
                      id: menu.id,
                      name: menu.name,
                      visibility: menu.visibility,
                      shareToken: menu.shareToken,
                    });
                    setMenu(null);
                  }}
                >
                  <Share2 className="h-4 w-4" /> {dict.share}
                </button>
                {menu.kind === "file" && isZip(menu.mimeType || "", menu.name) && (
                  <button
                    type="button"
                    onClick={() => {
                      unzipFile(menu.id);
                      setMenu(null);
                    }}
                  >
                    <Archive className="h-4 w-4" /> {dict.unzip}
                  </button>
                )}
                <div className="sep" />
                <button
                  type="button"
                  className="danger"
                  onClick={() => {
                    setConfirmState({
                      title: dict.delete,
                      message: dict.confirmDelete,
                      confirmLabel: dict.delete,
                      danger: true,
                      action: async () => softDelete(menu.kind, menu.id),
                    });
                    setMenu(null);
                  }}
                >
                  <Trash2 className="h-4 w-4" /> {dict.delete}
                </button>
              </>
            )}
          </div>
        )}

        {newFolderOpen && (
          <NewFolderModal
            dict={dict}
            value={newFolderName}
            busy={!!busy}
            onChange={setNewFolderName}
            onClose={() => setNewFolderOpen(false)}
            onCreate={createFolder}
          />
        )}
        {renameTarget && (
          <RenameModal
            dict={dict}
            value={renameValue}
            busy={!!busy}
            onChange={setRenameValue}
            onClose={() => setRenameTarget(null)}
            onSave={saveRename}
          />
        )}
        {shareTarget && (
          <ShareModal
            dict={dict}
            name={shareTarget.name}
            visibility={shareVisibility}
            password={sharePassword}
            shareUrl={shareUrl}
            busy={!!busy}
            onVisibility={setShareVisibility}
            onPassword={setSharePassword}
            onClose={() => setShareTarget(null)}
            onSave={saveShare}
          />
        )}
        {deleteChoice && (
          <DeleteModal
            dict={dict}
            name={deleteChoice.name}
            busy={!!busy}
            onClose={() => setDeleteChoice(null)}
            onTrash={async () => {
              await softDelete(deleteChoice.kind, deleteChoice.id);
              setDeleteChoice(null);
            }}
            onPermanent={async () => {
              const target = deleteChoice;
              setDeleteChoice(null);
              if (!target) return;
              setConfirmState({
                title: dict.deleteForever,
                message: dict.confirmPermanent,
                confirmLabel: dict.deleteForever,
                danger: true,
                action: async () => permanentDelete(target.kind, target.id),
              });
            }}
          />
        )}
        {preview && (
          <PreviewModal
            dict={dict}
            id={preview.id}
            name={preview.name}
            mimeType={preview.mimeType}
            onClose={() => setPreview(null)}
          />
        )}
        {versionsFor && (
          <VersionsModal
            dict={dict}
            versions={versions}
            busy={versionsBusy}
            onClose={() => setVersionsFor(null)}
            onPreview={(v) => {
              setPreview({ id: v.id, name: v.name, mimeType: v.mimeType });
              setVersionsFor(null);
            }}
          />
        )}
        {moveTarget && (
          <MoveModal
            dict={dict}
            busy={!!busy}
            currentParentId={folderId}
            excludeIds={
              moveTarget.id === "__multi__"
                ? Array.from(selected)
                    .filter((k) => k.startsWith("folder:"))
                    .map((k) => k.split(":")[1])
                : moveTarget.kind === "folder"
                  ? [moveTarget.id]
                  : []
            }
            onClose={() => setMoveTarget(null)}
            onMove={async (targetId) => {
              if (moveTarget.id === "__multi__") {
                await bulkMoveTo(targetId);
              } else {
                await moveItem(moveTarget.kind, moveTarget.id, targetId);
              }
            }}
          />
        )}
      {confirmState && (
          <ConfirmModal
            title={confirmState.title}
            message={confirmState.message}
            confirmLabel={confirmState.confirmLabel}
            cancelLabel={dict.cancel}
            danger={confirmState.danger}
            busy={!!busy}
            onClose={() => setConfirmState(null)}
            onConfirm={async () => {
              const action = confirmState.action;
              setConfirmState(null);
              await action();
            }}
          />
        )}

        {selected.size > 0 && nav !== "trash" && (
          <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-3 md:bottom-6">
            <div className="pointer-events-auto flex max-w-[min(100%,42rem)] flex-wrap items-center gap-1.5 rounded-2xl border tc-border bg-[var(--panel)]/95 px-2.5 py-1.5 text-xs shadow-2xl shadow-black/30 backdrop-blur-md sm:gap-2 sm:px-3">
              <span className="whitespace-nowrap rounded-full bg-[var(--surface-2)] px-2 py-1 font-medium tabular-nums text-[var(--text)]">
                {selected.size} {dict.selected}
              </span>
              <div className="w-[9.5rem] sm:w-44">
                <Select
                  size="sm"
                  value={bulkAction}
                  options={[
                    ...(nav === "drive" ? [{ value: "zip", label: dict.zip }] : []),
                    { value: "star", label: dict.bulkStar },
                    { value: "unstar", label: dict.bulkUnstar },
                    ...(nav === "drive" ? [{ value: "move", label: dict.multiMove }] : []),
                    ...(nav === "drive" ? [{ value: "delete", label: dict.delete }] : []),
                  ]}
                  onChange={(v) => setBulkAction(v as typeof bulkAction)}
                />
              </div>
              <Button size="sm" variant="primary" className="h-8 px-2.5" disabled={!!busy} onClick={applyBulkAction}>
                {dict.applyAction}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 px-2"
                onClick={() => setSelected(new Set())}
                title={dict.clearSelectionBtn}
                aria-label={dict.clearSelectionBtn}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        <UploadProgressPanel
          dict={dict}
          jobs={uploadJobs}
          onClose={() => setUploadJobs([])}
          onCancelQueued={() => {
            cancelQueuedRef.current = true;
            uploadAbortRef.current?.abort();
            setUploadJobs((prev) =>
              prev.map((j) =>
                j.status === "queued" || j.status === "uploading"
                  ? { ...j, status: j.status === "uploading" ? "cancelled" : "cancelled" }
                  : j,
              ),
            );
          }}
        />
      </div>
    </ThemeProvider>
  );
}
