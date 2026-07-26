export function formatBytes(n: number, opts?: { digits?: number }) {
  if (!Number.isFinite(n) || n < 0) return "—";
  const units = ["B", "KB", "MB", "GB", "TB", "PB", "EB"] as const;
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  const digits =
    opts?.digits ??
    (i === 0 ? 0 : i <= 2 ? 1 : v >= 100 ? 0 : v >= 10 ? 1 : 2);
  const fixed = i === 0 ? String(Math.round(v)) : v.toFixed(digits);
  // trim trailing zeros for nicer large units (1.00 TB -> 1 TB)
  const pretty = i === 0 ? fixed : fixed.replace(/\.0+$/, "").replace(/(\.\d*[1-9])0+$/, "$1");
  return `${pretty} ${units[i]}`;
}

export function isImageMime(mime: string) {
  return mime.startsWith("image/");
}

/** Extensions commonly shown as read-only code (never executed). */
const CODE_EXT = [
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".ts",
  ".tsx",
  ".py",
  ".rb",
  ".php",
  ".java",
  ".go",
  ".rs",
  ".c",
  ".cc",
  ".cpp",
  ".h",
  ".hpp",
  ".cs",
  ".swift",
  ".kt",
  ".kts",
  ".scala",
  ".sh",
  ".bash",
  ".zsh",
  ".ps1",
  ".bat",
  ".cmd",
  ".sql",
  ".html",
  ".htm",
  ".css",
  ".scss",
  ".sass",
  ".less",
  ".xml",
  ".yaml",
  ".yml",
  ".toml",
  ".ini",
  ".env",
  ".json",
  ".jsonc",
  ".md",
  ".mdx",
  ".txt",
  ".csv",
  ".log",
  ".conf",
  ".cfg",
  ".dockerfile",
  ".vue",
  ".svelte",
  ".graphql",
  ".gql",
  ".r",
  ".lua",
  ".pl",
  ".pm",
  ".dart",
];

const CODE_MIME = new Set([
  "text/plain",
  "text/markdown",
  "text/csv",
  "text/html",
  "text/css",
  "text/javascript",
  "text/x-python",
  "text/x-shellscript",
  "text/x-sh",
  "text/x-script",
  "application/json",
  "application/ld+json",
  "application/xml",
  "application/javascript",
  "application/x-javascript",
  "application/typescript",
  "application/x-sh",
  "application/x-shellscript",
  "application/x-httpd-php",
  "application/sql",
]);

export function isCodeLike(mime: string, name: string) {
  const m = (mime || "").toLowerCase();
  const lower = name.toLowerCase();
  if (CODE_MIME.has(m)) return true;
  if (m.startsWith("text/")) return true;
  if (m.includes("json") || m.includes("xml") || m.includes("javascript") || m.includes("typescript")) {
    return true;
  }
  return CODE_EXT.some((ext) => lower.endsWith(ext)) || lower === "dockerfile" || lower === "makefile";
}

export function isPreviewable(mime: string, name: string) {
  const m = mime || "";
  const lower = name.toLowerCase();
  return (
    m.startsWith("image/") ||
    m === "application/pdf" ||
    m.startsWith("text/") ||
    m === "application/json" ||
    isCodeLike(m, name) ||
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
