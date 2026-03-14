import chalk from "chalk";
import { requestApproval, type Reasoning, type ReasoningStep } from "../client";
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
 * Validate transcript array format
 * @param transcript - The transcript to validate
 * @returns True if valid transcript format
 */
function isValidTranscript(transcript: unknown): transcript is ReasoningStep[] {
  if (!Array.isArray(transcript)) return false;
  if (transcript.length === 0 || transcript.length > 50) return false;

  for (const item of transcript) {
    if (typeof item !== "object" || item === null) return false;
    const step = (item as { step?: unknown }).step;
    const thought = (item as { thought?: unknown }).thought;
    if (typeof step !== "number" || !Number.isInteger(step) || step < 1 || step > 100) return false;
    if (typeof thought !== "string" || thought.length === 0 || thought.length > 2000) return false;
  }

  return true;
}

/**
 * Load and parse transcript from file or stdin
 * @param transcriptPath - Path to transcript file, or "-" for stdin
 * @returns Parsed transcript array
 * @throws Error if file cannot be read or transcript is invalid
 */
async function loadTranscript(transcriptPath: string): Promise<ReasoningStep[]> {
  let content: string;

  if (transcriptPath === "-") {
    // Read from stdin
    const stdinFile = Bun.file("/dev/stdin");
    content = await stdinFile.text();
  } else {
    // Read from file
    const file = Bun.file(transcriptPath);
    if (!(await file.exists())) {
      throw new Error(`Transcript file not found: ${transcriptPath}`);
    }
    content = await file.text();
  }

  let transcript: unknown;
  try {
    transcript = JSON.parse(content);
  } catch {
    throw new Error("Invalid JSON in transcript file");
  }

  if (!isValidTranscript(transcript)) {
    throw new Error(
      "Invalid transcript format. Expected an array of objects with 'step' (number, 1-100) and 'thought' (string, 1-2000 chars). Max 50 steps."
    );
  }

  return transcript;
}

export interface RequestApprovalCommandOptions {
  reason?: string;
  transcript?: string;
}

/**
 * Execute the request-approval command
 * @param taskId - The ID of the task to request approval for
 * @param action - Description of the action requiring approval
 * @param options - Command options
 * @returns Exit code (0 for success, 1 for error)
 */
export async function executeRequestApproval(
  taskId: string,
  action: string,
  agentName?: string,
  options?: Pick<RequestApprovalCommandOptions, "reason" | "transcript">
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

  // Validate reason length if provided
  if (options?.reason && options.reason.length > 280) {
    console.error(chalk.red("Error: Reason exceeds maximum length of 280 characters"));
    return 1;
  }

  // Build reasoning object if any reasoning options provided
  let reasoning: Reasoning | undefined;
  if (options?.reason || options?.transcript) {
    reasoning = {};

    if (options.reason) {
      reasoning.reason = options.reason;
    }

    if (options.transcript) {
      try {
        reasoning.transcript = await loadTranscript(options.transcript);
      } catch (error) {
        console.error(chalk.red(`Error: ${error instanceof Error ? error.message : "Failed to load transcript"}`));
        return 1;
      }
    }
  }

  try {
    const approval = await requestApproval(taskId, action, agentName, reasoning);

    console.log(formatRequestApprovalSuccess(approval.id, taskId, action));
    return 0;
  } catch (error) {
    console.error(formatError(error));
    return 1;
  }
}
