#!/usr/bin/env node
/**
 * Generate TELEGRAM_SESSION (GramJS StringSession) for TeCloud STORAGE_DRIVER=telegram.
 *
 * Prerequisites:
 *   1. https://my.telegram.org → API development tools → create app → api_id + api_hash
 *   2. Node 20+
 *
 * Usage:
 *   TELEGRAM_API_ID=12345 TELEGRAM_API_HASH=abcdef node scripts/telegram-session.mjs
 *
 * Then paste the printed session string into .env as TELEGRAM_SESSION=...
 * Optional: TELEGRAM_STORAGE_CHAT_ID=me   (Saved Messages) or a channel/chat id
 */
import { createInterface } from "readline";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";

const apiId = Number(process.env.TELEGRAM_API_ID || "");
const apiHash = process.env.TELEGRAM_API_HASH || "";

if (!apiId || !apiHash) {
  console.error("Set TELEGRAM_API_ID and TELEGRAM_API_HASH first (from https://my.telegram.org).");
  process.exit(1);
}

const rl = createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((resolve) => rl.question(q, resolve));

const client = new TelegramClient(new StringSession(""), apiId, apiHash, {
  connectionRetries: 5,
});

console.log("Connecting…");
await client.start({
  phoneNumber: async () => await ask("Phone (+62…): "),
  password: async () => await ask("2FA password (if any, else empty): "),
  phoneCode: async () => await ask("Code from Telegram: "),
  onError: (err) => console.error(err),
});

const session = client.session.save();
console.log("\nAuthorized. Add to .env:\n");
console.log(`TELEGRAM_API_ID=${apiId}`);
console.log(`TELEGRAM_API_HASH=${apiHash}`);
console.log(`TELEGRAM_SESSION=${session}`);
console.log(`TELEGRAM_STORAGE_CHAT_ID=me`);
console.log(`STORAGE_DRIVER=telegram`);
console.log("\nFiles will be stored as documents in Saved Messages (or TELEGRAM_STORAGE_CHAT_ID).");
await client.disconnect();
rl.close();
process.exit(0);
