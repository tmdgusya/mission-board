/**
 * Client-side status transition validation.
 * Must match the backend rules in src/schemas/tasks.ts
 */

export const TASK_STATUSES = [
  "backlog",
  "ready",
  "in_progress",
  "review",
  "done",
  "blocked",
] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

export const STATUS_LABELS: Record<TaskStatus, string> = {
  backlog: "Backlog",
  ready: "Ready",
  in_progress: "In Progress",
  review: "Review",
  done: "Done",
  blocked: "Blocked",
};

export const STATUS_COLORS: Record<TaskStatus, string> = {
  backlog: "#64748b",
  ready: "#3b82f6",
  in_progress: "#ffaa00",
  review: "#8b5cf6",
  done: "#00ff66",
  blocked: "#ff3333",
};

/**
 * Valid status transitions map.
 * Key: current status, Value: array of valid next statuses.
 */
const VALID_STATUS_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  backlog: ["ready", "blocked"],
  ready: ["backlog", "in_progress", "blocked"],
  in_progress: ["ready", "review", "blocked"],
  review: ["in_progress", "done", "blocked"],
  done: ["review", "blocked"],
  blocked: ["backlog", "ready", "in_progress", "review", "done"],
};

export function isValidStatusTransition(
  from: TaskStatus,
  to: TaskStatus
): boolean {
  if (from === to) return true;
  return VALID_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

export function getInvalidTransitionMessage(
  from: TaskStatus,
  to: TaskStatus
): string {
  const valid = VALID_STATUS_TRANSITIONS[from];
  if (!valid || valid.length === 0) {
    return `Cannot move from "${STATUS_LABELS[from]}" to "${STATUS_LABELS[to]}". No valid transitions available.`;
  }
  return `Cannot move from "${STATUS_LABELS[from]}" to "${STATUS_LABELS[to]}". Valid moves: ${valid.map((s) => STATUS_LABELS[s]).join(", ")}`;
}
