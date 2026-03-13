import chalk from "chalk";
import { requestApproval } from "../client";
import { formatError } from "../errors";

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Format success message for approval request
 * @param approvalId - The ID of the created approval request
 * @param taskId - The task ID the approval was requested for
 * @param action - The action requested
 * @returns Formatted success message
 */
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

/**
 * Format API error message (kept for backward compatibility, delegates to shared formatter).
 */
export const formatRequestApprovalError = formatError;

/**
 * Validate UUID format
 * @param uuid - The UUID string to validate
 * @returns True if valid UUID format
 */
function isValidUUID(uuid: string): boolean {
  return UUID_REGEX.test(uuid);
}

/**
 * Execute the request-approval command
 * @param taskId - The ID of the task to request approval for
 * @param action - Description of the action requiring approval
 * @returns Exit code (0 for success, 1 for error)
 */
export async function executeRequestApproval(
  taskId: string,
  action: string
): Promise<number> {
  // Validate task ID format (UUID)
  if (!isValidUUID(taskId)) {
    console.error(chalk.red("Error: Invalid task ID format"));
    console.error(
      chalk.gray(
        "Task ID must be a valid UUID (e.g., 550e8400-e29b-41d4-a716-446655440000)"
      )
    );
    return 1;
  }

  // Validate action is provided
  if (!action || action.trim() === "") {
    console.error(chalk.red("Error: Action description is required"));
    console.error(
      chalk.gray("Use --action <description> to describe the action needing approval")
    );
    return 1;
  }

  try {
    const approval = await requestApproval(taskId, action);

    console.log(formatRequestApprovalSuccess(approval.id, taskId, action));
    return 0;
  } catch (error) {
    console.error(formatError(error));
    return 1;
  }
}
