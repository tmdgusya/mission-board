import { db } from "../db/connection";
import { taskLogs, tasks } from "../db/schema";
import { eq, and, sql } from "drizzle-orm";

// Valid action types for task logs
export type TaskLogAction = "created" | "claimed" | "released" | "updated" | "deleted" | "approval_requested";

// Interface for field changes in update actions
export interface FieldChange {
  field: string;
  old_value: unknown;
  new_value: unknown;
}

// Interface for log details based on action type
export interface CreatedDetails {
  title: string;
  project_id: string;
  task_type: string;
  initial_status: string;
}

export interface ClaimedDetails {
  agent_id: string;
  previous_status: string;
}

export interface ReleasedDetails {
  agent_id: string | null;
  new_status: string;
}

export interface UpdatedDetails {
  field_changes: FieldChange[];
}

export interface DeletedDetails {
  final_state: {
    title: string;
    description: string | null;
    status: string;
    task_type: string;
    project_id: string;
    agent_id: string | null;
  };
}

export type LogDetails = CreatedDetails | ClaimedDetails | ReleasedDetails | UpdatedDetails | DeletedDetails | ApprovalRequestedDetails;

export interface Reasoning {
  reason?: string;
  transcript?: { step: number; thought: string }[];
}

export interface ApprovalRequestedDetails {
  approval_id: string;
  action_requested: string;
}

/**
 * Creates a task log entry
 * @param taskId - The task ID
 * @param agentId - The agent ID (can be null for some operations)
 * @param action - The action type
 * @param details - Structured details object (will be JSON stringified)
 * @returns The created log entry ID
 */
export async function createTaskLog(
  taskId: string,
  agentId: string | null,
  action: TaskLogAction,
  details: LogDetails,
  reasoning?: Reasoning
): Promise<string> {
  const logId = crypto.randomUUID();
  const now = new Date();

  await db.insert(taskLogs).values({
    id: logId,
    taskId,
    agentId,
    action,
    details: JSON.stringify(details),
    reason: reasoning?.reason ?? null,
    transcript: reasoning?.transcript ? JSON.stringify(reasoning.transcript) : null,
    createdAt: now,
  });

  return logId;
}

/**
 * Logs task creation
 * @param taskId - The task ID
 * @param agentId - The agent ID who created the task
 * @param taskData - The task data
 */
export async function logTaskCreated(
  taskId: string,
  agentId: string | null,
  taskData: {
    title: string;
    projectId: string;
    taskType: string;
    status: string;
  }
): Promise<void> {
  await createTaskLog(taskId, agentId, "created", {
    title: taskData.title,
    project_id: taskData.projectId,
    task_type: taskData.taskType,
    initial_status: taskData.status,
  });
}

/**
 * Logs task claim
 * @param taskId - The task ID
 * @param agentId - The agent ID who claimed the task
 * @param previousStatus - The status before claiming
 */
export async function logTaskClaimed(
  taskId: string,
  agentId: string,
  previousStatus: string,
  reasoning?: Reasoning
): Promise<void> {
  await createTaskLog(taskId, agentId, "claimed", {
    agent_id: agentId,
    previous_status: previousStatus,
  }, reasoning);
}

/**
 * Logs task release
 * @param taskId - The task ID
 * @param agentId - The agent ID who released the task
 * @param newStatus - The status after releasing (should be "ready")
 */
export async function logTaskReleased(
  taskId: string,
  agentId: string | null,
  newStatus: string,
  reasoning?: Reasoning
): Promise<void> {
  await createTaskLog(taskId, agentId, "released", {
    agent_id: agentId,
    new_status: newStatus,
  }, reasoning);
}

/**
 * Logs task update
 * @param taskId - The task ID
 * @param agentId - The agent ID who updated the task (can be null)
 * @param fieldChanges - Array of field changes
 */
export async function logTaskUpdated(
  taskId: string,
  agentId: string | null,
  fieldChanges: FieldChange[],
  reasoning?: Reasoning
): Promise<void> {
  if (fieldChanges.length === 0) return;

  await createTaskLog(taskId, agentId, "updated", {
    field_changes: fieldChanges,
  }, reasoning);
}

/**
 * Logs task deletion
 * @param taskId - The task ID
 * @param agentId - The agent ID who deleted the task (can be null)
 * @param finalState - The final state of the task before deletion
 */
export async function logTaskDeleted(
  taskId: string,
  agentId: string | null,
  finalState: {
    title: string;
    description: string | null;
    status: string;
    taskType: string;
    projectId: string;
    agentId: string | null;
  }
): Promise<void> {
  await createTaskLog(taskId, agentId, "deleted", {
    final_state: {
      title: finalState.title,
      description: finalState.description,
      status: finalState.status,
      task_type: finalState.taskType,
      project_id: finalState.projectId,
      agent_id: finalState.agentId,
    },
  });
}

export async function logApprovalRequested(
  taskId: string,
  agentId: string,
  approvalId: string,
  actionRequested: string,
  reasoning?: Reasoning
): Promise<void> {
  await createTaskLog(taskId, agentId, "approval_requested", {
    approval_id: approvalId,
    action_requested: actionRequested,
  }, reasoning);
}

/**
 * Gets task logs with optional filters
 * @param filters - Optional filters
 * @returns Array of task logs
 */
export async function getTaskLogs(filters?: {
  taskId?: string;
  agentId?: string;
  projectId?: string;
  action?: string;
}): Promise<Array<{
  id: string;
  taskId: string | null;
  agentId: string | null;
  action: string;
  details: string | null;
  reason: string | null;
  transcript: string | null;
  createdAt: Date;
}>> {
  let query = db.select().from(taskLogs);

  const conditions = [];

  if (filters?.taskId) {
    conditions.push(eq(taskLogs.taskId, filters.taskId));
  }

  if (filters?.agentId) {
    conditions.push(eq(taskLogs.agentId, filters.agentId));
  }

  if (filters?.action) {
    conditions.push(eq(taskLogs.action, filters.action));
  }

  // For project_id filter, we need to join with tasks table
  if (filters?.projectId) {
    const projectConditions: ReturnType<typeof eq>[] = [eq(tasks.projectId, filters.projectId)];
    
    if (filters?.taskId) {
      projectConditions.push(eq(taskLogs.taskId, filters.taskId));
    }
    if (filters?.agentId) {
      projectConditions.push(eq(taskLogs.agentId, filters.agentId));
    }
    if (filters?.action) {
      projectConditions.push(eq(taskLogs.action, filters.action));
    }

    const joinResults = await db
      .select({
        id: taskLogs.id,
        taskId: taskLogs.taskId,
        agentId: taskLogs.agentId,
        action: taskLogs.action,
        details: taskLogs.details,
        reason: taskLogs.reason,
        transcript: taskLogs.transcript,
        createdAt: taskLogs.createdAt,
      })
      .from(taskLogs)
      .innerJoin(tasks, eq(taskLogs.taskId, tasks.id))
      .where(and(...projectConditions))
      .orderBy(taskLogs.createdAt);

    return joinResults.map((log) => ({
      id: log.id,
      taskId: log.taskId,
      agentId: log.agentId,
      action: log.action,
      details: log.details,
      reason: log.reason,
      transcript: log.transcript,
      createdAt: log.createdAt,
    }));
  }

  if (conditions.length > 0) {
    const results = await query.where(and(...conditions)).orderBy(taskLogs.createdAt);
    return results.map((log) => ({
      id: log.id,
      taskId: log.taskId,
      agentId: log.agentId,
      action: log.action,
      details: log.details,
      reason: log.reason,
      transcript: log.transcript,
      createdAt: log.createdAt,
    }));
  }

  const results = await query.orderBy(taskLogs.createdAt);

  return results.map((log) => ({
    id: log.id,
    taskId: log.taskId,
    agentId: log.agentId,
    action: log.action,
    details: log.details,
    reason: log.reason,
    transcript: log.transcript,
    createdAt: log.createdAt,
  }));
}
