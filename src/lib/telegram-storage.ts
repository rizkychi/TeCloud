import { createWriteStream, promises as fs } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import type { StorageDriver } from "./storage";

export type TelegramStorageConfig = {
  apiId: number;
  apiHash: string;
  session: string;
  /** "me" = Saved Messages, or numeric chat/channel id */
  chatId: string;
  /** local dir for index + temp uploads */
  indexRoot: string;
};

type IndexEntry = {
  messageId: number;
  size: number;
  name: string;
  updatedAt: string;
};

type IndexFile = {
  version: 1;
  entries: Record<string, IndexEntry>;
};

type GramJs = {
  TelegramClient: new (
    session: unknown,
    apiId: number,
    apiHash: string,
    params?: Record<string, unknown>,
  ) => {
    connect: () => Promise<void>;
    isUserAuthorized: () => Promise<boolean>;
    connected?: boolean;
    sendFile: (entity: unknown, opts: Record<string, unknown>) => Promise<unknown>;
    getMessages: (entity: unknown, opts: Record<string, unknown>) => Promise<unknown[]>;
    downloadMedia: (msg: unknown, opts: Record<string, unknown>) => Promise<Buffer | string | undefined>;
    deleteMessages: (
      entity: unknown,
      ids: number[],
      opts?: Record<string, unknown>,
    ) => Promise<unknown>;
  };
  StringSession: new (session?: string) => unknown;
  CustomFile: new (name: string, size: number, path: string) => unknown;
};

/**
 * Load GramJS via Node createRequire so Next/Turbopack does not rewrite the
 * Session class identity. Static ESM imports can break `instanceof Session`
 * and throw: "Only StringSession and StoreSessions are supported currently".
 */
function loadGramJs(): GramJs {
  const require = createRequire(join(process.cwd(), "package.json"));
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const telegram = require("telegram") as {
    TelegramClient: GramJs["TelegramClient"];
  };
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const sessions = require("telegram/sessions") as {
    StringSession: GramJs["StringSession"];
  };
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const uploads = require("telegram/client/uploads") as {
    CustomFile: GramJs["CustomFile"];
  };
  return {
    TelegramClient: telegram.TelegramClient,
    StringSession: sessions.StringSession,
    CustomFile: uploads.CustomFile,
  };
}

function safeKey(key: string) {
  return key.replace(/\\/g, "/").replace(/\.\./g, "");
}

/** Normalize Coolify/env paste artifacts */
function normalizeSession(raw: string) {
  let s = raw.trim();
  // strip wrapping quotes
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim();
  }
  // accidental TELEGRAM_SESSION= prefix
  if (s.startsWith("TELEGRAM_SESSION=")) {
    s = s.slice("TELEGRAM_SESSION=".length).trim();
  }
  // collapse whitespace/newlines from multi-line paste
  s = s.replace(/\s+/g, "");
  return s;
}

/**
 * MTProto storage: each logical key maps to a document message in a Telegram chat.
 * Local JSON index stores messageId only — blobs live on Telegram.
 */
export class TelegramStorageDriver implements StorageDriver {
  private client: InstanceType<GramJs["TelegramClient"]> | null = null;
  private connectPromise: Promise<InstanceType<GramJs["TelegramClient"]>> | null = null;
  private indexPath: string;
  private writeChain: Promise<void> = Promise.resolve();
  private gram: GramJs | null = null;

  constructor(private cfg: TelegramStorageConfig) {
    this.indexPath = join(resolve(cfg.indexRoot), ".tg-index.json");
  }

  private gramJs() {
    if (!this.gram) this.gram = loadGramJs();
    return this.gram;
  }

  private async loadIndex(): Promise<IndexFile> {
    try {
      const raw = await fs.readFile(this.indexPath, "utf8");
      const parsed = JSON.parse(raw) as IndexFile;
      if (!parsed?.entries || typeof parsed.entries !== "object") {
        return { version: 1, entries: {} };
      }
      return { version: 1, entries: parsed.entries };
    } catch {
      return { version: 1, entries: {} };
    }
  }

  private async saveIndex(index: IndexFile) {
    await fs.mkdir(dirname(this.indexPath), { recursive: true });
    const tmp = `${this.indexPath}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(index, null, 2), "utf8");
    await fs.rename(tmp, this.indexPath);
  }

  private withIndex<T>(fn: (index: IndexFile) => Promise<T>): Promise<T> {
    const run = this.writeChain.then(async () => {
      const index = await this.loadIndex();
      return fn(index);
    });
    this.writeChain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private async getClient() {
    if (this.client?.connected) return this.client;
    if (this.connectPromise) return this.connectPromise;

    this.connectPromise = (async () => {
      const { TelegramClient, StringSession } = this.gramJs();
      const sessionStr = normalizeSession(this.cfg.session);
      if (!sessionStr) {
        throw new Error("TELEGRAM_SESSION_EMPTY");
      }
      // GramJS StringSession must start with version char "1"
      if (sessionStr[0] !== "1") {
        throw new Error(
          'TELEGRAM_SESSION_INVALID: must be a GramJS StringSession from `npm run telegram:session` (starts with "1")',
        );
      }

      const session = new StringSession(sessionStr);
      const client = new TelegramClient(session, this.cfg.apiId, this.cfg.apiHash, {
        connectionRetries: 5,
        useWSS: true,
      });
      await client.connect();
      if (!(await client.isUserAuthorized())) {
        throw new Error(
          "TELEGRAM_SESSION_UNAUTHORIZED: run scripts/telegram-session.mjs to generate TELEGRAM_SESSION",
        );
      }
      this.client = client;
      return client;
    })();

    try {
      return await this.connectPromise;
    } catch (e) {
      this.connectPromise = null;
      this.client = null;
      throw e;
    }
  }

  private entity() {
    const id = this.cfg.chatId.trim();
    if (!id || id === "me" || id === "self") return "me";
    if (/^-?\d+$/.test(id)) return id;
    return id.replace(/^@/, "");
  }

  async put(key: string, stream: Readable, size: number): Promise<void> {
    const k = safeKey(key);
    const client = await this.getClient();
    const { CustomFile } = this.gramJs();
    const baseName = basename(k) || "file.bin";

    const tmpDir = await fs.mkdtemp(join(tmpdir(), "tecloud-tg-"));
    const tmpFile = join(tmpDir, baseName);
    try {
      await pipeline(stream, createWriteStream(tmpFile));
      const stat = await fs.stat(tmpFile);
      const fileSize = size > 0 ? size : stat.size;
      const custom = new CustomFile(baseName, fileSize, tmpFile);

      const message = await client.sendFile(this.entity(), {
        file: custom,
        caption: `tecloud:${k}`,
        forceDocument: true,
        workers: 2,
      });

      const msg = Array.isArray(message) ? message[0] : message;
      const messageId = Number((msg as { id?: number })?.id);
      if (!Number.isFinite(messageId)) {
        throw new Error("TELEGRAM_UPLOAD_NO_MESSAGE_ID");
      }

      await this.withIndex(async (index) => {
        const prev = index.entries[k];
        index.entries[k] = {
          messageId,
          size: fileSize,
          name: baseName,
          updatedAt: new Date().toISOString(),
        };
        await this.saveIndex(index);
        if (prev?.messageId && prev.messageId !== messageId) {
          try {
            await client.deleteMessages(this.entity(), [prev.messageId], { revoke: true });
          } catch (err) {
            console.warn("[tecloud:telegram-storage] failed to delete old message", prev.messageId, err);
          }
        }
      });
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  async get(key: string): Promise<Readable> {
    const k = safeKey(key);
    const entry = (await this.loadIndex()).entries[k];
    if (!entry) throw new Error("STORAGE_NOT_FOUND");

    const client = await this.getClient();
    const messages = await client.getMessages(this.entity(), { ids: [entry.messageId] });
    const msg = messages?.[0];
    if (!msg) throw new Error("STORAGE_NOT_FOUND");

    const buffer = (await client.downloadMedia(msg, {})) as Buffer | string | undefined;
    if (!buffer) throw new Error("STORAGE_DOWNLOAD_FAILED");
    const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
    return Readable.from(buf);
  }

  async delete(key: string): Promise<void> {
    const k = safeKey(key);
    await this.withIndex(async (index) => {
      const entry = index.entries[k];
      if (!entry) return;
      delete index.entries[k];
      await this.saveIndex(index);
      try {
        const client = await this.getClient();
        await client.deleteMessages(this.entity(), [entry.messageId], { revoke: true });
      } catch (err) {
        console.warn("[tecloud:telegram-storage] delete message failed", entry.messageId, err);
      }
    });
  }

  async exists(key: string): Promise<boolean> {
    const k = safeKey(key);
    const entry = (await this.loadIndex()).entries[k];
    return Boolean(entry);
  }

  async probe(): Promise<{ ok: boolean; authorized: boolean; chat: string; error?: string }> {
    try {
      const client = await this.getClient();
      const authorized = await client.isUserAuthorized();
      return { ok: authorized, authorized, chat: String(this.entity()) };
    } catch (e) {
      return {
        ok: false,
        authorized: false,
        chat: String(this.entity()),
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }
}
