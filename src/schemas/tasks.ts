import { z } from "zod";

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Schema for a single transcript step
export const transcriptStepSchema = z.object({
  step: z.number().int().positive().max(100),
  thought: z.string().min(1).max(2000),
});

// Schema for agent reasoning - can be merged into other schemas
export const reasoningSchema = z.object({
  reason: z.string().max(280).optional(),
  transcript: z.array(transcriptStepSchema).max(50).optional(),
}).strict();

// Valid task statuses
export const TASK_STATUSES = [
  "backlog",
  "ready",
  "in_progress",
  "review",
  "done",
  "blocked",
] as const;

// Valid task types
export const TASK_TYPES = [
  "implementation",
  "bugfix",
  "feature",
  "deployment",
  "documentation",
  "testing",
  "research",
  "other",
] as const;

// Schema for creating a task
export const createTaskSchema = z.object({
  agentId: z.string().regex(UUID_REGEX, "Invalid agent ID format").optional(),
  projectId: z.string().regex(UUID_REGEX, "Invalid project ID format"),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  taskType: z.enum(TASK_TYPES),
  requiresApproval: z.boolean().optional().default(false),
});

// Schema for updating a task
export const updateTaskSchema = z.object({
  title: z.string().min(1, "Title cannot be empty").optional(),
  description: z.string().optional(),
  status: z.enum(TASK_STATUSES).optional(),
}).merge(reasoningSchema);

// Schema for claiming a task
export const claimTaskSchema = z.object({
  agentId: z.string().regex(UUID_REGEX, "Invalid agent ID format"),
}).merge(reasoningSchema);

// Schema for releasing a task
export const releaseTaskSchema = reasoningSchema;

// Schema for task ID parameter
export const taskIdSchema = z.string().regex(UUID_REGEX, "Invalid UUID format");

// Valid status transitions map
// Key: current status, Value: array of valid next statuses
export const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  backlog: ["ready", "blocked"],
  ready: ["backlog", "in_progress", "blocked"],
  in_progress: ["ready", "review", "blocked"],
  review: ["in_progress", "done", "blocked"],
  done: ["review", "blocked"],
  blocked: ["backlog", "ready", "in_progress", "review", "done"],
};

/**
 * Check if a status transition is valid
 * @param currentStatus - The current status of the task
 * @param newStatus - The requested new status
 * @returns boolean indicating if the transition is valid
 */
export function isValidStatusTransition(
  currentStatus: string,
  newStatus: string
): boolean {
  // Same status is always valid (no-op)
  if (currentStatus === newStatus) {
    return true;
  }

  const validTransitions = VALID_STATUS_TRANSITIONS[currentStatus];
  if (!validTransitions) {
    return false;
  }

  return validTransitions.includes(newStatus);
}

/**
 * Get a human-readable error message for invalid status transitions
 * @param currentStatus - The current status of the task
 * @param newStatus - The requested new status
 * @returns Error message string
 */
export function getInvalidTransitionMessage(
  currentStatus: string,
  newStatus: string
): string {
  const validTransitions = VALID_STATUS_TRANSITIONS[currentStatus];
  if (!validTransitions || validTransitions.length === 0) {
    return `Invalid status transition from "${currentStatus}" to "${newStatus}". No valid transitions available.`;
  }

  return `Invalid status transition from "${currentStatus}" to "${newStatus}". Valid transitions from "${currentStatus}" are: ${validTransitions.join(", ")}`;
}

// Type exports
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type ClaimTaskInput = z.infer<typeof claimTaskSchema>;
export type ReleaseTaskInput = z.infer<typeof releaseTaskSchema>;
export type TaskStatus = (typeof TASK_STATUSES)[number];
export type TaskType = (typeof TASK_TYPES)[number];
export type TranscriptStep = z.infer<typeof transcriptStepSchema>;
export type ReasoningInput = z.infer<typeof reasoningSchema>;
