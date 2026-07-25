import { createWriteStream, promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { CustomFile } from "telegram/client/uploads";
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

function safeKey(key: string) {
  return key.replace(/\\/g, "/").replace(/\.\./g, "");
}

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

/**
 * MTProto storage: each logical key maps to a document message in a Telegram chat
 * (usually Saved Messages). Local JSON index stores messageId only — blobs live on Telegram.
 *
 * Limits (Telegram): ~2 GB per document for user accounts; media may take time on cold download.
 */
export class TelegramStorageDriver implements StorageDriver {
  private client: TelegramClient | null = null;
  private connectPromise: Promise<TelegramClient> | null = null;
  private indexPath: string;
  private writeChain: Promise<void> = Promise.resolve();

  constructor(private cfg: TelegramStorageConfig) {
    this.indexPath = join(resolve(cfg.indexRoot), ".tg-index.json");
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

  /** serialize index mutations */
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

  private async getClient(): Promise<TelegramClient> {
    if (this.client?.connected) return this.client;
    if (this.connectPromise) return this.connectPromise;

    this.connectPromise = (async () => {
      const client = new TelegramClient(
        new StringSession(this.cfg.session),
        this.cfg.apiId,
        this.cfg.apiHash,
        {
          connectionRetries: 5,
          useWSS: true,
        },
      );
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
    // numeric string peer
    if (/^-?\d+$/.test(id)) return id;
    // @username
    return id.replace(/^@/, "");
  }

  async put(key: string, stream: Readable, size: number): Promise<void> {
    const k = safeKey(key);
    const client = await this.getClient();
    const baseName = basename(k) || "file.bin";

    // Prefer temp file so large uploads don't hold full RAM twice
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
        // best-effort delete previous message for same key
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

/** Read full stream into CustomFile buffer path helper (tests) */
export async function bufferFromStream(stream: Readable) {
  return streamToBuffer(stream);
}
