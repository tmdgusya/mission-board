import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "./schema";

const DATABASE_PATH = process.env.DATABASE_PATH || "./data/mission-board.db";

// Initialize SQLite connection
const sqlite = new Database(DATABASE_PATH);

// Enable WAL mode for concurrent reads
sqlite.exec("PRAGMA journal_mode = WAL");

// Enable foreign key constraints
sqlite.exec("PRAGMA foreign_keys = ON");

// Create Drizzle ORM instance
export const db = drizzle(sqlite, { schema });

// Export the raw SQLite instance for direct queries if needed
export { sqlite };

// Helper function to check database health
export function checkDatabaseHealth(): { ok: boolean; journalMode: string; foreignKeys: boolean } {
  const journalModeQuery = sqlite.query("PRAGMA journal_mode");
  const journalMode = journalModeQuery.get() as { journal_mode: string };
  journalModeQuery.finalize();

  const foreignKeysQuery = sqlite.query("PRAGMA foreign_keys");
  const foreignKeys = foreignKeysQuery.get() as { foreign_keys: number };
  foreignKeysQuery.finalize();

  return {
    ok: journalMode.journal_mode === "wal" && foreignKeys.foreign_keys === 1,
    journalMode: journalMode.journal_mode,
    foreignKeys: foreignKeys.foreign_keys === 1,
  };
}
