import { NextResponse } from "next/server";

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId?: string;
  };
};

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function jsonError(
  status: number,
  code: string,
  message: string,
  details?: unknown,
) {
  const body: ApiErrorBody = {
    error: { code, message, details },
  };
  return NextResponse.json(body, { status });
}

export function toPublicFile(file: {
  id: string;
  name: string;
  mimeType: string;
  size: bigint | number;
  folderId: string | null;
  visibility: string;
  shareToken: string | null;
  starred?: boolean;
  version?: number;
  versionGroupId?: string | null;
  isLatest?: boolean;
  lastAccessedAt?: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: file.id,
    name: file.name,
    mimeType: file.mimeType,
    size: Number(file.size),
    folderId: file.folderId,
    visibility: file.visibility,
    shareToken: file.shareToken,
    hasSharePassword: false,
    starred: Boolean(file.starred),
    version: file.version ?? 1,
    versionGroupId: file.versionGroupId ?? null,
    isLatest: file.isLatest ?? true,
    lastAccessedAt: file.lastAccessedAt?.toISOString() ?? null,
    deletedAt: file.deletedAt?.toISOString() ?? null,
    createdAt: file.createdAt.toISOString(),
    updatedAt: file.updatedAt.toISOString(),
    type: "file" as const,
  };
}

export function toPublicFolder(folder: {
  id: string;
  name: string;
  parentId: string | null;
  visibility: string;
  shareToken: string | null;
  starred?: boolean;
  lastAccessedAt?: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: folder.id,
    name: folder.name,
    parentId: folder.parentId,
    visibility: folder.visibility,
    shareToken: folder.shareToken,
    starred: Boolean(folder.starred),
    lastAccessedAt: folder.lastAccessedAt?.toISOString() ?? null,
    deletedAt: folder.deletedAt?.toISOString() ?? null,
    createdAt: folder.createdAt.toISOString(),
    updatedAt: folder.updatedAt.toISOString(),
    type: "folder" as const,
  };
}
