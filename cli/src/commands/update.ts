import chalk from "chalk";
import { updateTask, type TaskStatus, TASK_STATUSES, type Reasoning, type ReasoningStep } from "../client";
import { formatError } from "../errors";

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Valid task statuses
const VALID_STATUSES: TaskStatus[] = [
  "backlog",
  "ready",
  "in_progress",
  "review",
  "done",
  "blocked",
];

/**
 * Format success message for task update
 * @param taskId - The ID of the updated task
 * @param status - The new status
 * @returns Formatted success message
 */
export function formatUpdateSuccess(taskId: string, status: string): string {
  return chalk.green(`✓ Task ${chalk.cyan(taskId)} updated to ${chalk.cyan(status)}`);
}

/**
 * Format API error message (kept for backward compatibility, delegates to shared formatter).
 */
export const formatUpdateError = formatError;

/**
 * Validate UUID format
 * @param uuid - The UUID string to validate
 * @returns True if valid UUID format
 */
function isValidUUID(uuid: string): boolean {
  return UUID_REGEX.test(uuid);
}

/**
 * Validate task status
 * @param status - The status to validate
 * @returns True if valid status
 */
function isValidStatus(status: string): status is TaskStatus {
  return VALID_STATUSES.includes(status as TaskStatus);
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

export interface UpdateCommandOptions {
  status?: string;
  title?: string;
  description?: string;
  reason?: string;
  transcript?: string;
}

/**
 * Execute the update task command
 * @param taskId - The ID of the task to update
 * @param options - Command options
 * @returns Exit code (0 for success, 1 for error)
 */
export async function executeUpdate(
  taskId: string,
  options: UpdateCommandOptions
): Promise<number> {
  // Validate task ID format (UUID)
  if (!isValidUUID(taskId)) {
    console.error(chalk.red("Error: Invalid task ID format"));
    console.error(chalk.gray("Task ID must be a valid UUID (e.g., 550e8400-e29b-41d4-a716-446655440000)"));
    return 1;
  }

  // Validate status if provided
  if (options.status && !isValidStatus(options.status)) {
    console.error(chalk.red(`Error: Invalid status "${options.status}"`));
    console.error(chalk.gray(`Valid statuses: ${VALID_STATUSES.join(", ")}`));
    return 1;
  }

  // Check that at least one field is being updated
  if (!options.status && !options.title && !options.description) {
    console.error(chalk.red("Error: No updates specified"));
    console.error(chalk.gray("Use --status, --title, or --description to specify what to update"));
    return 1;
  }

  // Validate reason length if provided
  if (options.reason && options.reason.length > 280) {
    console.error(chalk.red("Error: Reason exceeds maximum length of 280 characters"));
    return 1;
  }

  // Build reasoning object if any reasoning options provided
  let reasoning: Reasoning | undefined;
  if (options.reason || options.transcript) {
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
