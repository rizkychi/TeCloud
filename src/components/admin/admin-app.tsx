"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  HardDrive,
  LogOut,
  Shield,
  Users,
  Files,
  Folder,
  Share2,
  Star,
  UserCheck,
  UserX,
  Trash2,
  KeyRound,
  Palette,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Select } from "@/components/ui/select";
import { LoadingOverlay, Spinner } from "@/components/ui/loading";
import { ToastHost, pushToast } from "@/components/ui/toast";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { ThemeProvider } from "@/components/theme-provider";
import { BrandLogo } from "@/components/brand-logo";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { SessionUser } from "@/lib/auth";
import { formatBytes } from "@/lib/format";
import { THEME_PRESETS, bytesToGb } from "@/lib/units";

type Stats = {
  totals: {
    users: number;
    activeUsers: number;
    disabledUsers: number;
    admins: number;
    files: number;
    folders: number;
    starredFiles: number;
    starredFolders: number;
    sharedFiles: number;
    storageBytes: number;
    storageGb: number;
    avgFileBytes: number;
    defaultQuotaBytes: number;
    defaultQuotaGb: number;
    defaultQuotaUnlimited?: boolean;
  };
  recentUsers: Array<{
    id: string;
    username: string;
    name: string;
    createdAt: string;
    role: string;
    disabled: boolean;
  }>;
  topUsers: Array<{
    userId: string;
    username: string;
    name: string;
    files: number;
    bytes: number;
    gb: number;
  }>;
  uploadsByDay: Array<{ date: string; count: number; bytes: number; gb: number }>;
  signupsByDay: Array<{ date: string; count: number }>;
  mimeBreakdown: Array<{ mimeType: string; count: number; bytes: number }>;
};

type AdminUser = {
  id: string;
  username: string;
  name: string;
  role: "user" | "admin";
  locale: string;
  disabled: boolean;
  verified: boolean;
  telegramId: string | null;
  theme: string;
  quotaBytes: number | null;
  quotaGb: number | null;
  quotaUnlimited?: boolean;
  quotaMode?: "default" | "unlimited" | "custom";
  effectiveQuotaBytes: number;
  effectiveQuotaGb: number;
  usedBytes: number;
  usedGb: number;
  fileCount: number;
  folderCount: number;
  sessionCount: number;
  createdAt: string;
};

export function AdminApp({
  dict,
  locale,
  user,
}: {
  dict: Dictionary;
  locale: string;
  user: SessionUser;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"dashboard" | "users" | "settings">("dashboard");
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [defaultQuotaGb, setDefaultQuotaGb] = useState(5);
  const [defaultQuotaInput, setDefaultQuotaInput] = useState("5");
  const [defaultQuotaUnlimited, setDefaultQuotaUnlimited] = useState(false);
  const [defaultTheme, setDefaultTheme] = useState("dark");
  const [allowedThemes, setAllowedThemes] = useState<string[]>(THEME_PRESETS.map((t) => t.id));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [quotaDrafts, setQuotaDrafts] = useState<Record<string, string>>({});
  const [passwordDrafts, setPasswordDrafts] = useState<Record<string, string>>({});
  const [theme, setTheme] = useState(user.theme || "dark");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [quotaPopup, setQuotaPopup] = useState<{
    id: string;
    name: string;
    quotaGb: number | null;
    mode: "default" | "unlimited" | "custom";
  } | null>(null);
  const [quotaPopupMode, setQuotaPopupMode] = useState<"default" | "unlimited" | "custom">("default");
  const [quotaPopupValue, setQuotaPopupValue] = useState("");
  const [passwordPopup, setPasswordPopup] = useState<{ id: string; name: string } | null>(null);
  const [passwordPopupValue, setPasswordPopupValue] = useState("");
  const [userFilter, setUserFilter] = useState<"all" | "active" | "disabled" | "verified" | "unverified">("all");

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const [s, u, st] = await Promise.all([
        fetch("/api/admin/stats"),
        fetch("/api/admin/users"),
        fetch("/api/admin/settings"),
      ]);
      if (s.status === 401 || u.status === 401) {
        router.push("/login");
        return;
      }
      if (s.status === 403 || u.status === 403) {
        router.push("/app");
        return;
      }
      const sj = await s.json();
      const uj = await u.json();
      const stj = await st.json();
      if (!s.ok) throw new Error(sj?.error?.message || dict.errorGeneric);
      if (!u.ok) throw new Error(uj?.error?.message || dict.errorGeneric);
      setStats(sj);
      setUsers(uj.users || []);
      const drafts: Record<string, string> = {};
      for (const row of uj.users || []) {
        drafts[row.id] = row.quotaGb != null ? String(row.quotaGb) : "";
      }
      setQuotaDrafts(drafts);
      const unlimited =
        Boolean(stj.defaultQuotaUnlimited) ||
        Boolean(sj.totals?.defaultQuotaUnlimited) ||
        Number(stj.defaultQuotaBytes) === 0 ||
        Number(sj.totals?.defaultQuotaBytes) === 0;
      const dq = unlimited ? 0 : (stj.defaultQuotaGb ?? sj.totals?.defaultQuotaGb ?? 5);
      setDefaultQuotaUnlimited(unlimited);
      setDefaultQuotaGb(unlimited ? 0 : dq);
      setDefaultQuotaInput(unlimited ? "" : String(dq));
      setDefaultTheme(stj.defaultTheme || "dark");
      setAllowedThemes(stj.allowedThemes || THEME_PRESETS.map((t) => t.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : dict.errorGeneric);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (userFilter === "active") return !u.disabled;
      if (userFilter === "disabled") return u.disabled;
      if (userFilter === "verified") return u.verified;
      if (userFilter === "unverified") return !u.verified;
      return true;
    });
  }, [users, userFilter]);

  async function updateUser(id: string, patch: Record<string, unknown>, label?: string) {
    setBusy(label || dict.saving);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) throw new Error(j?.error?.message || dict.errorGeneric);
      await loadAll();
      pushToast("success", dict.toastSaved);
    } catch (e) {
      const msg = e instanceof Error ? e.message : dict.errorGeneric;
      setError(msg);
      pushToast("error", msg);
    } finally {
      setBusy(null);
    }
  }

  async function deleteUser(id: string) {
    setBusy(dict.processing);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
      const j = await res.json().catch(() => null);
      if (!res.ok) throw new Error(j?.error?.message || dict.errorGeneric);
      await loadAll();
      pushToast("success", dict.saved);
    } catch (e) {
      const msg = e instanceof Error ? e.message : dict.errorGeneric;
      setError(msg);
      pushToast("error", msg);
    } finally {
      setBusy(null);
      setConfirmDeleteId(null);
    }
  }

  async function saveSettings() {
    let defaultQuotaGbPayload: number;
    if (defaultQuotaUnlimited) {
      defaultQuotaGbPayload = 0;
    } else {
      const n = Number(String(defaultQuotaInput).replace(",", "."));
      if (!Number.isFinite(n) || n <= 0) {
        setError(dict.errorGeneric);
        pushToast("error", dict.errorGeneric);
        return;
      }
      defaultQuotaGbPayload = n;
    }
    setBusy(dict.saving);
    setError(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          defaultQuotaGb: defaultQuotaGbPayload,
          defaultTheme,
          allowedThemes,
        }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) throw new Error(j?.error?.message || dict.errorGeneric);
      setDefaultQuotaGb(j.defaultQuotaGb);
      setDefaultTheme(j.defaultTheme);
      setAllowedThemes(j.allowedThemes || []);
      await loadAll();
      pushToast("success", dict.toastSaved);
    } catch (e) {
      const msg = e instanceof Error ? e.message : dict.errorGeneric;
      setError(msg);
      pushToast("error", msg);
    } finally {
      setBusy(null);
    }
  }

  const maxUploadBar = useMemo(
    () => Math.max(1, ...(stats?.uploadsByDay.map((d) => d.count) || [1])),
    [stats],
  );
  const maxSignupBar = useMemo(
    () => Math.max(1, ...(stats?.signupsByDay.map((d) => d.count) || [1])),
    [stats],
  );
  const maxMime = useMemo(
    () => Math.max(1, ...(stats?.mimeBreakdown.map((m) => m.count) || [1])),
    [stats],
  );

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
        <aside className="hidden w-64 shrink-0 border-r tc-border bg-[var(--panel)] p-4 md:flex md:flex-col">
          <div className="mb-8 flex items-center gap-2 px-2">
            <BrandLogo size={36} />
            <div>
              <div className="text-sm font-medium">{dict.admin}</div>
              <div className="text-[10px] text-[var(--faint)]">{dict.appName}</div>
            </div>
          </div>
          <nav className="space-y-1">
            {(
              [
                ["dashboard", dict.adminDashboard],
                ["users", dict.adminUsers],
                ["settings", dict.adminSettings],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setTab(k)}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                  tab === k ? "tc-selected" : "text-[var(--muted)] tc-hover"
                }`}
              >
                {label}
              </button>
            ))}
          </nav>
          <div className="mt-auto space-y-2 border-t tc-border pt-4">
            <Button variant="ghost" className="w-full" onClick={() => router.push("/app")}>
              <ArrowLeft className="h-4 w-4" />
              {dict.backToDrive}
            </Button>
            <Button
              variant="ghost"
              className="w-full"
              onClick={async () => {
                setBusy(dict.processing);
                await fetch("/api/auth/logout", { method: "POST" });
                router.push("/login");
              }}
            >
              <LogOut className="h-4 w-4" />
              {dict.signOut}
            </Button>
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between border-b tc-border bg-[var(--panel)] px-4 py-3">
            <div className="flex items-center gap-2 text-sm">
              <BrandLogo size={20} rounded="lg" />
              <span className="font-medium">{dict.admin}</span>
              <span className="text-[var(--faint)]">· {user.username}</span>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="subtle" onClick={() => router.push("/app")}>
                {dict.backToDrive}
              </Button>
            </div>
          </header>

          <div className="flex-1 p-4 md:p-6">
            {error && (
              <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {error}
              </div>
            )}
            {loading || !stats ? (
              <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
                <Spinner /> {dict.loading}
              </div>
            ) : tab === "dashboard" ? (
              <div className="space-y-6">
                <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                  <StatCard
                    icon={<Users className="h-4 w-4" />}
                    tint="sky"
                    label={dict.totalUsers}
                    value={String(stats.totals.users)}
                    sub={`${stats.totals.activeUsers} ${dict.userActive} · ${stats.totals.disabledUsers} ${dict.disabledUsers} · ${stats.totals.admins} ${dict.admin}`}
                  />
                  <StatCard
                    icon={<Files className="h-4 w-4" />}
                    tint="violet"
                    label={dict.totalFiles}
                    value={String(stats.totals.files)}
                    sub={`${stats.totals.folders} ${dict.totalFolders}`}
                  />
                  <StatCard
                    icon={<HardDrive className="h-4 w-4" />}
                    tint="emerald"
                    label={dict.totalStorage}
                    value={formatBytes(stats.totals.storageBytes)}
                    sub={`${dict.avgFileSize}: ${formatBytes(stats.totals.avgFileBytes)}`}
                  />
                  <StatCard
                    icon={<Share2 className="h-4 w-4" />}
                    tint="amber"
                    label={dict.sharedFiles}
                    value={String(stats.totals.sharedFiles)}
                    sub={dict.sharedFilesHint}
                  />
                  <StatCard
                    icon={<Star className="h-4 w-4" />}
                    tint="indigo"
                    label={dict.starred}
                    value={String(stats.totals.starredFiles + stats.totals.starredFolders)}
                    sub={`${stats.totals.starredFiles} ${dict.file} · ${stats.totals.starredFolders} ${dict.folder}`}
                  />
                  <StatCard
                    icon={<Folder className="h-4 w-4" />}
                    tint="rose"
                    label={dict.defaultQuota}
                    value={
                      stats.totals.defaultQuotaUnlimited || stats.totals.defaultQuotaBytes === 0
                        ? "∞"
                        : formatBytes(stats.totals.defaultQuotaBytes)
                    }
                    sub={
                      stats.totals.defaultQuotaUnlimited || stats.totals.defaultQuotaBytes === 0
                        ? dict.quotaUnlimited
                        : dict.defaultQuotaHint
                    }
                  />
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-2xl border tc-border bg-[var(--panel)] p-4">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <h3 className="text-sm font-medium">{dict.uploadsChart}</h3>
                      <span className="text-[10px] text-[var(--faint)]">max {maxUploadBar}</span>
                    </div>
                    <div className="chart-wrap">
                      <div className="chart-y" aria-hidden>
                        <span>{maxUploadBar}</span>
                        <span>{Math.round(maxUploadBar / 2)}</span>
                        <span>0</span>
                      </div>
                      <div className="chart-bars">
                        {stats.uploadsByDay.map((d) => (
                          <div
                            key={d.date}
                            className="bar"
                            style={{ height: `${Math.max(6, (d.count / maxUploadBar) * 100)}%` }}
                          >
                            <span className="chart-bar-tip">
                              {d.date}: {d.count} · {formatBytes(d.bytes)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="mt-2 flex justify-between pl-8 text-[10px] text-[var(--faint)]">
                      <span>{stats.uploadsByDay[0]?.date}</span>
                      <span>{stats.uploadsByDay[stats.uploadsByDay.length - 1]?.date}</span>
                    </div>
                  </div>

                  <div className="rounded-2xl border tc-border bg-[var(--panel)] p-4">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <h3 className="text-sm font-medium">{dict.signupsChart}</h3>
                      <span className="text-[10px] text-[var(--faint)]">max {maxSignupBar}</span>
                    </div>
                    <div className="chart-wrap">
                      <div className="chart-y" aria-hidden>
                        <span>{maxSignupBar}</span>
                        <span>{Math.round(maxSignupBar / 2)}</span>
                        <span>0</span>
                      </div>
                      <div className="chart-bars">
                        {stats.signupsByDay.map((d) => (
                          <div
                            key={d.date}
                            className="bar"
                            style={{
                              height: `${Math.max(6, (d.count / maxSignupBar) * 100)}%`,
                              background:
                                "linear-gradient(180deg, var(--accent), color-mix(in srgb, var(--accent) 50%, var(--brand)))",
                            }}
                          >
                            <span className="chart-bar-tip">
                              {d.date}: {d.count}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="mt-2 flex justify-between pl-8 text-[10px] text-[var(--faint)]">
                      <span>{stats.signupsByDay[0]?.date}</span>
                      <span>{stats.signupsByDay[stats.signupsByDay.length - 1]?.date}</span>
                    </div>
                  </div>

                  <div className="rounded-2xl border tc-border bg-[var(--panel)] p-4">
                    <h3 className="mb-4 text-sm font-medium">{dict.topUsers}</h3>
                    <div className="space-y-2">
                      {stats.topUsers.length === 0 && (
                        <p className="text-sm text-[var(--muted)]">{dict.noItems}</p>
                      )}
                      {stats.topUsers.map((u) => (
                        <div key={u.userId} className="flex items-center justify-between rounded-lg border tc-border px-3 py-2 text-sm">
                          <div className="min-w-0">
                            <div className="truncate font-medium">{u.name}</div>
                            <div className="truncate text-xs text-[var(--muted)]">@{u.username}</div>
                          </div>
                          <div className="text-right text-xs text-[var(--muted)]">
                            <div className="tabular-nums text-[var(--text)]">{formatBytes(u.bytes)}</div>
                            <div>
                              {u.files} {dict.items}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border tc-border bg-[var(--panel)] p-4">
                    <h3 className="mb-4 text-sm font-medium">{dict.mimeChart}</h3>
                    <div className="space-y-3">
                      {stats.mimeBreakdown.length === 0 && (
                        <p className="text-sm text-[var(--muted)]">{dict.noItems}</p>
                      )}
                      {stats.mimeBreakdown.map((m) => (
                        <div key={m.mimeType}>
                          <div className="mb-1 flex justify-between text-xs">
                            <span className="truncate text-[var(--text-2)]">{m.mimeType}</span>
                            <span className="text-[var(--muted)]">
                              {m.count} · {formatBytes(m.bytes)}
                            </span>
                          </div>
                          <div className="quota-bar">
                            <span style={{ width: `${Math.max(4, (m.count / maxMime) * 100)}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : tab === "users" ? (
              <div className="overflow-hidden rounded-2xl border tc-border bg-[var(--panel)]">
                <div className="flex flex-wrap items-center gap-2 border-b tc-border px-4 py-3">
                  <div className="w-48">
                    <Select
                      value={userFilter}
                      options={[
                        { value: "all", label: dict.userFilterAll },
                        { value: "active", label: dict.userFilterActive },
                        { value: "disabled", label: dict.userFilterDisabled },
                        { value: "verified", label: dict.userFilterVerified },
                        { value: "unverified", label: dict.userFilterUnverified },
                      ]}
                      onChange={(v) => setUserFilter(v as typeof userFilter)}
                    />
                  </div>
                  <span className="text-xs text-[var(--muted)]">
                    {filteredUsers.length} / {users.length}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[920px] text-left text-sm">
                    <thead className="border-b tc-border text-xs text-[var(--muted)]">
                      <tr>
                        <th className="px-4 py-3">{dict.name}</th>
                        <th className="px-4 py-3">{dict.role}</th>
                        <th className="px-4 py-3">{dict.status}</th>
                        <th className="px-4 py-3">{dict.quotaGb}</th>
                        <th className="px-4 py-3">{dict.adminActions}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map((u) => (
                        <tr key={u.id} className="border-b border-[var(--border-subtle)] align-top">
                          <td className="px-4 py-3">
                            <div className="font-medium">{u.name}</div>
                            <div className="text-xs text-[var(--muted)]">@{u.username}</div>
                            <div className="mt-1 flex flex-wrap gap-1">
                              <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] ${u.verified ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-200"}`}>
                                {u.verified ? dict.statusVerified : dict.statusUnverified}
                              </span>
                              {u.telegramId && (
                                <span className="inline-flex rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] text-sky-200">
                                  TG {u.telegramId}
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-[var(--faint)]">
                              {u.fileCount} files · {formatBytes(u.usedBytes)} used · {new Date(u.createdAt).toLocaleString(locale)}
                            </div>
                          </td>
                          <td className="px-4 py-3 w-36">
                            <Select
                              value={u.role}
                              options={[
                                { value: "user", label: "user" },
                                { value: "admin", label: "admin" },
                              ]}
                              onChange={(role) => updateUser(u.id, { role })}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-[11px] ${
                                u.disabled
                                  ? "bg-red-500/15 text-red-300"
                                  : "bg-emerald-500/15 text-emerald-300"
                              }`}
                            >
                              {u.disabled ? dict.userDisabled : dict.userActive}
                            </span>
                          </td>
                          <td className="px-4 py-3 w-48">
                            {(() => {
                              const unlimited =
                                u.quotaUnlimited ||
                                u.quotaMode === "unlimited" ||
                                u.effectiveQuotaBytes === 0;
                              const inheritDefault = u.quotaMode === "default" || u.quotaGb == null;
                              return (
                                <>
                                  <div
                                    className={`text-xs text-[var(--muted)] ${unlimited ? "" : "mb-1"}`}
                                  >
                                    {unlimited ? (
                                      <>
                                        {formatBytes(u.usedBytes)} /{" "}
                                        <span className="text-base leading-none text-[var(--text)]">∞</span>
                                        {inheritDefault
                                          ? ` (${dict.useDefaultQuota})`
                                          : ` (${dict.quotaUnlimited})`}
                                      </>
                                    ) : (
                                      <>
                                        {formatBytes(u.usedBytes)} / {formatBytes(u.effectiveQuotaBytes)}
                                        {inheritDefault ? ` (${dict.useDefaultQuota})` : ""}
                                      </>
                                    )}
                                  </div>
                                  {!unlimited && (
                                    <div className="quota-bar">
                                      <span
                                        style={{
                                          width: `${Math.min(
                                            100,
                                            u.effectiveQuotaBytes
                                              ? (u.usedBytes / u.effectiveQuotaBytes) * 100
                                              : 0,
                                          )}%`,
                                        }}
                                      />
                                    </div>
                                  )}
                                </>
                              );
                            })()}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <Button
                                size="icon"
                                variant="subtle"
                                title={u.disabled ? dict.enableUser : dict.disableUser}
                                onClick={() =>
                                  updateUser(
                                    u.id,
                                    { disabled: !u.disabled },
                                    u.disabled ? dict.enableUser : dict.disableUser,
                                  )
                                }
                              >
                                {u.disabled ? <UserCheck className="h-4 w-4" /> : <UserX className="h-4 w-4" />}
                              </Button>
                              <Button
                                size="icon"
                                variant="subtle"
                                title={dict.setQuotaPopup}
                                onClick={() => {
                                  const mode =
                                    u.quotaMode ||
                                    (u.quotaGb == null
                                      ? "default"
                                      : u.quotaGb === 0 || u.quotaUnlimited
                                        ? "unlimited"
                                        : "custom");
                                  setQuotaPopup({ id: u.id, name: u.name, quotaGb: u.quotaGb, mode });
                                  setQuotaPopupMode(mode);
                                  setQuotaPopupValue(
                                    mode === "custom" && u.quotaGb != null ? String(u.quotaGb) : "",
                                  );
                                }}
                              >
                                <HardDrive className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="subtle"
                                title={dict.resetPasswordPopup}
                                onClick={() => {
                                  setPasswordPopup({ id: u.id, name: u.name });
                                  setPasswordPopupValue("");
                                }}
                              >
                                <KeyRound className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="subtle"
                                className="text-[var(--danger)]"
                                title={dict.deleteUser}
                                onClick={() => setConfirmDeleteId(u.id)}
                                disabled={u.id === user.id}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="max-w-xl space-y-5 rounded-2xl border tc-border bg-[var(--panel)] p-5">
                <h3 className="text-sm font-medium">{dict.adminSettings}</h3>
                <div className="space-y-2">
                  <label className="text-xs text-[var(--muted)]">{dict.defaultQuota}</label>
                  <label className="flex items-center gap-2 text-sm text-[var(--text)]">
                    <input
                      type="checkbox"
                      checked={defaultQuotaUnlimited}
                      onChange={(e) => {
                        const on = e.target.checked;
                        setDefaultQuotaUnlimited(on);
                        if (on) setDefaultQuotaInput("");
                        else if (!defaultQuotaInput) setDefaultQuotaInput("5");
                      }}
                      className="h-4 w-4 rounded border tc-border"
                    />
                    {dict.quotaUnlimited}
                  </label>
                  {!defaultQuotaUnlimited && (
                    <NumberInput
                      step={0.1}
                      min={0.1}
                      value={defaultQuotaInput}
                      onChange={setDefaultQuotaInput}
                    />
                  )}
                  <p className="text-xs text-[var(--faint)]">
                    {defaultQuotaUnlimited
                      ? dict.quotaHintUnlimited
                      : `Current: ${defaultQuotaGb} GB (${formatBytes(Math.round(defaultQuotaGb * 1024 ** 3))})`}
                  </p>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-[var(--muted)]">{dict.defaultTheme}</label>
                  <Select
                    value={defaultTheme}
                    options={THEME_PRESETS.map((t) => ({ value: t.id, label: themeLabel(t.id) }))}
                    onChange={setDefaultTheme}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-[var(--muted)] flex items-center gap-2">
                    <Palette className="h-3.5 w-3.5" /> {dict.allowedThemes}
                  </label>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {THEME_PRESETS.map((t) => {
                      const on = allowedThemes.includes(t.id);
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => {
                            setAllowedThemes((prev) => {
                              if (on) {
                                const next = prev.filter((x) => x !== t.id);
                                return next.length ? next : prev;
                              }
                              return [...prev, t.id];
                            });
                          }}
                          className={`rounded-xl border px-3 py-2 text-left text-sm ${
                            on ? "tc-selected border-[var(--brand)]" : "tc-border tc-hover"
                          }`}
                        >
                          {themeLabel(t.id)}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-[var(--faint)]">
                    Tema dark/light saat ini disimpan; admin bisa menambah Ocean / Forest / Sunset.
                  </p>
                </div>
                <Button variant="primary" onClick={saveSettings} disabled={Boolean(busy)}>
                  {busy ? <Spinner className="h-4 w-4" /> : null}
                  {dict.saveSettings}
                </Button>
              </div>
            )}
          </div>
        </main>
      </div>
      {quotaPopup && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border tc-border bg-[var(--surface)] p-4 shadow-[var(--shadow)]">
            <h2 className="mb-1 text-sm font-medium">{dict.setQuotaPopup}</h2>
            <p className="mb-3 text-xs text-[var(--muted)]">{quotaPopup.name}</p>
            <div className="mb-3 space-y-2">
              {(
                [
                  ["default", dict.useDefaultQuota],
                  ["unlimited", dict.quotaUnlimited],
                  ["custom", dict.quotaCustom],
                ] as const
              ).map(([mode, label]) => (
                <label key={mode} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="quota-mode"
                    checked={quotaPopupMode === mode}
                    onChange={() => setQuotaPopupMode(mode)}
                    className="h-4 w-4"
                  />
                  {label}
                </label>
              ))}
            </div>
            {quotaPopupMode === "custom" && (
              <>
                <label className="mb-1 block text-xs text-[var(--muted)]">{dict.quotaGb}</label>
                <NumberInput
                  step={0.1}
                  min={0.1}
                  placeholder={defaultQuotaUnlimited ? "5" : String(defaultQuotaGb || 5)}
                  value={quotaPopupValue}
                  onChange={setQuotaPopupValue}
                />
              </>
            )}
            <p className="mt-2 text-[11px] text-[var(--faint)]">
              {quotaPopupMode === "default"
                ? dict.quotaHintDefault
                : quotaPopupMode === "unlimited"
                  ? dict.quotaHintUnlimited
                  : dict.quotaGb}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setQuotaPopup(null)} disabled={!!busy}>{dict.cancel}</Button>
              <Button
                variant="primary"
                disabled={!!busy}
                onClick={async () => {
                  let quotaGb: number | null;
                  if (quotaPopupMode === "default") quotaGb = null;
                  else if (quotaPopupMode === "unlimited") quotaGb = 0;
                  else {
                    const n = Number(quotaPopupValue.replace(",", "."));
                    if (!Number.isFinite(n) || n <= 0) {
                      setError(dict.errorGeneric);
                      pushToast("error", dict.errorGeneric);
                      return;
                    }
                    quotaGb = n;
                  }
                  await updateUser(quotaPopup.id, { quotaGb }, dict.setQuotaPopup);
                  setQuotaPopup(null);
                }}
              >
                {busy ? <Spinner className="h-4 w-4" /> : null}
                {dict.save}
              </Button>
            </div>
          </div>
        </div>
      )}
      {passwordPopup && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border tc-border bg-[var(--surface)] p-4 shadow-[var(--shadow)]">
            <h2 className="mb-1 text-sm font-medium">{dict.resetPasswordPopup}</h2>
            <p className="mb-3 text-xs text-[var(--muted)]">{passwordPopup.name}</p>
            <label className="mb-1 block text-xs text-[var(--muted)]">{dict.newPassword}</label>
            <Input
              type="password"
              value={passwordPopupValue}
              onChange={(e) => setPasswordPopupValue(e.target.value)}
              placeholder={dict.newPassword}
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setPasswordPopup(null)} disabled={!!busy}>{dict.cancel}</Button>
              <Button
                variant="primary"
                disabled={!!busy}
                onClick={async () => {
                  const pw = passwordPopupValue.trim();
                  if (pw.length < 8) {
                    setError(dict.errorGeneric);
                    pushToast("error", dict.errorGeneric);
                    return;
                  }
                  await updateUser(passwordPopup.id, { password: pw }, dict.resetPassword);
                  setPasswordPopup(null);
                  setPasswordPopupValue("");
                }}
              >
                {busy ? <Spinner className="h-4 w-4" /> : null}
                {dict.save}
              </Button>
            </div>
          </div>
        </div>
      )}
      {confirmDeleteId && (
        <ConfirmModal
          title={dict.deleteUser}
          message={dict.confirmDeleteUser}
          confirmLabel={dict.deleteUser}
          cancelLabel={dict.cancel}
          danger
          busy={!!busy}
          onClose={() => setConfirmDeleteId(null)}
          onConfirm={async () => {
            const id = confirmDeleteId;
            if (id) await deleteUser(id);
          }}
        />
      )}
    </ThemeProvider>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
  tint = "indigo",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  tint?: "sky" | "emerald" | "violet" | "amber" | "rose" | "indigo";
}) {
  return (
    <div className="stat-card">
      <div className={`stat-icon tint-${tint}`}>{icon}</div>
      <div className="min-w-0">
        <div className="stat-label">{label}</div>
        <div className="stat-value">{value}</div>
        {sub ? <div className="stat-sub">{sub}</div> : null}
      </div>
    </div>
  );
}
