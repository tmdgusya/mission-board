import chalk from "chalk";
import { updateTask, type TaskStatus, TASK_STATUSES } from "../client";
import { formatError } from "../errors";

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Valid task statuses
const VALID_STATUSES: TaskStatus[] = [
  "backlog",
  "ready",
  "in_progress",
  "review",
  "done",
  "blocked",
];

/**
 * Format success message for task update
 * @param taskId - The ID of the updated task
 * @param status - The new status
 * @returns Formatted success message
 */
export function formatUpdateSuccess(taskId: string, status: string): string {
  return chalk.green(`✓ Task ${chalk.cyan(taskId)} updated to ${chalk.cyan(status)}`);
}

/**
 * Format API error message (kept for backward compatibility, delegates to shared formatter).
 */
export const formatUpdateError = formatError;

/**
 * Validate UUID format
 * @param uuid - The UUID string to validate
 * @returns True if valid UUID format
 */
function isValidUUID(uuid: string): boolean {
  return UUID_REGEX.test(uuid);
}

/**
 * Validate task status
 * @param status - The status to validate
 * @returns True if valid status
 */
function isValidStatus(status: string): status is TaskStatus {
  return VALID_STATUSES.includes(status as TaskStatus);
}

export interface UpdateCommandOptions {
  status?: string;
  title?: string;
  description?: string;
}

/**
 * Execute the update task command
 * @param taskId - The ID of the task to update
 * @param options - Command options
 * @returns Exit code (0 for success, 1 for error)
 */
export async function executeUpdate(
  taskId: string,
  options: UpdateCommandOptions
): Promise<number> {
  // Validate task ID format (UUID)
  if (!isValidUUID(taskId)) {
    console.error(chalk.red("Error: Invalid task ID format"));
    console.error(chalk.gray("Task ID must be a valid UUID (e.g., 550e8400-e29b-41d4-a716-446655440000)"));
    return 1;
  }

  // Validate status if provided
  if (options.status && !isValidStatus(options.status)) {
    console.error(chalk.red(`Error: Invalid status "${options.status}"`));
    console.error(chalk.gray(`Valid statuses: ${VALID_STATUSES.join(", ")}`));
    return 1;
  }

  // Check that at least one field is being updated
  if (!options.status && !options.title && !options.description) {
    console.error(chalk.red("Error: No updates specified"));
    console.error(chalk.gray("Use --status, --title, or --description to specify what to update"));
    return 1;
  }

  try {
    const updates: { status?: TaskStatus; title?: string; description?: string } = {};
    if (options.status) updates.status = options.status as TaskStatus;
    if (options.title) updates.title = options.title;
    if (options.description) updates.description = options.description;

    const task = await updateTask(taskId, updates);

    console.log(formatUpdateSuccess(task.id, task.status));
    return 0;
  } catch (error) {
    console.error(formatError(error));
    return 1;
  }
}
