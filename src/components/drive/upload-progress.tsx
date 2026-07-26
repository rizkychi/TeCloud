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
      let json: any = xhr.response;
      if (!json || typeof json !== "object") {
        try {
          json = JSON.parse(xhr.responseText || "{}");
        } catch {
          json = {};
        }
      }
      // Proxy/HTML error pages often have empty json
      if (!json?.error && xhr.status >= 400) {
        const text = (xhr.responseText || "").slice(0, 120);
        json = {
          error: {
            code: xhr.status === 413 ? "MAX_SIZE" : "UPLOAD_FAILED",
            message:
              xhr.status === 413
                ? "File too large for proxy/body limit"
                : text.startsWith("<") || !text
                  ? `Upload failed (HTTP ${xhr.status})`
                  : text,
          },
        };
      }
      resolve({
        ok: xhr.status >= 200 && xhr.status < 300,
        status: xhr.status,
        json: json || {},
      });
    };
    xhr.onerror = () => reject(new Error("Network error"));
    xhr.ontimeout = () => reject(new Error("Upload timed out"));
    xhr.onabort = () => reject(new DOMException("Aborted", "AbortError"));
    // Large files + Telegram storage can take a long time after 100% sent
    xhr.timeout = 0;
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
