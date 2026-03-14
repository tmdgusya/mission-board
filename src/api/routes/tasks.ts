import { Hono } from "hono";
import { db } from "../../db/connection";
import { tasks, taskLogs, projects, agents } from "../../db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import {
  createTaskSchema,
  updateTaskSchema,
  taskIdSchema,
  claimTaskSchema,
  releaseTaskSchema,
  isValidStatusTransition,
  getInvalidTransitionMessage,
  TASK_STATUSES,
  type ClaimTaskInput,
} from "../../schemas/tasks";
import { ensureAgentExists, updateAgentLastSeen } from "../../services/agents";
import {
  logTaskCreated,
  logTaskClaimed,
  logTaskReleased,
  logTaskUpdated,
  logTaskDeleted,
} from "../../services/taskLogs";

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const tasksRouter = new Hono();

// POST /api/tasks - Create a new task
tasksRouter.post("/", async (c) => {
  try {
    const body = await c.req.json();

    // Validate input
    const validationResult = createTaskSchema.safeParse(body);
    if (!validationResult.success) {
      return c.json(
        {
          error: "Validation failed",
          details: validationResult.error.issues,
        },
        400
      );
    }

    const { agentId, projectId, title, description, taskType, requiresApproval } =
      validationResult.data;

    // Check if project exists
    const projectResult = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId));

    if (projectResult.length === 0) {
      return c.json({ error: "Project not found" }, 404);
    }

    // Auto-register agent if it doesn't exist, or update last_seen_at
    if (agentId) {
      await ensureAgentExists(agentId);
    }

    const now = new Date();
    const taskId = crypto.randomUUID();

    // Insert task with default status "backlog"
    await db.insert(tasks).values({
      id: taskId,
      projectId,
      agentId,
      title,
      description: description || null,
      taskType,
      requiresApproval: requiresApproval ?? false,
      status: "backlog",
      createdAt: now,
      updatedAt: now,
      claimedAt: null,
    });

    // Fetch the created task
    const result = await db.select().from(tasks).where(eq(tasks.id, taskId));

    if (result.length === 0) {
      return c.json({ error: "Failed to create task" }, 500);
    }

    // Log task creation
    await logTaskCreated(taskId, agentId || null, {
      title,
      projectId,
      taskType,
      status: "backlog",
    });

    const task = result[0]!;
    return c.json(
      {
        id: task.id,
        projectId: task.projectId,
        agentId: task.agentId,
        title: task.title,
        description: task.description,
        taskType: task.taskType,
        requiresApproval: task.requiresApproval,
        status: task.status,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
        claimedAt: task.claimedAt,
      },
      201
    );
  } catch (error) {
    if (error instanceof SyntaxError) {
      return c.json({ error: "Invalid JSON" }, 400);
    }
    console.error("Error creating task:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// GET /api/tasks - List all tasks with optional filters
tasksRouter.get("/", async (c) => {
  try {
    const projectId = c.req.query("project_id");
    const status = c.req.query("status");
    const agentId = c.req.query("agent_id");

    // Build conditions array
    const conditions = [];

    if (projectId) {
      conditions.push(eq(tasks.projectId, projectId));
    }

    if (status) {
      conditions.push(eq(tasks.status, status));
    }

    if (agentId) {
      conditions.push(eq(tasks.agentId, agentId));
    }

    // Execute query with or without conditions
    const result =
      conditions.length > 0
        ? await db.select().from(tasks).where(and(...conditions))
        : await db.select().from(tasks);

    const tasksList = result.map((task) => ({
      id: task.id,
      projectId: task.projectId,
      agentId: task.agentId,
      title: task.title,
      description: task.description,
      taskType: task.taskType,
      requiresApproval: task.requiresApproval,
      status: task.status,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      claimedAt: task.claimedAt,
    }));

    return c.json(tasksList);
  } catch (error) {
    console.error("Error fetching tasks:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// GET /api/tasks/:id - Get a single task
tasksRouter.get("/:id", async (c) => {
  try {
    const id = c.req.param("id");

    // Validate UUID format
    const idValidation = taskIdSchema.safeParse(id);
    if (!idValidation.success) {
      return c.json({ error: "Invalid UUID format" }, 400);
    }

    const result = await db.select().from(tasks).where(eq(tasks.id, id));

    if (result.length === 0) {
      return c.json({ error: "Task not found" }, 404);
    }

    const task = result[0]!;
    return c.json({
      id: task.id,
      projectId: task.projectId,
      agentId: task.agentId,
      title: task.title,
      description: task.description,
      taskType: task.taskType,
      requiresApproval: task.requiresApproval,
      status: task.status,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      claimedAt: task.claimedAt,
    });
  } catch (error) {
    console.error("Error fetching task:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// PATCH /api/tasks/:id - Update a task
tasksRouter.patch("/:id", async (c) => {
  try {
    const id = c.req.param("id");

    // Validate UUID format
    const idValidation = taskIdSchema.safeParse(id);
    if (!idValidation.success) {
      return c.json({ error: "Invalid UUID format" }, 400);
    }

    const body = await c.req.json();

    // Validate input
    const validationResult = updateTaskSchema.safeParse(body);
    if (!validationResult.success) {
      return c.json(
        {
          error: "Validation failed",
          details: validationResult.error.issues,
        },
        400
      );
    }

    const updates = validationResult.data;

    // Check if task exists
    const existingTaskResult = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, id));

    if (existingTaskResult.length === 0) {
      return c.json({ error: "Task not found" }, 404);
    }

    const existingTask = existingTaskResult[0]!;

    // Validate status transition if status is being updated
    if (updates.status && updates.status !== existingTask.status) {
      if (!isValidStatusTransition(existingTask.status, updates.status)) {
        return c.json(
          {
            error: getInvalidTransitionMessage(existingTask.status, updates.status),
          },
          400
        );
      }
    }

    // Track field changes for logging
    const fieldChanges: Array<{ field: string; old_value: unknown; new_value: unknown }> = [];

    // Prepare update values
    const updateValues: Partial<{
      title: string;
      description: string | null;
      status: string;
      updatedAt: Date;
    }> = {
      updatedAt: new Date(),
    };

    if (updates.title !== undefined && updates.title !== existingTask.title) {
      updateValues.title = updates.title;
      fieldChanges.push({
        field: "title",
        old_value: existingTask.title,
        new_value: updates.title,
      });
    }
    if (updates.description !== undefined && updates.description !== existingTask.description) {
      updateValues.description = updates.description;
      fieldChanges.push({
        field: "description",
        old_value: existingTask.description,
        new_value: updates.description,
      });
    }
    if (updates.status !== undefined && updates.status !== existingTask.status) {
      updateValues.status = updates.status;
      fieldChanges.push({
        field: "status",
        old_value: existingTask.status,
        new_value: updates.status,
      });
    }

    // Update task
    await db.update(tasks).set(updateValues).where(eq(tasks.id, id));

    // Log task update if there were changes
    if (fieldChanges.length > 0) {
      const reasoning = updates.reason || updates.transcript
        ? { reason: updates.reason, transcript: updates.transcript }
        : undefined;
      await logTaskUpdated(id, existingTask.agentId, fieldChanges, reasoning);
    }

    // Fetch updated task
    const result = await db.select().from(tasks).where(eq(tasks.id, id));

    const task = result[0]!;
    return c.json({
      id: task.id,
      projectId: task.projectId,
      agentId: task.agentId,
      title: task.title,
      description: task.description,
      taskType: task.taskType,
      requiresApproval: task.requiresApproval,
      status: task.status,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      claimedAt: task.claimedAt,
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return c.json({ error: "Invalid JSON" }, 400);
    }
    console.error("Error updating task:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// DELETE /api/tasks/:id - Delete a task (cascade deletes logs)
tasksRouter.delete("/:id", async (c) => {
  try {
    const id = c.req.param("id");

    // Validate UUID format
    const idValidation = taskIdSchema.safeParse(id);
    if (!idValidation.success) {
      return c.json({ error: "Invalid UUID format" }, 400);
    }

    // Check if task exists
    const existingTaskResult = await db.select().from(tasks).where(eq(tasks.id, id));

    if (existingTaskResult.length === 0) {
      return c.json({ error: "Task not found" }, 404);
    }

    const existingTask = existingTaskResult[0]!;

    // Log task deletion before deleting (need to capture final state)
    await logTaskDeleted(id, existingTask.agentId, {
      title: existingTask.title,
      description: existingTask.description,
      status: existingTask.status,
      taskType: existingTask.taskType,
      projectId: existingTask.projectId,
      agentId: existingTask.agentId,
    });

    // Delete task (cascade will handle related logs, but the deleted log remains)
    await db.delete(tasks).where(eq(tasks.id, id));

    return c.body(null, 204);
  } catch (error) {
    console.error("Error deleting task:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// POST /api/tasks/:id/claim - Claim a task
// Sets agent_id, claimed_at, transitions status to in_progress from backlog/ready
// Returns 409 if already claimed
tasksRouter.post("/:id/claim", async (c) => {
  try {
    const id = c.req.param("id");

    // Validate UUID format
    const idValidation = taskIdSchema.safeParse(id);
    if (!idValidation.success) {
      return c.json({ error: "Invalid UUID format" }, 400);
    }

    const body = await c.req.json();

    // Validate input
    const validationResult = claimTaskSchema.safeParse(body);
    if (!validationResult.success) {
      return c.json(
        {
          error: "Validation failed",
          details: validationResult.error.issues,
        },
        400
      );
    }

    const { agentId, reason, transcript } = validationResult.data;

    // Auto-register agent if it doesn't exist, or update last_seen_at
    await ensureAgentExists(agentId);

    // Check if task exists
    const existingTaskResult = await db.select().from(tasks).where(eq(tasks.id, id));
    if (existingTaskResult.length === 0) {
      return c.json({ error: "Task not found" }, 404);
    }

    const existingTask = existingTaskResult[0]!;

    // Check if task is already claimed by another agent
    if (existingTask.agentId && existingTask.agentId !== agentId) {
      // Safely format claimedAt date
      let claimedAtStr: string | null = null;
      if (existingTask.claimedAt) {
        try {
          const date = existingTask.claimedAt instanceof Date 
            ? existingTask.claimedAt 
            : new Date(existingTask.claimedAt);
          if (!isNaN(date.getTime())) {
            claimedAtStr = date.toISOString();
          }
        } catch {
          claimedAtStr = null;
        }
      }

      return c.json(
        {
          error: `Task is already claimed by another agent`,
          currentOwner: {
            agentId: existingTask.agentId,
            claimedAt: claimedAtStr,
          },
        },
        409
      );
    }

    // Check if task can be claimed (only from backlog or ready status)
    const claimableStatuses = ["backlog", "ready"];
    if (!claimableStatuses.includes(existingTask.status)) {
      return c.json(
        {
          error: `Cannot claim task in "${existingTask.status}" status. Task can only be claimed from: ${claimableStatuses.join(", ")}`,
        },
        400
      );
    }

    const now = new Date();
    const previousStatus = existingTask.status;

    // Update task: set agent_id, claimed_at, status to in_progress
    await db
      .update(tasks)
      .set({
        agentId,
        claimedAt: now,
        status: "in_progress",
        updatedAt: now,
      })
      .where(eq(tasks.id, id));

    // Log task claim with reasoning if provided
    const reasoning = reason || transcript
      ? { reason, transcript }
      : undefined;
    await logTaskClaimed(id, agentId, previousStatus, reasoning);

    // Fetch updated task
    const result = await db.select().from(tasks).where(eq(tasks.id, id));
    const task = result[0]!;

    return c.json({
      id: task.id,
      projectId: task.projectId,
      agentId: task.agentId,
      title: task.title,
      description: task.description,
      taskType: task.taskType,
      requiresApproval: task.requiresApproval,
      status: task.status,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      claimedAt: task.claimedAt,
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return c.json({ error: "Invalid JSON" }, 400);
    }
    console.error("Error claiming task:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// POST /api/tasks/:id/release - Release a claimed task
// Clears agent_id, claimed_at, sets status to ready
tasksRouter.post("/:id/release", async (c) => {
  try {
    const id = c.req.param("id");

    // Validate UUID format
    const idValidation = taskIdSchema.safeParse(id);
    if (!idValidation.success) {
      return c.json({ error: "Invalid UUID format" }, 400);
    }

    // Check if task exists
    const existingTaskResult = await db.select().from(tasks).where(eq(tasks.id, id));
    if (existingTaskResult.length === 0) {
      return c.json({ error: "Task not found" }, 404);
    }

    const existingTask = existingTaskResult[0]!;
    const now = new Date();
    const releasingAgentId = existingTask.agentId;

    // Parse and validate body for optional reasoning fields
    const body = await c.req.json().catch(() => ({}));
    const validationResult = releaseTaskSchema.safeParse(body);
    if (!validationResult.success) {
      return c.json(
        {
          error: "Validation failed",
          details: validationResult.error.issues,
        },
        400
      );
    }
    const reasoning = validationResult.data.reason || validationResult.data.transcript
      ? { reason: validationResult.data.reason, transcript: validationResult.data.transcript }
      : undefined;

    // Update task: clear agent_id, claimed_at, set status to ready
    await db
      .update(tasks)
      .set({
        agentId: null,
        claimedAt: null,
        status: "ready",
        updatedAt: now,
      })
      .where(eq(tasks.id, id));

    // Log task release with reasoning if provided
    await logTaskReleased(id, releasingAgentId, "ready", reasoning);

    // Fetch updated task
    const result = await db.select().from(tasks).where(eq(tasks.id, id));
    const task = result[0]!;

    return c.json({
      id: task.id,
      projectId: task.projectId,
      agentId: task.agentId,
      title: task.title,
      description: task.description,
      taskType: task.taskType,
      requiresApproval: task.requiresApproval,
      status: task.status,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      claimedAt: task.claimedAt,
    });
  } catch (error) {
    console.error("Error releasing task:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

export { tasksRouter };
