import { Hono } from "hono";
import { db } from "../../db/connection";
import { tasks, taskLogs, projects, agents } from "../../db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import {
  createTaskSchema,
  updateTaskSchema,
  taskIdSchema,
  isValidStatusTransition,
  getInvalidTransitionMessage,
  TASK_STATUSES,
} from "../../schemas/tasks";
import { ensureAgentExists, updateAgentLastSeen } from "../../services/agents";

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Schema for claiming a task
const claimTaskSchema = z.object({
  agentId: z.string().regex(UUID_REGEX, "Invalid agent ID format"),
});

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

    // Prepare update values
    const updateValues: Partial<{
      title: string;
      description: string | null;
      status: string;
      updatedAt: Date;
    }> = {
      updatedAt: new Date(),
    };

    if (updates.title !== undefined) {
      updateValues.title = updates.title;
    }
    if (updates.description !== undefined) {
      updateValues.description = updates.description;
    }
    if (updates.status !== undefined) {
      updateValues.status = updates.status;
    }

    // Update task
    await db.update(tasks).set(updateValues).where(eq(tasks.id, id));

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
    const existingTask = await db.select().from(tasks).where(eq(tasks.id, id));

    if (existingTask.length === 0) {
      return c.json({ error: "Task not found" }, 404);
    }

    // Delete task (cascade will handle related logs)
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

    const { agentId } = validationResult.data;

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

    const now = new Date();

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
