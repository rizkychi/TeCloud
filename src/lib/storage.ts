import { createReadStream, createWriteStream, promises as fs } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import type { Readable } from "node:stream";
import { getEnv } from "./env";
import { generateToken } from "./crypto";
import { TelegramStorageDriver } from "./telegram-storage";

export interface StorageDriver {
  put(key: string, stream: Readable, size: number): Promise<void>;
  get(key: string): Promise<Readable>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}

class MockStorageDriver implements StorageDriver {
  constructor(private root: string) {}

  private resolve(key: string) {
    const safe = key.replace(/\\/g, "/").replace(/\.\./g, "");
    const full = resolve(this.root, safe);
    if (!full.startsWith(resolve(this.root))) {
      throw new Error("PATH_TRAVERSAL");
    }
    return full;
  }

  async put(key: string, stream: Readable, _size: number): Promise<void> {
    const full = this.resolve(key);
    await fs.mkdir(dirname(full), { recursive: true });
    await pipeline(stream, createWriteStream(full));
  }

  async get(key: string): Promise<Readable> {
    const full = this.resolve(key);
    return createReadStream(full);
  }

  async delete(key: string): Promise<void> {
    const full = this.resolve(key);
    await fs.unlink(full).catch(() => undefined);
  }

  async exists(key: string): Promise<boolean> {
    try {
      await fs.access(this.resolve(key));
      return true;
    } catch {
      return false;
    }
  }
}

let driver: StorageDriver | null = null;
let activeDriverName: "mock" | "telegram" = "mock";

export function getActiveStorageDriver(): "mock" | "telegram" {
  // ensure initialized
  getStorage();
  return activeDriverName;
}

export function getStorage(): StorageDriver {
  if (driver) return driver;
  const env = getEnv();
  const root = resolve(env.STORAGE_PATH);

  if (env.STORAGE_DRIVER === "telegram") {
    const apiId = env.TELEGRAM_API_ID;
    const apiHash = env.TELEGRAM_API_HASH;
    const session = env.TELEGRAM_SESSION;
    if (!apiId || !apiHash || !session) {
      console.warn(
        "[tecloud] STORAGE_DRIVER=telegram but TELEGRAM_API_ID / TELEGRAM_API_HASH / TELEGRAM_SESSION incomplete — falling back to mock",
      );
      activeDriverName = "mock";
      driver = new MockStorageDriver(root);
      return driver;
    }
    activeDriverName = "telegram";
    driver = new TelegramStorageDriver({
      apiId,
      apiHash,
      session,
      chatId: env.TELEGRAM_STORAGE_CHAT_ID || "me",
      indexRoot: root,
    });
    console.info(
      `[tecloud] storage driver: telegram (chat=${env.TELEGRAM_STORAGE_CHAT_ID || "me"})`,
    );
    return driver;
  }

  activeDriverName = "mock";
  driver = new MockStorageDriver(root);
  return driver;
}

/** Test helper — reset singleton between unit tests */
export function resetStorageDriver() {
  driver = null;
  activeDriverName = "mock";
}

export function newStorageKey(userId: string, originalName: string): string {
  const ext = extname(originalName).slice(0, 32);
  return `${userId}/${Date.now()}-${generateToken(12)}${ext}`;
}
