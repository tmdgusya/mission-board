import chalk from "chalk";
import { updateTask, type TaskStatus, TASK_STATUSES } from "../client";

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
 * Format API error message for display
 * @param error - The error object from API call
 * @returns Formatted error message
 */
export function formatUpdateError(error: unknown): string {
  // Handle API response errors
  if (error && typeof error === "object" && "response" in error) {
    const apiError = error as {
      response?: {
        status: number;
        data: {
          error: string;
          details?: unknown;
        };
      };
    };

    if (apiError.response) {
      const { status, data } = apiError.response;

      // Handle specific error codes
      switch (status) {
        case 400:
          if (data.details && Array.isArray(data.details)) {
            const details = data.details
              .map((d: { message?: string }) => d.message || String(d))
              .join(", ");
            return chalk.red(`Error: Validation failed - ${details}`);
          }
          return chalk.red(`Error: ${data.error || "Invalid request"}`);

        case 404:
          return chalk.red(`Error: ${data.error || "Task not found"}`);

        case 500:
          return chalk.red(`Error: Server error - ${data.error || "Please try again later"}`);

        default:
          return chalk.red(`Error: ${data.error || `HTTP ${status}`}`);
      }
    }
  }

  // Handle network errors
  if (error instanceof Error) {
    if (error.message.includes("fetch") || error.message.includes("connect") || error.message.includes("ECONNREFUSED")) {
      return chalk.red("Error: Unable to connect to API. Is the server running?");
    }
    return chalk.red(`Error: ${error.message}`);
  }

  return chalk.red("Error: An unexpected error occurred");
}

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
    console.error(formatUpdateError(error));
    return 1;
  }
}
