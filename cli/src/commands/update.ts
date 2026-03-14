import chalk from "chalk";
import { updateTask, type TaskStatus } from "../client";
import { formatError } from "../errors";
import { buildReasoning, type ReasoningOptions } from "../lib/reasoning";

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const VALID_STATUSES: TaskStatus[] = [
  "backlog",
  "ready",
  "in_progress",
  "review",
  "done",
  "blocked",
];

export function formatUpdateSuccess(taskId: string, status: string): string {
  return chalk.green(`✓ Task ${chalk.cyan(taskId)} updated to ${chalk.cyan(status)}`);
}

export const formatUpdateError = formatError;

function isValidUUID(uuid: string): boolean {
  return UUID_REGEX.test(uuid);
}

function isValidStatus(status: string): status is TaskStatus {
  return VALID_STATUSES.includes(status as TaskStatus);
}

export interface UpdateCommandOptions extends ReasoningOptions {
  status?: string;
  title?: string;
  description?: string;
}

export async function executeUpdate(
  taskId: string,
  options: UpdateCommandOptions
): Promise<number> {
  if (!isValidUUID(taskId)) {
    console.error(chalk.red("Error: Invalid task ID format"));
    console.error(chalk.gray("Task ID must be a valid UUID (e.g., 550e8400-e29b-41d4-a716-446655440000)"));
    return 1;
  }

  if (options.status && !isValidStatus(options.status)) {
    console.error(chalk.red(`Error: Invalid status "${options.status}"`));
    console.error(chalk.gray(`Valid statuses: ${VALID_STATUSES.join(", ")}`));
    return 1;
  }

  if (!options.status && !options.title && !options.description) {
    console.error(chalk.red("Error: No updates specified"));
    console.error(chalk.gray("Use --status, --title, or --description to specify what to update"));
    return 1;
  }

  const reasoning = await buildReasoning(options);
  if (reasoning === 1) return 1;

  try {
    const updates: { status?: TaskStatus; title?: string; description?: string } = {};
    if (options.status) updates.status = options.status as TaskStatus;
    if (options.title) updates.title = options.title;
    if (options.description) updates.description = options.description;

    const task = await updateTask(taskId, updates, reasoning);
    console.log(formatUpdateSuccess(task.id, task.status));
    return 0;
  } catch (error) {
    console.error(formatError(error));
    return 1;
  }
}
