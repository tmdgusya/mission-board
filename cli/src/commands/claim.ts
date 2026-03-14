import chalk from "chalk";
import { claimTask } from "../client";
import { formatError } from "../errors";
import { buildReasoning, type ReasoningOptions } from "../lib/reasoning";

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function formatClaimSuccess(taskId: string): string {
  return chalk.green(`✓ Task ${chalk.cyan(taskId)} claimed successfully`);
}

export const formatClaimError = formatError;

function isValidUUID(uuid: string): boolean {
  return UUID_REGEX.test(uuid);
}

export interface ClaimCommandOptions extends ReasoningOptions {}

export async function executeClaim(
  taskId: string,
  agentName?: string,
  options?: ClaimCommandOptions
): Promise<number> {
  if (!isValidUUID(taskId)) {
    console.error(chalk.red("Error: Invalid task ID format"));
    console.error(chalk.gray("Task ID must be a valid UUID (e.g., 550e8400-e29b-41d4-a716-446655440000)"));
    return 1;
  }

  const reasoning = await buildReasoning(options);
  if (reasoning === 1) return 1;

  try {
    const task = await claimTask(taskId, agentName, reasoning);
    console.log(formatClaimSuccess(task.id));
    console.log(chalk.gray(`  Status: ${task.status}`));
    console.log(chalk.gray(`  Agent: ${task.agentId}`));
    return 0;
  } catch (error) {
    console.error(formatError(error));
    return 1;
  }
}
