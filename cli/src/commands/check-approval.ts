import chalk from "chalk";
import { checkApproval, type ApprovalRequest } from "../client";
import { formatError } from "../errors";

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Format the approval status display for a single approval request
 * @param approval - The approval request
 * @returns Formatted status string
 */
function formatApprovalStatus(approval: ApprovalRequest): string {
  const lines: string[] = [];

  lines.push(chalk.gray(`  Approval ID: ${chalk.cyan(approval.id)}`));
  lines.push(chalk.gray(`  Task:        ${chalk.cyan(approval.taskId)}`));
  lines.push(chalk.gray(`  Action:      ${approval.actionRequested}`));
  lines.push(chalk.gray(`  Created:     ${formatDate(approval.createdAt)}`));

  switch (approval.status) {
    case "pending":
      lines.push(chalk.yellow(`  Status:      pending — awaiting review`));
      break;
    case "approved":
      lines.push(chalk.green(`  Status:      approved`));
      if (approval.reviewedBy) {
        lines.push(chalk.gray(`  Reviewed by: ${approval.reviewedBy}`));
      }
      if (approval.reviewedAt) {
        lines.push(chalk.gray(`  Reviewed at: ${formatDate(approval.reviewedAt)}`));
      }
      break;
    case "denied":
      lines.push(chalk.red(`  Status:      denied`));
      if (approval.reviewedBy) {
        lines.push(chalk.gray(`  Reviewed by: ${approval.reviewedBy}`));
      }
      if (approval.reviewedAt) {
        lines.push(chalk.gray(`  Reviewed at: ${formatDate(approval.reviewedAt)}`));
      }
      if (approval.notes) {
        lines.push("");
        lines.push(chalk.red(`  Reviewer notes:`));
        lines.push(chalk.red(`    ${approval.notes}`));
      }
      break;
  }

  return lines.join("\n");
}

/**
 * Format a date string to a readable local format
 * @param dateStr - ISO date string
 * @returns Formatted date string
 */
function formatDate(dateStr: string | null): string {
  if (!dateStr) return "N/A";
  try {
    const date = new Date(dateStr);
    return date.toLocaleString();
  } catch {
    return dateStr;
  }
}

/**
 * Format success message when no approvals found
 * @param taskId - The task ID that was checked
 * @returns Formatted message
 */
export function formatNoApprovalsFound(taskId: string): string {
  return chalk.gray(`No approval requests found for task ${chalk.cyan(taskId)}`);
}

/**
 * Format API error message (kept for backward compatibility, delegates to shared formatter).
 */
export const formatCheckApprovalError = formatError;

/**
 * Validate UUID format
 * @param uuid - The UUID string to validate
 * @returns True if valid UUID format
 */
function isValidUUID(uuid: string): boolean {
  return UUID_REGEX.test(uuid);
}

/**
 * Execute the check-approval command
 * @param taskId - The ID of the task to check approval status for
 * @returns Exit code (0 for success, 1 for error)
 */
export async function executeCheckApproval(taskId: string): Promise<number> {
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

  try {
    const approvals = await checkApproval(taskId);

    if (approvals.length === 0) {
      console.log(formatNoApprovalsFound(taskId));
      return 0;
    }

    // Show the most recent approval first (they're ordered by created_at desc from API)
    const latest = approvals[0]!;

    console.log(chalk.bold("Approval Status:"));
    console.log(formatApprovalStatus(latest));

    // If there are multiple approvals, show count
    if (approvals.length > 1) {
      console.log();
      console.log(chalk.gray(`  (${approvals.length - 1} previous approval request(s) for this task)`));
    }

    return 0;
  } catch (error) {
    console.error(formatError(error));
    return 1;
  }
}
