import chalk from "chalk";
import { createTask, type TaskType } from "../client";
import { formatError } from "../errors";

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
 * Format API error message (kept for backward compatibility, delegates to shared formatter).
 */
export const formatApiError = formatError;

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
    console.error(formatError(error));
    return 1;
  }
}
