import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";

const dataDir = process.env.DATA_DIR || "./data";
const databasePath = process.env.DATABASE_PATH || join(dataDir, "tecloud.sqlite");
const backupDir = process.env.BACKUP_DIR || join(dataDir, "backups");

if (!existsSync(databasePath)) {
  console.error(`Database not found: ${databasePath}`);
  process.exit(1);
}

mkdirSync(backupDir, { recursive: true });
mkdirSync(dirname(databasePath), { recursive: true });

const db = new DatabaseSync(databasePath);
db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
db.close();

const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const target = join(backupDir, `tecloud-${timestamp}.sqlite`);
copyFileSync(databasePath, target);

console.log(`SQLite backup written to ${target}`);
