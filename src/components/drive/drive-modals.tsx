"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/loading";
import { pushToast } from "@/components/ui/toast";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { isCodeLike, isImageMime } from "@/lib/format";
import { Link2 } from "lucide-react";

export function Modal({
  title,
  children,
  onClose,
  wide,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div
        role="dialog"
        aria-modal="true"
        className={`w-full ${wide ? "max-w-4xl" : "max-w-md"} rounded-2xl border tc-border bg-[var(--surface)] p-4 shadow-[var(--shadow)]`}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="truncate text-sm font-medium">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-[var(--muted)] hover:text-[var(--text)]"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function NewFolderModal({
  dict,
  value,
  busy,
  onChange,
  onClose,
  onCreate,
}: {
  dict: Dictionary;
  value: string;
  busy: boolean;
  onChange: (v: string) => void;
  onClose: () => void;
  onCreate: () => void;
}) {
  return (
    <Modal title={dict.newFolder} onClose={onClose}>
      <div className="space-y-3">
        <Input
          placeholder={dict.folderName}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoFocus
          onKeyDown={(e) => e.key === "Enter" && onCreate()}
        />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {dict.cancel}
          </Button>
          <Button variant="primary" onClick={onCreate} disabled={busy}>
            {busy ? <Spinner className="h-4 w-4" /> : null}
            {dict.create}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export function RenameModal({
  dict,
  value,
  busy,
  onChange,
  onClose,
  onSave,
}: {
  dict: Dictionary;
  value: string;
  busy: boolean;
  onChange: (v: string) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <Modal title={dict.rename} onClose={onClose}>
      <div className="space-y-3">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoFocus
          onKeyDown={(e) => e.key === "Enter" && onSave()}
        />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {dict.cancel}
          </Button>
          <Button variant="primary" onClick={onSave} disabled={busy}>
            {busy ? <Spinner className="h-4 w-4" /> : null}
            {dict.save}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export function ShareModal({
  dict,
  name,
  visibility,
  password,
  shareUrl,
  busy,
  onVisibility,
  onPassword,
  onClose,
  onSave,
}: {
  dict: Dictionary;
  name: string;
  visibility: "private" | "public" | "password";
  password: string;
  shareUrl: string | null;
  busy: boolean;
  onVisibility: (v: "private" | "public" | "password") => void;
  onPassword: (v: string) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <Modal title={`${dict.share}: ${name}`} onClose={onClose}>
      <div className="space-y-3">
        <Select
          value={visibility}
          options={[
            { value: "private", label: dict.visibilityPrivate },
            { value: "public", label: dict.visibilityPublic },
            { value: "password", label: dict.visibilityPassword },
          ]}
          onChange={(v) => onVisibility(v as "private" | "public" | "password")}
        />
        {visibility === "password" && (
          <div className="space-y-1.5">
            <Input
              type="password"
              placeholder={dict.setPassword}
              value={password}
              minLength={4}
              maxLength={128}
              onChange={(e) => onPassword(e.target.value)}
            />
            <p className="text-[11px] leading-relaxed text-[var(--faint)]">{dict.sharePasswordHint}</p>
            {password.length > 0 && password.length < 4 && (
              <p className="text-[11px] text-amber-300">{dict.sharePasswordTooShort}</p>
            )}
          </div>
        )}
        {shareUrl && (
          <div className="break-all rounded-lg border tc-border bg-[var(--surface-2)] p-2 text-xs text-[var(--text-2)]">
            {shareUrl}
          </div>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          {shareUrl && (
            <Button
              variant="ghost"
              onClick={async () => {
                await navigator.clipboard.writeText(shareUrl);
                pushToast("success", dict.toastCopied);
              }}
            >
              <Link2 className="h-4 w-4" /> {dict.copyLink}
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            {dict.close}
          </Button>
          <Button variant="primary" onClick={onSave} disabled={busy}>
            {busy ? <Spinner className="h-4 w-4" /> : null}
            {dict.save}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export function DeleteModal({
  dict,
  name,
  busy,
  onClose,
  onTrash,
  onPermanent,
}: {
  dict: Dictionary;
  name: string;
  busy: boolean;
  onClose: () => void;
  onTrash: () => void;
  onPermanent: () => void;
}) {
  return (
    <Modal title={name} onClose={onClose}>
      <p className="mb-4 text-sm text-[var(--muted)]">{dict.confirmDelete}</p>
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" onClick={onClose} disabled={busy}>
          {dict.cancel}
        </Button>
        <Button variant="ghost" onClick={onTrash} disabled={busy}>
          {busy ? <Spinner className="h-4 w-4" /> : null}
          {dict.moveToTrash}
        </Button>
        <Button variant="danger" onClick={onPermanent} disabled={busy}>
          {dict.deleteForever}
        </Button>
      </div>
    </Modal>
  );
}

export function PreviewModal({
  dict,
  id,
  name,
  mimeType,
  onClose,
}: {
  dict: Dictionary;
  id: string;
  name: string;
  mimeType: string;
  onClose: () => void;
}) {
  const isPdf = mimeType === "application/pdf" || name.toLowerCase().endsWith(".pdf");
  const isImage = isImageMime(mimeType);
  const codeLike = !isImage && !isPdf && isCodeLike(mimeType, name);

  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(codeLike);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!codeLike) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setText(null);
    (async () => {
      try {
        const res = await fetch(`/api/files/${id}/preview`);
        if (!res.ok) {
          const j = await res.json().catch(() => null);
          throw new Error(j?.error?.message || dict.errorGeneric);
        }
        const body = await res.text();
        if (!cancelled) setText(body);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : dict.errorGeneric);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [codeLike, id, dict.errorGeneric]);

  return (
    <Modal title={name} onClose={onClose} wide>
      <div className="max-h-[70vh] overflow-auto rounded-lg border tc-border bg-[var(--surface-2)] p-2">
        {isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/files/${id}/preview`}
            alt={name}
            className="mx-auto max-h-[65vh] object-contain"
          />
        ) : isPdf ? (
          <iframe
            title={name}
            src={`/api/files/${id}/preview`}
            className="h-[65vh] w-full rounded-md bg-white"
            sandbox=""
          />
        ) : codeLike ? (
          <div className="code-preview">
            {loading ? (
              <div className="flex items-center gap-2 p-4 text-sm text-[var(--muted)]">
                <Spinner /> {dict.loading}
              </div>
            ) : error ? (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
                {error}
              </div>
            ) : (
              <pre className="code-preview-pre" tabIndex={0}>
                <code>{text ?? ""}</code>
              </pre>
            )}
          </div>
        ) : (
          <div className="flex min-h-[12rem] flex-col items-center justify-center gap-2 p-6 text-center text-sm text-[var(--muted)]">
            <p>{dict.previewUnsupported}</p>
            <a
              className="inline-flex h-9 items-center rounded-lg border tc-border px-3 text-sm tc-hover"
              href={`/api/files/${id}/download`}
            >
              {dict.download}
            </a>
          </div>
        )}
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <a
          className="inline-flex h-9 items-center rounded-lg border tc-border px-3 text-sm tc-hover"
          href={`/api/files/${id}/download`}
        >
          {dict.download}
        </a>
        <Button variant="ghost" onClick={onClose}>
          {dict.close}
        </Button>
      </div>
    </Modal>
  );
}

export function VersionsModal({
  dict,
  versions,
  busy,
  onClose,
  onPreview,
}: {
  dict: Dictionary;
  versions: Array<{
    id: string;
    name: string;
    version: number;
    size: number;
    isLatest: boolean;
    createdAt: string;
    mimeType: string;
  }>;
  busy: boolean;
  onClose: () => void;
  onPreview: (v: { id: string; name: string; mimeType: string }) => void;
}) {
  return (
    <Modal title={dict.versions} onClose={onClose}>
      {busy ? (
        <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
          <Spinner /> {dict.loading}
        </div>
      ) : (
        <div className="max-h-80 space-y-2 overflow-auto">
          {versions.map((v) => (
            <div
              key={v.id}
              className="flex items-center justify-between gap-2 rounded-lg border tc-border px-3 py-2 text-sm"
            >
              <div className="min-w-0">
                <div className="font-medium">
                  {dict.version} {v.version}
                  {v.isLatest ? " · latest" : ""}
                </div>
                <div className="text-xs text-[var(--muted)]">
                  {new Date(v.createdAt).toLocaleString()} · {(v.size / 1024).toFixed(1)} KB
                </div>
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="subtle" onClick={() => onPreview(v)}>
                  {dict.preview}
                </Button>
                <a
                  className="inline-flex h-8 items-center rounded-lg border tc-border px-3 text-xs tc-hover"
                  href={`/api/files/${v.id}/download`}
                >
                  {dict.download}
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="mt-3 flex justify-end">
        <Button variant="ghost" onClick={onClose}>
          {dict.close}
        </Button>
      </div>
    </Modal>
  );
}
