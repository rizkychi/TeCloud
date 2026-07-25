export function formatBytes(n: number) {
  if (!Number.isFinite(n) || n < 0) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

export function isImageMime(mime: string) {
  return mime.startsWith("image/");
}

export function isPreviewable(mime: string, name: string) {
  const m = mime || "";
  const lower = name.toLowerCase();
  return (
    m.startsWith("image/") ||
    m === "application/pdf" ||
    m.startsWith("text/") ||
    m === "application/json" ||
    lower.endsWith(".pdf") ||
    lower.endsWith(".txt") ||
    lower.endsWith(".md") ||
    lower.endsWith(".csv") ||
    lower.endsWith(".json")
  );
}

export function isZip(mime: string, name: string) {
  return mime === "application/zip" || name.toLowerCase().endsWith(".zip");
}
