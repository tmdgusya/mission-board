import { db } from "../db/connection";
import { agents } from "../db/schema";
import { eq } from "drizzle-orm";

/**
 * Ensures an agent exists in the database.
 * If the agent doesn't exist, creates a new agent record with:
 * - id: the provided agentId
 * - name: defaults to the agentId (can be updated later)
 * - created_at: current timestamp
 * - last_seen_at: current timestamp
 * 
 * If the agent exists, updates last_seen_at to the current timestamp.
 * 
 * This function handles concurrent requests gracefully by using
 * INSERT OR IGNORE pattern with a follow-up UPDATE.
 */
export async function ensureAgentExists(agentId: string): Promise<void> {
  const now = new Date();

  // First check if agent exists
  const existingAgent = await db.select().from(agents).where(eq(agents.id, agentId));
  
  if (existingAgent.length > 0) {
    // Agent exists, update last_seen_at
    await db
      .update(agents)
      .set({ lastSeenAt: now })
      .where(eq(agents.id, agentId));
  } else {
    // Agent doesn't exist, try to insert
    try {
      await db.insert(agents).values({
        id: agentId,
        name: agentId, // Name defaults to id initially
        createdAt: now,
        lastSeenAt: now,
      });
    } catch (error) {
      // If insert failed (e.g., due to race condition), update last_seen_at instead
      await db
        .update(agents)
        .set({ lastSeenAt: now })
        .where(eq(agents.id, agentId));
    }
  }
}

/**
 * Updates the last_seen_at timestamp for an agent.
 * Call this on every API request from an agent.
 */
export async function updateAgentLastSeen(agentId: string): Promise<void> {
  const now = new Date();
  await db
    .update(agents)
    .set({ lastSeenAt: now })
    .where(eq(agents.id, agentId));
}

/**
 * Checks if an agent exists in the database.
 */
export async function agentExists(agentId: string): Promise<boolean> {
  const result = await db.select().from(agents).where(eq(agents.id, agentId));
  return result.length > 0;
}
