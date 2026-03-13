import chalk from "chalk";
import { claimTask } from "../client";

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
 * Format API error message for display
 * @param error - The error object from API call
 * @returns Formatted error message
 */
export function formatClaimError(error: unknown): string {
  // Handle API response errors
  if (error && typeof error === "object" && "response" in error) {
    const apiError = error as {
      response?: {
        status: number;
        data: {
          error: string;
          currentOwner?: { agentId: string; claimedAt: string | null };
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

        case 409:
          if (data.currentOwner) {
            return chalk.red(`Error: Task is already claimed by another agent (${data.currentOwner.agentId})`);
          }
          return chalk.red(`Error: ${data.error || "Conflict"}`);

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

export interface ClaimCommandOptions {
  taskId: string;
}

/**
 * Execute the claim task command
 * @param taskId - The ID of the task to claim
 * @returns Exit code (0 for success, 1 for error)
 */
export async function executeClaim(taskId: string): Promise<number> {
  // Validate task ID format (UUID)
  if (!isValidUUID(taskId)) {
    console.error(chalk.red("Error: Invalid task ID format"));
    console.error(chalk.gray("Task ID must be a valid UUID (e.g., 550e8400-e29b-41d4-a716-446655440000)"));
    return 1;
  }

  try {
    const task = await claimTask(taskId);

    console.log(formatClaimSuccess(task.id));
    console.log(chalk.gray(`  Status: ${task.status}`));
    console.log(chalk.gray(`  Agent: ${task.agentId}`));
    return 0;
  } catch (error) {
    console.error(formatClaimError(error));
    return 1;
  }
}
