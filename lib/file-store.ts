import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync, type StatementSync } from "node:sqlite";
import { getDatabasePath } from "./config";
import type {
  AppUser,
  SessionUser,
  ShareMode,
  StoredFile,
  UserRole,
  UserStatus,
} from "./types";

type UserRow = {
  id: string;
  name: string;
  username: string;
  telegram_chat_id: string;
  password_hash: string;
  password_salt: string;
  role: UserRole;
  status: UserStatus;
  quota_bytes: number;
  used_bytes: number;
  created_at: string;
  updated_at: string;
  verified_at: string | null;
};

type StoredFileRow = {
  id: string;
  owner_id: string | null;
  name: string;
  original_name: string;
  mime_type: string;
  size: number;
  telegram_file_id: string;
  telegram_unique_id: string | null;
  message_id: number;
  uploaded_at: string;
  updated_at: string;
  version: number;
  share_mode: ShareMode;
  share_token: string | null;
  share_password_hash: string | null;
  share_password_salt: string | null;
  download_count: number;
  folder_path: string | null;
  is_favorite: number | null;
  tags: string | null;
  deleted_at: string | null;
  delete_expires_at: string | null;
  share_expires_at: string | null;
  share_download_limit: number | null;
  share_download_count: number | null;
};

type OtpPurpose = "signup" | "reset";

type AuthCode = {
  id: string;
  userId: string;
  purpose: OtpPurpose;
  codeHash: string;
  createdAt: string;
  expiresAt: string;
};

export type CreateUserInput = {
  id: string;
  name: string;
  username: string;
  telegramChatId: string;
  passwordHash: string;
  passwordSalt: string;
  role: UserRole;
  status: UserStatus;
  quotaBytes: number;
  createdAt: string;
};

export type SessionInput = {
  id: string;
  tokenHash: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
};

let database: DatabaseSync | null = null;
let schemaReady = false;

function getDb() {
  if (database) return database;

  const databasePath = getDatabasePath();
  mkdirSync(dirname(databasePath), { recursive: true });
  database = new DatabaseSync(databasePath);
  database.exec("PRAGMA journal_mode = WAL");
  database.exec("PRAGMA foreign_keys = ON");
  return database;
}

function all<T>(statement: StatementSync, ...values: any[]) {
  return statement.all(...values) as T[];
}

function get<T>(statement: StatementSync, ...values: any[]) {
  return (statement.get(...values) as T | undefined) ?? null;
}

export async function ensureSchema() {
  if (schemaReady) return;

  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      username TEXT NOT NULL UNIQUE,
      telegram_chat_id TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      role TEXT NOT NULL,
      status TEXT NOT NULL,
      quota_bytes INTEGER NOT NULL,
      used_bytes INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      verified_at TEXT
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      token_hash TEXT NOT NULL UNIQUE,
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS auth_codes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      purpose TEXT NOT NULL,
      code_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      consumed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS files (
      id TEXT PRIMARY KEY,
      owner_id TEXT,
      name TEXT NOT NULL,
      original_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size INTEGER NOT NULL,
      telegram_file_id TEXT NOT NULL,
      telegram_unique_id TEXT,
      message_id INTEGER NOT NULL,
      uploaded_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      version INTEGER NOT NULL,
      share_mode TEXT NOT NULL DEFAULT 'private',
      share_token TEXT UNIQUE,
      share_password_hash TEXT,
      share_password_salt TEXT,
      download_count INTEGER NOT NULL DEFAULT 0,
      folder_path TEXT NOT NULL DEFAULT '/',
      is_favorite INTEGER NOT NULL DEFAULT 0,
      tags TEXT,
      deleted_at TEXT,
      delete_expires_at TEXT,
      share_expires_at TEXT,
      share_download_limit INTEGER,
      share_download_count INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS activity_events (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      file_id TEXT,
      type TEXT NOT NULL,
      bytes INTEGER NOT NULL DEFAULT 0,
      metadata TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS rate_limits (
      key TEXT PRIMARY KEY,
      count INTEGER NOT NULL,
      reset_at INTEGER NOT NULL
    );
  `);

  await addColumnIfMissing("files", "owner_id TEXT");
  await addColumnIfMissing("files", "share_mode TEXT NOT NULL DEFAULT 'private'");
  await addColumnIfMissing("files", "share_token TEXT");
  await addColumnIfMissing("files", "share_password_hash TEXT");
  await addColumnIfMissing("files", "share_password_salt TEXT");
  await addColumnIfMissing("files", "download_count INTEGER NOT NULL DEFAULT 0");
  await addColumnIfMissing("files", "folder_path TEXT NOT NULL DEFAULT '/'");
  await addColumnIfMissing("files", "is_favorite INTEGER NOT NULL DEFAULT 0");
  await addColumnIfMissing("files", "tags TEXT");
  await addColumnIfMissing("files", "deleted_at TEXT");
  await addColumnIfMissing("files", "delete_expires_at TEXT");
  await addColumnIfMissing("files", "share_expires_at TEXT");
  await addColumnIfMissing("files", "share_download_limit INTEGER");
  await addColumnIfMissing("files", "share_download_count INTEGER NOT NULL DEFAULT 0");

  db.exec(`
    CREATE INDEX IF NOT EXISTS users_role_idx ON users (role);
    CREATE INDEX IF NOT EXISTS files_owner_idx ON files (owner_id);
    CREATE INDEX IF NOT EXISTS files_folder_idx ON files (owner_id, folder_path);
    CREATE INDEX IF NOT EXISTS files_favorite_idx ON files (owner_id, is_favorite);
    CREATE INDEX IF NOT EXISTS files_deleted_idx ON files (owner_id, deleted_at);
    CREATE INDEX IF NOT EXISTS files_share_token_idx ON files (share_token);
    CREATE INDEX IF NOT EXISTS sessions_token_idx ON sessions (token_hash);
    CREATE INDEX IF NOT EXISTS activity_created_idx ON activity_events (created_at);
    CREATE INDEX IF NOT EXISTS rate_limits_reset_idx ON rate_limits (reset_at);
  `);
  schemaReady = true;
}

export async function checkDatabaseHealth() {
  await ensureSchema();
  const row = get<{ ok: number }>(getDb().prepare("SELECT 1 AS ok"));
  return row?.ok === 1;
}

async function addColumnIfMissing(table: string, definition: string) {
  const column = definition.split(" ")[0];
  const columns = all<{ name: string }>(
    getDb().prepare(`PRAGMA table_info(${table})`),
  );
  if (columns.some((item) => item.name === column)) return;
  getDb().exec(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
}

function userFromRow(row: UserRow): AppUser {
  return {
    id: row.id,
    name: row.name,
    username: row.username,
    telegramChatId: row.telegram_chat_id,
    role: row.role,
    status: row.status,
    quotaBytes: row.quota_bytes,
    usedBytes: row.used_bytes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    verifiedAt: row.verified_at ?? undefined,
  };
}

function fileFromRow(row: StoredFileRow): StoredFile {
  return {
    id: row.id,
    ownerId: row.owner_id || "",
    name: row.name,
    originalName: row.original_name,
    mimeType: row.mime_type,
    size: row.size,
    telegramFileId: row.telegram_file_id,
    telegramUniqueId: row.telegram_unique_id ?? undefined,
    messageId: row.message_id,
    uploadedAt: row.uploaded_at,
    updatedAt: row.updated_at,
    version: row.version,
    shareMode: row.share_mode || "private",
    shareToken: row.share_token ?? undefined,
    downloadCount: row.download_count || 0,
    folderPath: normalizeFolderPath(row.folder_path || "/"),
    isFavorite: Boolean(row.is_favorite),
    tags: parseTags(row.tags),
    deletedAt: row.deleted_at ?? undefined,
    deleteExpiresAt: row.delete_expires_at ?? undefined,
    shareExpiresAt: row.share_expires_at ?? undefined,
    shareDownloadLimit: row.share_download_limit ?? undefined,
    shareDownloadCount: row.share_download_count || 0,
  };
}

function bindFile(statement: StatementSync, file: StoredFile) {
  return statement.run(
    file.id,
    file.ownerId,
    file.name,
    file.originalName,
    file.mimeType,
    file.size,
    file.telegramFileId,
    file.telegramUniqueId ?? null,
    file.messageId,
    file.uploadedAt,
    file.updatedAt,
    file.version,
    file.shareMode,
    file.shareToken ?? null,
    file.downloadCount,
    normalizeFolderPath(file.folderPath),
    file.isFavorite ? 1 : 0,
    stringifyTags(file.tags),
    file.deletedAt ?? null,
    file.deleteExpiresAt ?? null,
    file.shareExpiresAt ?? null,
    file.shareDownloadLimit ?? null,
    file.shareDownloadCount,
  );
}

function parseTags(value: string | null) {
  if (!value) return [];
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 20);
}

function stringifyTags(tags: string[]) {
  return tags
    .map((tag) => tag.trim().replace(/,/g, ""))
    .filter(Boolean)
    .slice(0, 20)
    .join(",");
}

export function normalizeFolderPath(value: string) {
  const cleaned = value
    .trim()
    .replace(/\\/g, "/")
    .replace(/\/+/g, "/")
    .replace(/[<>:"|?*]/g, "-");
  const withRoot = cleaned.startsWith("/") ? cleaned : `/${cleaned}`;
  const withoutTrailing = withRoot.length > 1 ? withRoot.replace(/\/+$/g, "") : withRoot;
  return withoutTrailing || "/";
}

export async function countUsers() {
  await ensureSchema();
  const row = get<{ total: number }>(
    getDb().prepare("SELECT COUNT(*) AS total FROM users"),
  );
  return row?.total ?? 0;
}

export async function createUser(input: CreateUserInput) {
  await ensureSchema();
  getDb()
    .prepare(`
      INSERT INTO users (
        id, name, username, telegram_chat_id, password_hash, password_salt,
        role, status, quota_bytes, used_bytes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    `)
    .run(
      input.id,
      input.name,
      input.username,
      input.telegramChatId,
      input.passwordHash,
      input.passwordSalt,
      input.role,
      input.status,
      input.quotaBytes,
      input.createdAt,
      input.createdAt,
    );
}

export async function findUserByUsername(username: string) {
  await ensureSchema();
  return get<UserRow>(
    getDb().prepare("SELECT * FROM users WHERE lower(username) = lower(?)"),
    username,
  );
}

export async function findUser(id: string) {
  await ensureSchema();
  const row = get<UserRow>(getDb().prepare("SELECT * FROM users WHERE id = ?"), id);
  return row ? userFromRow(row) : null;
}

export async function listUsers() {
  await ensureSchema();
  return all<UserRow>(
    getDb().prepare("SELECT * FROM users ORDER BY created_at DESC"),
  ).map(userFromRow);
}

export async function activateUser(userId: string) {
  const now = new Date().toISOString();
  await ensureSchema();
  getDb()
    .prepare(
      "UPDATE users SET status = 'active', verified_at = ?, updated_at = ? WHERE id = ?",
    )
    .run(now, now, userId);
  return findUser(userId);
}

export async function activateUserFromTelegram(
  userId: string,
  telegramChatId: string,
  role?: UserRole,
) {
  const now = new Date().toISOString();
  await ensureSchema();
  const current = await findUser(userId);
  if (!current) return null;

  getDb()
    .prepare(
      "UPDATE users SET telegram_chat_id = ?, role = ?, status = 'active', verified_at = ?, updated_at = ? WHERE id = ?",
    )
    .run(telegramChatId, role ?? current.role, now, now, userId);
  return findUser(userId);
}

export async function updateUserAdmin(
  userId: string,
  updates: Partial<Pick<AppUser, "quotaBytes" | "role" | "status">>,
) {
  await ensureSchema();
  const current = await findUser(userId);
  if (!current) return null;
  const next = {
    quotaBytes: updates.quotaBytes ?? current.quotaBytes,
    role: updates.role ?? current.role,
    status: updates.status ?? current.status,
  };
  getDb()
    .prepare(
      "UPDATE users SET quota_bytes = ?, role = ?, status = ?, updated_at = ? WHERE id = ?",
    )
    .run(next.quotaBytes, next.role, next.status, new Date().toISOString(), userId);
  return findUser(userId);
}

export async function updateUserPassword(
  userId: string,
  passwordHash: string,
  passwordSalt: string,
) {
  await ensureSchema();
  getDb()
    .prepare(
      "UPDATE users SET password_hash = ?, password_salt = ?, updated_at = ? WHERE id = ?",
    )
    .run(passwordHash, passwordSalt, new Date().toISOString(), userId);
}

export async function createAuthCode(code: AuthCode) {
  await ensureSchema();
  getDb()
    .prepare(
      "INSERT INTO auth_codes (id, user_id, purpose, code_hash, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .run(
      code.id,
      code.userId,
      code.purpose,
      code.codeHash,
      code.createdAt,
      code.expiresAt,
    );
}

export async function consumeAuthCode(
  userId: string,
  purpose: OtpPurpose,
  codeHash: string,
) {
  await ensureSchema();
  const code = get<{ id: string; expires_at: string }>(
    getDb().prepare(
      "SELECT * FROM auth_codes WHERE user_id = ? AND purpose = ? AND code_hash = ? AND consumed_at IS NULL ORDER BY created_at DESC LIMIT 1",
    ),
    userId,
    purpose,
    codeHash,
  );

  if (!code || new Date(code.expires_at).getTime() < Date.now()) return false;

  getDb()
    .prepare("UPDATE auth_codes SET consumed_at = ? WHERE id = ?")
    .run(new Date().toISOString(), code.id);
  return true;
}

export async function createSession(session: SessionInput) {
  await ensureSchema();
  getDb()
    .prepare(
      "INSERT INTO sessions (id, token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?, ?)",
    )
    .run(
      session.id,
      session.tokenHash,
      session.userId,
      session.createdAt,
      session.expiresAt,
    );
}

export async function findSessionUser(tokenHash: string) {
  await ensureSchema();
  const row = get<{
    id: string;
    name: string;
    username: string;
    telegram_chat_id: string;
    role: UserRole;
    status: UserStatus;
    quota_bytes: number;
    used_bytes: number;
    expires_at: string;
  }>(
    getDb().prepare(`
      SELECT
        users.id,
        users.name,
        users.username,
        users.telegram_chat_id,
        users.role,
        users.status,
        users.quota_bytes,
        users.used_bytes,
        sessions.expires_at
      FROM sessions
      JOIN users ON users.id = sessions.user_id
      WHERE sessions.token_hash = ?
    `),
    tokenHash,
  );

  if (!row || new Date(row.expires_at).getTime() < Date.now()) {
    if (row) await deleteSession(tokenHash);
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    username: row.username,
    telegramChatId: row.telegram_chat_id,
    role: row.role,
    status: row.status,
    quotaBytes: row.quota_bytes,
    usedBytes: row.used_bytes,
  } satisfies SessionUser;
}

export async function deleteSession(tokenHash: string) {
  await ensureSchema();
  getDb().prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash);
}

export async function listFiles(ownerId: string) {
  await ensureSchema();
  return all<StoredFileRow>(
    getDb().prepare("SELECT * FROM files WHERE owner_id = ? AND deleted_at IS NULL ORDER BY updated_at DESC"),
    ownerId,
  ).map(fileFromRow);
}

export async function listTrashFiles(ownerId: string) {
  await ensureSchema();
  return all<StoredFileRow>(
    getDb().prepare("SELECT * FROM files WHERE owner_id = ? AND deleted_at IS NOT NULL ORDER BY deleted_at DESC"),
    ownerId,
  ).map(fileFromRow);
}

export async function listSharedFiles(ownerId: string) {
  await ensureSchema();
  return all<StoredFileRow>(
    getDb().prepare("SELECT * FROM files WHERE owner_id = ? AND deleted_at IS NULL AND share_mode != 'private' ORDER BY updated_at DESC"),
    ownerId,
  ).map(fileFromRow);
}

export async function addFile(file: StoredFile) {
  await ensureSchema();
  bindFile(
    getDb().prepare(`
      INSERT INTO files (
        id, owner_id, name, original_name, mime_type, size, telegram_file_id,
        telegram_unique_id, message_id, uploaded_at, updated_at, version,
        share_mode, share_token, download_count, folder_path, is_favorite,
        tags, deleted_at, delete_expires_at, share_expires_at,
        share_download_limit, share_download_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
    file,
  );
  await recalculateUserStorage(file.ownerId);
  return file;
}

export async function updateFile(
  id: string,
  updater: (file: StoredFile) => StoredFile,
) {
  const current = await findFile(id);
  if (!current) return null;

  const updated = updater(current);
  bindFile(
    getDb().prepare(`
      UPDATE files
      SET
        owner_id = ?2,
        name = ?3,
        original_name = ?4,
        mime_type = ?5,
        size = ?6,
        telegram_file_id = ?7,
        telegram_unique_id = ?8,
        message_id = ?9,
        uploaded_at = ?10,
        updated_at = ?11,
        version = ?12,
        share_mode = ?13,
        share_token = ?14,
        download_count = ?15,
        folder_path = ?16,
        is_favorite = ?17,
        tags = ?18,
        deleted_at = ?19,
        delete_expires_at = ?20,
        share_expires_at = ?21,
        share_download_limit = ?22,
        share_download_count = ?23
      WHERE id = ?1
    `),
    updated,
  );
  await recalculateUserStorage(updated.ownerId);
  return updated;
}

export async function updateFileMetadata(
  id: string,
  metadata: Partial<Pick<StoredFile, "folderPath" | "isFavorite">>,
) {
  const current = await findFile(id);
  if (!current) return null;

  const updated = await updateFile(id, (file) => ({
    ...file,
    folderPath: metadata.folderPath === undefined ? file.folderPath : normalizeFolderPath(metadata.folderPath),
    isFavorite: metadata.isFavorite === undefined ? file.isFavorite : Boolean(metadata.isFavorite),
    updatedAt: new Date().toISOString(),
  }));
  return updated;
}

export async function updateFileExtendedMetadata(
  id: string,
  metadata: Partial<Pick<StoredFile, "folderPath" | "isFavorite" | "tags">>,
) {
  const current = await findFile(id);
  if (!current) return null;

  return updateFile(id, (file) => ({
    ...file,
    folderPath: metadata.folderPath === undefined ? file.folderPath : normalizeFolderPath(metadata.folderPath),
    isFavorite: metadata.isFavorite === undefined ? file.isFavorite : Boolean(metadata.isFavorite),
    tags: metadata.tags === undefined ? file.tags : metadata.tags,
    updatedAt: new Date().toISOString(),
  }));
}

export async function updateShareSettings(
  id: string,
  shareMode: ShareMode,
  shareToken: string | null,
  passwordHash: string | null,
  passwordSalt: string | null,
  shareExpiresAt: string | null = null,
  shareDownloadLimit: number | null = null,
) {
  await ensureSchema();
  getDb()
    .prepare(`
      UPDATE files
      SET share_mode = ?, share_token = ?, share_password_hash = ?,
          share_password_salt = ?, share_expires_at = ?,
          share_download_limit = ?, share_download_count = CASE WHEN share_mode != ? THEN 0 ELSE share_download_count END,
          updated_at = ?
      WHERE id = ?
    `)
    .run(
      shareMode,
      shareToken,
      passwordHash,
      passwordSalt,
      shareExpiresAt,
      shareDownloadLimit,
      shareMode,
      new Date().toISOString(),
      id,
    );
  return findFile(id);
}

export async function softDeleteFile(id: string) {
  const file = await findFile(id);
  if (!file) return null;

  const deletedAt = new Date().toISOString();
  const deleteExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const updated = await updateFile(id, (current) => ({
    ...current,
    deletedAt,
    deleteExpiresAt,
    shareMode: "private",
    shareToken: undefined,
    shareExpiresAt: undefined,
    shareDownloadLimit: undefined,
    updatedAt: deletedAt,
  }));
  await recalculateUserStorage(file.ownerId);
  return updated;
}

export async function restoreFile(id: string) {
  const file = await findFile(id);
  if (!file) return null;

  return updateFile(id, (current) => ({
    ...current,
    deletedAt: undefined,
    deleteExpiresAt: undefined,
    updatedAt: new Date().toISOString(),
  }));
}

export async function removeFile(id: string) {
  const file = await findFile(id);
  if (!file) return null;

  getDb().prepare("DELETE FROM files WHERE id = ?").run(id);
  await recalculateUserStorage(file.ownerId);
  return file;
}

export async function findFile(id: string) {
  await ensureSchema();
  const row = get<StoredFileRow>(
    getDb().prepare("SELECT * FROM files WHERE id = ?"),
    id,
  );
  return row ? fileFromRow(row) : null;
}

export async function findSharedFile(token: string) {
  await ensureSchema();
  const row = get<StoredFileRow>(
    getDb().prepare("SELECT * FROM files WHERE share_token = ? AND share_mode != 'private' AND deleted_at IS NULL"),
    token,
  );
  return row ? fileFromRow(row) : null;
}

export async function getShareSecret(id: string) {
  await ensureSchema();
  return get<{
    share_password_hash: string | null;
    share_password_salt: string | null;
  }>(
    getDb().prepare(
      "SELECT share_password_hash, share_password_salt FROM files WHERE id = ?",
    ),
    id,
  );
}

export async function incrementDownloadCount(id: string) {
  await ensureSchema();
  getDb()
    .prepare("UPDATE files SET download_count = download_count + 1, share_download_count = share_download_count + 1 WHERE id = ?")
    .run(id);
}

export function isShareExpired(file: StoredFile) {
  return Boolean(file.shareExpiresAt && new Date(file.shareExpiresAt).getTime() < Date.now());
}

export function isShareDownloadLimitReached(file: StoredFile) {
  return Boolean(file.shareDownloadLimit && file.shareDownloadCount >= file.shareDownloadLimit);
}

export async function recalculateUserStorage(userId: string) {
  await ensureSchema();
  const row = get<{ total: number }>(
    getDb().prepare("SELECT COALESCE(SUM(size), 0) AS total FROM files WHERE owner_id = ?"),
    userId,
  );
  getDb()
    .prepare("UPDATE users SET used_bytes = ?, updated_at = ? WHERE id = ?")
    .run(row?.total ?? 0, new Date().toISOString(), userId);
}

export async function logActivity(input: {
  userId?: string | null;
  fileId?: string | null;
  type: string;
  bytes?: number;
  metadata?: Record<string, unknown>;
}) {
  await ensureSchema();
  getDb()
    .prepare(
      "INSERT INTO activity_events (id, user_id, file_id, type, bytes, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .run(
      crypto.randomUUID(),
      input.userId ?? null,
      input.fileId ?? null,
      input.type,
      input.bytes ?? 0,
      input.metadata ? JSON.stringify(input.metadata) : null,
      new Date().toISOString(),
    );
}

export async function listUserActivity(userId: string, limit = 24) {
  await ensureSchema();
  const rows = all<{
    id: string;
    file_id: string | null;
    type: string;
    bytes: number;
    metadata: string | null;
    created_at: string;
  }>(
    getDb().prepare(
      "SELECT id, file_id, type, bytes, metadata, created_at FROM activity_events WHERE user_id = ? ORDER BY created_at DESC LIMIT ?",
    ),
    userId,
    Math.max(1, Math.min(limit, 100)),
  );

  return rows.map((event) => ({
    id: event.id,
    fileId: event.file_id,
    type: event.type,
    bytes: event.bytes,
    metadata: event.metadata ? JSON.parse(event.metadata) : null,
    createdAt: event.created_at,
  }));
}

export async function hitRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
) {
  await ensureSchema();
  const now = Date.now();
  const resetAt = now + windowSeconds * 1000;
  const db = getDb();
  db.prepare("DELETE FROM rate_limits WHERE reset_at < ?").run(now);

  const current = get<{ count: number; reset_at: number }>(
    db.prepare("SELECT count, reset_at FROM rate_limits WHERE key = ?"),
    key,
  );

  if (!current) {
    db.prepare(
      "INSERT INTO rate_limits (key, count, reset_at) VALUES (?, 1, ?)",
    ).run(key, resetAt);
    return { allowed: true, remaining: Math.max(0, limit - 1), resetAt };
  }

  if (current.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: current.reset_at };
  }

  const nextCount = current.count + 1;
  db.prepare("UPDATE rate_limits SET count = ? WHERE key = ?").run(
    nextCount,
    key,
  );
  return {
    allowed: true,
    remaining: Math.max(0, limit - nextCount),
    resetAt: current.reset_at,
  };
}

export async function getAdminSummary() {
  await ensureSchema();
  const users = get<{ total: number }>(
    getDb().prepare("SELECT COUNT(*) AS total FROM users"),
  );
  const files = get<{ total: number }>(
    getDb().prepare("SELECT COUNT(*) AS total FROM files"),
  );
  const storage = get<{ total: number }>(
    getDb().prepare("SELECT COALESCE(SUM(size), 0) AS total FROM files"),
  );
  const downloads = get<{ total: number }>(
    getDb().prepare("SELECT COALESCE(SUM(download_count), 0) AS total FROM files"),
  );
  const recent = all<{ type: string; bytes: number; created_at: string }>(
    getDb().prepare(
      "SELECT type, bytes, created_at FROM activity_events ORDER BY created_at DESC LIMIT 12",
    ),
  );

  return {
    totalUsers: users?.total ?? 0,
    totalFiles: files?.total ?? 0,
    totalStorage: storage?.total ?? 0,
    totalDownloads: downloads?.total ?? 0,
    recentEvents: recent.map((event) => ({
      type: event.type,
      bytes: event.bytes,
      createdAt: event.created_at,
    })),
  };
}

export async function getStorageAnalytics(ownerId: string) {
  await ensureSchema();
  const files = all<StoredFileRow>(
    getDb().prepare("SELECT * FROM files WHERE owner_id = ? AND deleted_at IS NULL"),
    ownerId,
  ).map(fileFromRow);
  const byType = new Map<string, { count: number; bytes: number }>();
  const byFolder = new Map<string, { count: number; bytes: number }>();

  for (const file of files) {
    const type = file.mimeType.split("/")[0] || "other";
    const typeStat = byType.get(type) || { count: 0, bytes: 0 };
    typeStat.count += 1;
    typeStat.bytes += file.size;
    byType.set(type, typeStat);

    const folderStat = byFolder.get(file.folderPath) || { count: 0, bytes: 0 };
    folderStat.count += 1;
    folderStat.bytes += file.size;
    byFolder.set(file.folderPath, folderStat);
  }

  return {
    totalFiles: files.length,
    totalBytes: files.reduce((sum, file) => sum + file.size, 0),
    largestFiles: files
      .slice()
      .sort((a, b) => b.size - a.size)
      .slice(0, 8)
      .map((file) => ({
        id: file.id,
        name: file.name,
        size: file.size,
        folderPath: file.folderPath,
      })),
    byType: Array.from(byType.entries()).map(([type, stat]) => ({ type, ...stat })),
    byFolder: Array.from(byFolder.entries())
      .map(([folderPath, stat]) => ({ folderPath, ...stat }))
      .sort((a, b) => b.bytes - a.bytes)
      .slice(0, 12),
  };
}

export async function getPasswordSecret(username: string) {
  const row = await findUserByUsername(username);
  return row
    ? {
        user: userFromRow(row),
        passwordHash: row.password_hash,
        passwordSalt: row.password_salt,
      }
    : null;
}
