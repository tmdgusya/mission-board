import chalk from "chalk";
import { requestApproval } from "../client";
import { formatError } from "../errors";
import { buildReasoning, type ReasoningOptions } from "../lib/reasoning";

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function formatRequestApprovalSuccess(
  approvalId: string,
  taskId: string,
  action: string
): string {
  return [
    chalk.green(`✓ Approval request created successfully`),
    chalk.gray(`  Approval ID: ${chalk.cyan(approvalId)}`),
    chalk.gray(`  Task:        ${chalk.cyan(taskId)}`),
    chalk.gray(`  Action:      ${action}`),
    chalk.gray(`  Status:      pending`),
  ].join("\n");
}

export const formatRequestApprovalError = formatError;

function isValidUUID(uuid: string): boolean {
  return UUID_REGEX.test(uuid);
}

export interface RequestApprovalCommandOptions extends ReasoningOptions {}

export async function executeRequestApproval(
  taskId: string,
  action: string,
  agentName?: string,
  options?: Pick<RequestApprovalCommandOptions, "reason" | "transcript">
): Promise<number> {
  if (!isValidUUID(taskId)) {
    console.error(chalk.red("Error: Invalid task ID format"));
    console.error(chalk.gray("Task ID must be a valid UUID (e.g., 550e8400-e29b-41d4-a716-446655440000)"));
    return 1;
  }

  if (!action || action.trim() === "") {
    console.error(chalk.red("Error: Action description is required"));
    console.error(chalk.gray("Use --action <description> to describe the action needing approval"));
    return 1;
  }

  const reasoning = await buildReasoning(options);
  if (reasoning === 1) return 1;

  try {
    const approval = await requestApproval(taskId, action, agentName, reasoning);
    console.log(formatRequestApprovalSuccess(approval.id, taskId, action));
    return 0;
  } catch (error) {
    console.error(formatError(error));
    return 1;
  }
}
