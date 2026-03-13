import chalk from "chalk";
import { releaseTask } from "../client";
import { formatError } from "../errors";

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Format success message for task release
 * @param taskId - The ID of the released task
 * @returns Formatted success message
 */
export function formatReleaseSuccess(taskId: string): string {
  return chalk.green(`✓ Task ${chalk.cyan(taskId)} released successfully`);
}

/**
 * Format API error message (kept for backward compatibility, delegates to shared formatter).
 */
export const formatReleaseError = formatError;

/**
 * Validate UUID format
 * @param uuid - The UUID string to validate
 * @returns True if valid UUID format
 */
function isValidUUID(uuid: string): boolean {
  return UUID_REGEX.test(uuid);
}

export interface ReleaseCommandOptions {
  taskId: string;
}

/**
 * Execute the release task command
 * @param taskId - The ID of the task to release
 * @returns Exit code (0 for success, 1 for error)
 */
export async function executeRelease(taskId: string): Promise<number> {
  // Validate task ID format (UUID)
  if (!isValidUUID(taskId)) {
    console.error(chalk.red("Error: Invalid task ID format"));
    console.error(chalk.gray("Task ID must be a valid UUID (e.g., 550e8400-e29b-41d4-a716-446655440000)"));
    return 1;
  }

  try {
    const task = await releaseTask(taskId);

    console.log(formatReleaseSuccess(task.id));
    console.log(chalk.gray(`  Status: ${task.status}`));
    console.log(chalk.gray(`  Agent: ${task.agentId || "Unassigned"}`));
    return 0;
  } catch (error) {
    console.error(formatError(error));
    return 1;
  }
}
