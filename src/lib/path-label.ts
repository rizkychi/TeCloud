import { buildBreadcrumb } from "./folders";

export async function pathLabelForFolder(
  folderId: string | null,
  ownerId: string,
  rootLabel = "My Drive",
): Promise<string> {
  if (!folderId) return rootLabel;
  const crumbs = await buildBreadcrumb(folderId, ownerId);
  if (!crumbs.length) return rootLabel;
  return [rootLabel, ...crumbs.map((c) => c.name)].join(" / ");
}

export async function attachPathLabels<
  TFolder extends { id: string; parentId: string | null },
  TFile extends { id: string; folderId: string | null },
>(
  ownerId: string,
  folders: TFolder[],
  files: TFile[],
  rootLabel = "My Drive",
): Promise<{
  folders: Array<TFolder & { pathLabel: string }>;
  files: Array<TFile & { pathLabel: string }>;
}> {
  const cache = new Map<string, string>();
  async function label(folderId: string | null) {
    const key = folderId || "__root__";
    if (cache.has(key)) return cache.get(key)!;
    const value = await pathLabelForFolder(folderId, ownerId, rootLabel);
    cache.set(key, value);
    return value;
  }

  const folderOut = [];
  for (const f of folders) {
    folderOut.push({ ...f, pathLabel: await label(f.parentId) });
  }
  const fileOut = [];
  for (const f of files) {
    fileOut.push({ ...f, pathLabel: await label(f.folderId) });
  }
  return { folders: folderOut, files: fileOut };
}
