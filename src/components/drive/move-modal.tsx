"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/loading";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { Folder, Home } from "lucide-react";

type FolderOption = { id: string | null; name: string; depth: number };

export function MoveModal({
  dict,
  busy,
  currentParentId,
  excludeIds,
  onClose,
  onMove,
}: {
  dict: Dictionary;
  busy: boolean;
  currentParentId: string | null;
  excludeIds: string[];
  onClose: () => void;
  onMove: (folderId: string | null) => void;
}) {
  const [options, setOptions] = useState<FolderOption[]>([]);
  const [selected, setSelected] = useState<string | null>(currentParentId);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        // fetch root folders then BFS shallow tree via repeated drive calls for depth<=3
        const acc: FolderOption[] = [{ id: null, name: dict.rootFolder, depth: 0 }];
        async function walk(parentId: string | null, depth: number) {
          if (depth > 4) return;
          const params = new URLSearchParams();
          params.set("folderId", parentId || "root");
          params.set("type", "folder");
          params.set("sort", "name");
          params.set("dir", "asc");
          const res = await fetch(`/api/drive?${params.toString()}`);
          const j = await res.json();
          if (!res.ok) throw new Error(j?.error?.message || dict.errorGeneric);
          for (const f of j.folders || []) {
            if (excludeIds.includes(f.id)) continue;
            acc.push({ id: f.id, name: f.name, depth });
            await walk(f.id, depth + 1);
          }
        }
        await walk(null, 1);
        if (!cancelled) setOptions(acc);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : dict.errorGeneric);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dict, excludeIds]);

  return (
    <div className="fixed inset-0 z-[105] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl border tc-border bg-[var(--surface)] p-4 shadow-[var(--shadow)]">
        <h2 className="mb-3 text-sm font-medium">{dict.moveTo}</h2>
        {error && (
          <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {error}
          </div>
        )}
        {loading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-[var(--muted)]">
            <Spinner /> {dict.loading}
          </div>
        ) : (
          <div className="mb-4 max-h-72 space-y-1 overflow-auto rounded-xl border tc-border p-1">
            {options.map((o) => (
              <button
                key={String(o.id)}
                type="button"
                onClick={() => setSelected(o.id)}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm tc-hover ${
                  selected === o.id ? "tc-selected" : ""
                }`}
                style={{ paddingLeft: 12 + o.depth * 14 }}
              >
                {o.id == null ? (
                  <Home className="h-4 w-4 text-[var(--brand)]" />
                ) : (
                  <Folder className="h-4 w-4 text-[var(--accent)]" />
                )}
                <span className="truncate">{o.name}</span>
              </button>
            ))}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {dict.cancel}
          </Button>
          <Button variant="primary" disabled={busy || loading} onClick={() => onMove(selected)}>
            {busy ? <Spinner className="h-4 w-4" /> : null}
            {dict.moveHere}
          </Button>
        </div>
      </div>
    </div>
  );
}
