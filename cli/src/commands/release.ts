import chalk from "chalk";
import { releaseTask } from "../client";
import { formatError } from "../errors";
import { buildReasoning, type ReasoningOptions } from "../lib/reasoning";

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function formatReleaseSuccess(taskId: string): string {
  return chalk.green(`✓ Task ${chalk.cyan(taskId)} released successfully`);
}

export const formatReleaseError = formatError;

function isValidUUID(uuid: string): boolean {
  return UUID_REGEX.test(uuid);
}

export interface ReleaseCommandOptions extends ReasoningOptions {}

export async function executeRelease(
  taskId: string,
  options?: ReleaseCommandOptions
): Promise<number> {
  if (!isValidUUID(taskId)) {
    console.error(chalk.red("Error: Invalid task ID format"));
    console.error(chalk.gray("Task ID must be a valid UUID (e.g., 550e8400-e29b-41d4-a716-446655440000)"));
    return 1;
  }

  const reasoning = await buildReasoning(options);
  if (reasoning === 1) return 1;

  try {
    const task = await releaseTask(taskId, reasoning);
    console.log(formatReleaseSuccess(task.id));
    console.log(chalk.gray(`  Status: ${task.status}`));
    console.log(chalk.gray(`  Agent: ${task.agentId || "Unassigned"}`));
    return 0;
  } catch (error) {
    console.error(formatError(error));
    return 1;
  }
}
