"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export type UploadJob = {
  id: string;
  name: string;
  size: number;
  progress: number; // 0-100
  status: "queued" | "uploading" | "done" | "error" | "cancelled";
  error?: string;
};

export function UploadProgressPanel({
  dict,
  jobs,
  onClose,
  onCancelQueued,
}: {
  dict: Dictionary;
  jobs: UploadJob[];
  onClose: () => void;
  onCancelQueued: () => void;
}) {
  if (!jobs.length) return null;
  const active = jobs.some((j) => j.status === "queued" || j.status === "uploading");
  return (
    <div className="upload-panel">
      <div className="upload-panel-header">
        <span>
          {dict.uploadProgress}
          {active ? "…" : ""}
        </span>
        <div className="flex items-center gap-1">
          {jobs.some((j) => j.status === "queued") && (
            <Button size="sm" variant="subtle" onClick={onCancelQueued}>
              {dict.cancelUploads}
            </Button>
          )}
          <button type="button" className="tc-icon-btn !h-8 !w-8" onClick={onClose} title={dict.close}>
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="max-h-64 overflow-auto">
        {jobs.map((j) => (
          <div key={j.id} className="upload-row">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="truncate text-[var(--text-2)]" title={j.name}>
                {j.name}
              </span>
              <span className="shrink-0 text-[var(--muted)]">
                {j.status === "done"
                  ? "100%"
                  : j.status === "error"
                    ? "!"
                    : j.status === "cancelled"
                      ? "—"
                      : `${Math.round(j.progress)}%`}
              </span>
            </div>
            <div className={`upload-bar ${j.status === "error" ? "error" : ""}`}>
              <span
                style={{
                  width: `${j.status === "done" ? 100 : j.status === "cancelled" ? 0 : Math.max(2, j.progress)}%`,
                }}
              />
            </div>
            {j.error && <div className="mt-1 text-[10px] text-[var(--danger)]">{j.error}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

/** XHR upload with progress; returns parsed JSON + status */
export function uploadWithProgress(
  file: File,
  folderId: string | null,
  onProgress: (pct: number) => void,
  signal?: AbortSignal,
): Promise<{ ok: boolean; status: number; json: any }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/files");
    xhr.responseType = "json";
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.min(99, (e.loaded / e.total) * 100));
      else onProgress(50);
    };
    xhr.onload = () => {
      onProgress(100);
      resolve({
        ok: xhr.status >= 200 && xhr.status < 300,
        status: xhr.status,
        json: xhr.response || {},
      });
    };
    xhr.onerror = () => reject(new Error("Network error"));
    xhr.onabort = () => reject(new DOMException("Aborted", "AbortError"));
    if (signal) {
      if (signal.aborted) {
        xhr.abort();
        return;
      }
      signal.addEventListener("abort", () => xhr.abort(), { once: true });
    }
    const fd = new FormData();
    fd.append("file", file);
    if (folderId) fd.append("folderId", folderId);
    xhr.send(fd);
  });
}
