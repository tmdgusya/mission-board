import chalk from "chalk";
import { releaseTask } from "../client";

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
 * Format API error message for display
 * @param error - The error object from API call
 * @returns Formatted error message
 */
export function formatReleaseError(error: unknown): string {
  // Handle API response errors
  if (error && typeof error === "object" && "response" in error) {
    const apiError = error as {
      response?: {
        status: number;
        data: {
          error: string;
        };
      };
    };

    if (apiError.response) {
      const { status, data } = apiError.response;

      // Handle specific error codes
      switch (status) {
        case 400:
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
    console.error(formatReleaseError(error));
    return 1;
  }
}
