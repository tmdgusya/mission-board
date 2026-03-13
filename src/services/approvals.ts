import { db } from "../db/connection";
import { approvalRequests, tasks, taskLogs, agents } from "../db/schema";
import { eq, and, desc } from "drizzle-orm";

/**
 * Creates a new approval request.
 * Validates:
 * - Task exists
 * - Task requires approval (requires_approval=true)
 * - No pending approval already exists for this task
 *
 * On success, transitions task status to 'review' and logs the action.
 */
export async function createApprovalRequest(params: {
  taskId: string;
  agentId: string;
  actionRequested: string;
}): Promise<{
  success: true;
  approval: {
    id: string;
    taskId: string;
    agentId: string;
    actionRequested: string;
    status: string;
    createdAt: Date;
  };
  previousTaskStatus: string;
} | {
  success: false;
  error: string;
  statusCode: number;
}> {
  const { taskId, agentId, actionRequested } = params;

  // Check if task exists
  const taskResult = await db.select().from(tasks).where(eq(tasks.id, taskId));
  if (taskResult.length === 0) {
    return { success: false, error: "Task not found", statusCode: 404 };
  }

  const task = taskResult[0]!;

  // Check if task requires approval
  if (!task.requiresApproval) {
    return {
      success: false,
      error: "Task does not require approval",
      statusCode: 400,
    };
  }

  // Check if there's already a pending approval for this task
  const existingPending = await db
    .select()
    .from(approvalRequests)
    .where(
      and(
        eq(approvalRequests.taskId, taskId),
        eq(approvalRequests.status, "pending")
      )
    );

  if (existingPending.length > 0) {
    return {
      success: false,
      error: "An approval request is already pending for this task",
      statusCode: 409,
    };
  }

  // Auto-register agent if needed
  const now = new Date();
  const existingAgent = await db.select().from(agents).where(eq(agents.id, agentId));
  if (existingAgent.length === 0) {
    try {
      await db.insert(agents).values({
        id: agentId,
        name: agentId,
        createdAt: now,
        lastSeenAt: now,
      });
    } catch {
      // Race condition - update last_seen instead
      await db.update(agents).set({ lastSeenAt: now }).where(eq(agents.id, agentId));
    }
  } else {
    await db.update(agents).set({ lastSeenAt: now }).where(eq(agents.id, agentId));
  }

  const previousTaskStatus = task.status;

  // Create the approval request
  const approvalId = crypto.randomUUID();
  await db.insert(approvalRequests).values({
    id: approvalId,
    taskId,
    agentId,
    actionRequested,
    status: "pending",
    createdAt: now,
  });

  // Transition task status to 'review'
  await db
    .update(tasks)
    .set({
      status: "review",
      updatedAt: now,
    })
    .where(eq(tasks.id, taskId));

  // Log the status change
  await db.insert(taskLogs).values({
    id: crypto.randomUUID(),
    taskId,
    agentId,
    action: "updated",
    details: JSON.stringify({
      field_changes: [
        {
          field: "status",
          old_value: previousTaskStatus,
          new_value: "review",
        },
      ],
    }),
    createdAt: now,
  });

  // Log the approval request creation
  await db.insert(taskLogs).values({
    id: crypto.randomUUID(),
    taskId,
    agentId,
    action: "created",
    details: JSON.stringify({
      approval_request_id: approvalId,
      action_requested: actionRequested,
    }),
    createdAt: now,
  });

  return {
    success: true,
    approval: {
      id: approvalId,
      taskId,
      agentId,
      actionRequested,
      status: "pending",
      createdAt: now,
    },
    previousTaskStatus,
  };
}

/**
 * Lists approval requests with optional filters.
 * Filters: task_id, status
 */
export async function listApprovalRequests(filters?: {
  taskId?: string;
  status?: string;
}): Promise<Array<{
  id: string;
  taskId: string;
  agentId: string;
  actionRequested: string;
  status: string;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  notes: string | null;
  createdAt: Date;
}>> {
  const conditions = [];

  if (filters?.taskId) {
    conditions.push(eq(approvalRequests.taskId, filters.taskId));
  }

  if (filters?.status) {
    conditions.push(eq(approvalRequests.status, filters.status));
  }

  const results =
    conditions.length > 0
      ? await db
          .select()
          .from(approvalRequests)
          .where(and(...conditions))
          .orderBy(desc(approvalRequests.createdAt))
      : await db
          .select()
          .from(approvalRequests)
          .orderBy(desc(approvalRequests.createdAt));

  return results.map((ar) => ({
    id: ar.id,
    taskId: ar.taskId,
    agentId: ar.agentId,
    actionRequested: ar.actionRequested,
    status: ar.status,
    reviewedBy: ar.reviewedBy,
    reviewedAt: ar.reviewedAt,
    notes: ar.notes,
    createdAt: ar.createdAt,
  }));
}

/**
 * Approves a pending approval request.
 * Validates:
 * - Approval request exists
 * - Approval is still pending (not already approved/denied)
 *
 * On success, sets status='approved', reviewed_by, reviewed_at,
 * transitions task status from 'review' to 'ready', and logs the action.
 */
export async function approveApprovalRequest(params: {
  approvalId: string;
  reviewedBy: string;
}): Promise<{
  success: true;
  approval: {
    id: string;
    taskId: string;
    agentId: string;
    actionRequested: string;
    status: string;
    reviewedBy: string;
    reviewedAt: Date;
    notes: string | null;
    createdAt: Date;
  };
} | {
  success: false;
  error: string;
  statusCode: number;
}> {
  const { approvalId, reviewedBy } = params;

  // Check if approval request exists
  const approvalResult = await db
    .select()
    .from(approvalRequests)
    .where(eq(approvalRequests.id, approvalId));

  if (approvalResult.length === 0) {
    return { success: false, error: "Approval request not found", statusCode: 404 };
  }

  const approval = approvalResult[0]!;

  // Check if already processed
  if (approval.status !== "pending") {
    return {
      success: false,
      error: `Approval request has already been ${approval.status}`,
      statusCode: 409,
    };
  }

  // Auto-register reviewer if needed
  const now = new Date();
  const existingReviewer = await db.select().from(agents).where(eq(agents.id, reviewedBy));
  if (existingReviewer.length === 0) {
    try {
      await db.insert(agents).values({
        id: reviewedBy,
        name: reviewedBy,
        createdAt: now,
        lastSeenAt: now,
      });
    } catch {
      // Race condition - update last_seen instead
      await db.update(agents).set({ lastSeenAt: now }).where(eq(agents.id, reviewedBy));
    }
  } else {
    await db.update(agents).set({ lastSeenAt: now }).where(eq(agents.id, reviewedBy));
  }

  // Update the approval request
  await db
    .update(approvalRequests)
    .set({
      status: "approved",
      reviewedBy,
      reviewedAt: now,
    })
    .where(eq(approvalRequests.id, approvalId));

  // Transition task status from 'review' to 'ready'
  await db
    .update(tasks)
    .set({
      status: "ready",
      updatedAt: now,
    })
    .where(eq(tasks.id, approval.taskId));

  // Log the status change
  await db.insert(taskLogs).values({
    id: crypto.randomUUID(),
    taskId: approval.taskId,
    agentId: approval.agentId,
    action: "updated",
    details: JSON.stringify({
      field_changes: [
        {
          field: "status",
          old_value: "review",
          new_value: "ready",
        },
      ],
    }),
    createdAt: now,
  });

  // Log the approval action
  await db.insert(taskLogs).values({
    id: crypto.randomUUID(),
    taskId: approval.taskId,
    agentId: reviewedBy,
    action: "created",
    details: JSON.stringify({
      approval_request_id: approvalId,
      action: "approved",
    }),
    createdAt: now,
  });

  return {
    success: true,
    approval: {
      id: approvalId,
      taskId: approval.taskId,
      agentId: approval.agentId,
      actionRequested: approval.actionRequested,
      status: "approved",
      reviewedBy,
      reviewedAt: now,
      notes: approval.notes,
      createdAt: approval.createdAt,
    },
  };
}

/**
 * Denies a pending approval request.
 * Validates:
 * - Approval request exists
 * - Approval is still pending (not already approved/denied)
 * - Notes are provided (required for denial)
 *
 * On success, sets status='denied', reviewed_by, reviewed_at, notes,
 * transitions task status from 'review' to 'blocked', and logs the action.
 */
export async function denyApprovalRequest(params: {
  approvalId: string;
  reviewedBy: string;
  notes: string;
}): Promise<{
  success: true;
  approval: {
    id: string;
    taskId: string;
    agentId: string;
    actionRequested: string;
    status: string;
    reviewedBy: string;
    reviewedAt: Date;
    notes: string;
    createdAt: Date;
  };
} | {
  success: false;
  error: string;
  statusCode: number;
}> {
  const { approvalId, reviewedBy, notes } = params;

  // Check if approval request exists
  const approvalResult = await db
    .select()
    .from(approvalRequests)
    .where(eq(approvalRequests.id, approvalId));

  if (approvalResult.length === 0) {
    return { success: false, error: "Approval request not found", statusCode: 404 };
  }

  const approval = approvalResult[0]!;

  // Check if already processed
  if (approval.status !== "pending") {
    return {
      success: false,
      error: `Approval request has already been ${approval.status}`,
      statusCode: 409,
    };
  }

  // Auto-register reviewer if needed
  const now = new Date();
  const existingReviewer = await db.select().from(agents).where(eq(agents.id, reviewedBy));
  if (existingReviewer.length === 0) {
    try {
      await db.insert(agents).values({
        id: reviewedBy,
        name: reviewedBy,
        createdAt: now,
        lastSeenAt: now,
      });
    } catch {
      // Race condition - update last_seen instead
      await db.update(agents).set({ lastSeenAt: now }).where(eq(agents.id, reviewedBy));
    }
  } else {
    await db.update(agents).set({ lastSeenAt: now }).where(eq(agents.id, reviewedBy));
  }

  // Update the approval request
  await db
    .update(approvalRequests)
    .set({
      status: "denied",
      reviewedBy,
      reviewedAt: now,
      notes,
    })
    .where(eq(approvalRequests.id, approvalId));

  // Transition task status from 'review' to 'blocked'
  await db
    .update(tasks)
    .set({
      status: "blocked",
      updatedAt: now,
    })
    .where(eq(tasks.id, approval.taskId));

  // Log the status change
  await db.insert(taskLogs).values({
    id: crypto.randomUUID(),
    taskId: approval.taskId,
    agentId: approval.agentId,
    action: "updated",
    details: JSON.stringify({
      field_changes: [
        {
          field: "status",
          old_value: "review",
          new_value: "blocked",
        },
      ],
    }),
    createdAt: now,
  });

  // Log the denial action
  await db.insert(taskLogs).values({
    id: crypto.randomUUID(),
    taskId: approval.taskId,
    agentId: reviewedBy,
    action: "created",
    details: JSON.stringify({
      approval_request_id: approvalId,
      action: "denied",
      notes,
    }),
    createdAt: now,
  });

  return {
    success: true,
    approval: {
      id: approvalId,
      taskId: approval.taskId,
      agentId: approval.agentId,
      actionRequested: approval.actionRequested,
      status: "denied",
      reviewedBy,
      reviewedAt: now,
      notes,
      createdAt: approval.createdAt,
    },
  };
}
