import { sqlite, db } from "./connection";

// Migration to create tables and indexes
function migrate() {
  console.log("Running database migrations...");

  // Create projects table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `);

  // Create agents table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      last_seen_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `);

  // Create tasks table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      agent_id TEXT,
      title TEXT NOT NULL,
      description TEXT,
      task_type TEXT NOT NULL,
      requires_approval INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'backlog',
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
      claimed_at INTEGER,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE SET NULL
    );
  `);

  // Create task_logs table
  // Note: task_id is not a foreign key to allow logs to persist after task deletion
  // This is important for audit trails
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS task_logs (
      id TEXT PRIMARY KEY,
      task_id TEXT,
      agent_id TEXT,
      action TEXT NOT NULL,
      details TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE SET NULL
    );
  `);

  // Create approval_requests table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS approval_requests (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      agent_id TEXT NOT NULL,
      action_requested TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      reviewed_by TEXT,
      reviewed_at INTEGER,
      notes TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
      FOREIGN KEY (reviewed_by) REFERENCES agents(id) ON DELETE SET NULL
    );
  `);

  // Create task_comments table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS task_comments (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      agent_id TEXT,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE SET NULL
    );
  `);

  // Create indexes for performance
  console.log("Creating indexes...");

  // Tasks indexes
  sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);`);
  sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);`);
  sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_tasks_agent_id ON tasks(agent_id);`);

  // Task logs index
  sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_task_logs_task_id ON task_logs(task_id);`);

  // Task comments index
  sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_task_comments_task_id ON task_comments(task_id);`);

  // Approval requests index
  sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_approval_requests_status ON approval_requests(status);`);

  // Verify WAL mode
  const journalModeQuery = sqlite.query("PRAGMA journal_mode");
  const journalMode = journalModeQuery.get() as { journal_mode: string };
  journalModeQuery.finalize();
  console.log(`Journal mode: ${journalMode.journal_mode}`);

  // Verify foreign keys
  const foreignKeysQuery = sqlite.query("PRAGMA foreign_keys");
  const foreignKeys = foreignKeysQuery.get() as { foreign_keys: number };
  foreignKeysQuery.finalize();
  console.log(`Foreign keys enabled: ${foreignKeys.foreign_keys === 1}`);

  console.log("Migrations completed successfully!");
}

// Run migrations if this file is executed directly
if (import.meta.main) {
  migrate();
}

export { migrate };
