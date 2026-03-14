import chalk from "chalk";
import { claimTask } from "../client";
import { formatError } from "../errors";

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Format success message for task claim
 * @param taskId - The ID of the claimed task
 * @returns Formatted success message
 */
export function formatClaimSuccess(taskId: string): string {
  return chalk.green(`✓ Task ${chalk.cyan(taskId)} claimed successfully`);
}

/**
 * Format API error message (kept for backward compatibility, delegates to shared formatter).
 */
export const formatClaimError = formatError;

/**
 * Validate UUID format
 * @param uuid - The UUID string to validate
 * @returns True if valid UUID format
 */
function isValidUUID(uuid: string): boolean {
  return UUID_REGEX.test(uuid);
}

export interface ClaimCommandOptions {
  taskId: string;
}

/**
 * Execute the claim task command
 * @param taskId - The ID of the task to claim
 * @returns Exit code (0 for success, 1 for error)
 */
export async function executeClaim(taskId: string, agentName?: string): Promise<number> {
  // Validate task ID format (UUID)
  if (!isValidUUID(taskId)) {
    console.error(chalk.red("Error: Invalid task ID format"));
    console.error(chalk.gray("Task ID must be a valid UUID (e.g., 550e8400-e29b-41d4-a716-446655440000)"));
    return 1;
  }

  try {
    const task = await claimTask(taskId, agentName);

    console.log(formatClaimSuccess(task.id));
    console.log(chalk.gray(`  Status: ${task.status}`));
    console.log(chalk.gray(`  Agent: ${task.agentId}`));
    return 0;
  } catch (error) {
    console.error(formatError(error));
    return 1;
  }
}
