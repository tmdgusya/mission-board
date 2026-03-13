import { db } from "../../src/db/connection";
import { tasks, taskLogs, projects, agents, approvalRequests } from "../../src/db/schema";

/**
 * Resets the database by deleting all data from all tables.
 * Used in tests to ensure a clean state.
 */
export async function resetDatabase(): Promise<void> {
  // Delete in order to respect foreign key constraints
  await db.delete(approvalRequests);
  await db.delete(taskLogs);
  await db.delete(tasks);
  await db.delete(agents);
  await db.delete(projects);
}
