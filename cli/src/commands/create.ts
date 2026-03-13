import chalk from "chalk";
import { createTask, type TaskType } from "../client";

// Valid task types
const VALID_TASK_TYPES: TaskType[] = [
  "implementation",
  "bugfix",
  "feature",
  "deployment",
  "documentation",
  "testing",
  "research",
  "other",
];

/**
 * Format success message for task creation
 * @param taskId - The ID of the created task
 * @returns Formatted success message
 */
export function formatCreateSuccess(taskId: string): string {
  return chalk.green(`✓ Task created successfully: ${chalk.cyan(taskId)}`);
}

/**
 * Format API error message for display
 * @param error - The error object from API call
 * @returns Formatted error message
 */
export function formatApiError(error: unknown): string {
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
          return chalk.red(`Error: ${data.error || "Not found"}`);

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
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return UUID_REGEX.test(uuid);
}

/**
 * Validate task type
 * @param type - The task type to validate
 * @returns True if valid task type
 */
function isValidTaskType(type: string): type is TaskType {
  return VALID_TASK_TYPES.includes(type as TaskType);
}

export interface CreateCommandOptions {
  project: string;
  title: string;
  type: string;
  description?: string;
}

/**
 * Execute the create task command
 * @param options - Command options
 * @returns Exit code (0 for success, 1 for error)
 */
export async function executeCreate(options: CreateCommandOptions): Promise<number> {
  // Validate required options
  if (!options.project) {
    console.error(chalk.red("Error: --project is required"));
    console.error(chalk.gray("Example: mission create --project abc-123 --title \"My Task\" --type implementation"));
    return 1;
  }

  if (!options.title) {
    console.error(chalk.red("Error: --title is required"));
    return 1;
  }

  if (!options.type) {
    console.error(chalk.red("Error: --type is required"));
    console.error(chalk.gray(`Valid types: ${VALID_TASK_TYPES.join(", ")}`));
    return 1;
  }

  // Validate project ID format (UUID)
  if (!isValidUUID(options.project)) {
    console.error(chalk.red("Error: Invalid project ID format"));
    console.error(chalk.gray("Project ID must be a valid UUID (e.g., 550e8400-e29b-41d4-a716-446655440000)"));
    return 1;
  }

  // Validate task type
  if (!isValidTaskType(options.type)) {
    console.error(chalk.red(`Error: Invalid task type "${options.type}"`));
    console.error(chalk.gray(`Valid types: ${VALID_TASK_TYPES.join(", ")}`));
    return 1;
  }

  try {
    const task = await createTask({
      projectId: options.project,
      title: options.title,
      taskType: options.type,
      description: options.description,
    });

    console.log(formatCreateSuccess(task.id));
    return 0;
  } catch (error) {
    console.error(formatApiError(error));
    return 1;
  }
}
