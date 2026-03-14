import { Hono } from "hono";
import { db } from "../../db/connection";
import { agents, tasks, taskLogs } from "../../db/schema";
import { eq, inArray, or } from "drizzle-orm";
import {
  agentIdSchema,
  createAgentSchema,
  updateAgentSchema,
} from "../../schemas/agents";

const agentsRouter = new Hono();

// GET /api/agents - List all agents
agentsRouter.get("/", async (c) => {
  try {
    const result = await db.select().from(agents);

    const agentsList = result.map((agent) => ({
      id: agent.id,
      name: agent.name,
      createdAt: agent.createdAt,
      lastSeenAt: agent.lastSeenAt,
    }));

    return c.json(agentsList);
  } catch (error) {
    console.error("Error fetching agents:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// GET /api/agents/:id - Get a single agent
agentsRouter.get("/:id", async (c) => {
  try {
    const id = c.req.param("id");

    // Validate UUID format
    const idValidation = agentIdSchema.safeParse(id);
    if (!idValidation.success) {
      return c.json({ error: "Invalid UUID format" }, 400);
    }

    const result = await db.select().from(agents).where(eq(agents.id, id));

    if (result.length === 0) {
      return c.json({ error: "Agent not found" }, 404);
    }

    const agent = result[0]!;
    return c.json({
      id: agent.id,
      name: agent.name,
      createdAt: agent.createdAt,
      lastSeenAt: agent.lastSeenAt,
    });
  } catch (error) {
    console.error("Error fetching agent:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// GET /api/agents/:id/tasks - List all tasks assigned to agent (current and historical)
agentsRouter.get("/:id/tasks", async (c) => {
  try {
    const id = c.req.param("id");

    // Validate UUID format
    const idValidation = agentIdSchema.safeParse(id);
    if (!idValidation.success) {
      return c.json({ error: "Invalid UUID format" }, 400);
    }

    // Check if agent exists
    const agentResult = await db.select().from(agents).where(eq(agents.id, id));
    if (agentResult.length === 0) {
      return c.json({ error: "Agent not found" }, 404);
    }

    // Get current tasks assigned to this agent
    const currentTasks = await db
      .select()
      .from(tasks)
      .where(eq(tasks.agentId, id));

    // Get historical tasks from task_logs (tasks this agent worked on but may not own now)
    const historicalTaskLogs = await db
      .select({ taskId: taskLogs.taskId })
      .from(taskLogs)
      .where(eq(taskLogs.agentId, id));

    const historicalTaskIds = historicalTaskLogs
      .map((log) => log.taskId)
      .filter((taskId): taskId is string => taskId !== null);

    // Combine current and historical task IDs, removing duplicates
    const currentTaskIds = currentTasks.map((t) => t.id);
    const allTaskIds = [...new Set([...currentTaskIds, ...historicalTaskIds])];

    // If no tasks found, return empty array
    if (allTaskIds.length === 0) {
      return c.json([]);
    }

    // Fetch all tasks (current + historical)
    const allTasks = await db
      .select()
      .from(tasks)
      .where(inArray(tasks.id, allTaskIds));

    const tasksList = allTasks.map((task) => ({
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
    console.error("Error fetching agent tasks:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// POST /api/agents - Register or update an agent
agentsRouter.post("/", async (c) => {
  try {
    const body = await c.req.json();
    const validation = createAgentSchema.safeParse(body);
    if (!validation.success) {
      return c.json(
        { error: "Validation failed", details: validation.error.issues },
        400
      );
    }

    const { id, name } = validation.data;
    const now = new Date();

    // Check if agent already exists
    const existing = await db.select().from(agents).where(eq(agents.id, id));

    if (existing.length > 0) {
      // Update existing agent's name and lastSeenAt
      await db
        .update(agents)
        .set({ name, lastSeenAt: now })
        .where(eq(agents.id, id));

      const updated = await db.select().from(agents).where(eq(agents.id, id));
      const agent = updated[0]!;
      return c.json({
        id: agent.id,
        name: agent.name,
        createdAt: agent.createdAt,
        lastSeenAt: agent.lastSeenAt,
      });
    }

    // Create new agent
    await db.insert(agents).values({
      id,
      name,
      createdAt: now,
      lastSeenAt: now,
    });

    const created = await db.select().from(agents).where(eq(agents.id, id));
    const agent = created[0]!;
    return c.json(
      {
        id: agent.id,
        name: agent.name,
        createdAt: agent.createdAt,
        lastSeenAt: agent.lastSeenAt,
      },
      201
    );
  } catch (error) {
    console.error("Error registering agent:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// PATCH /api/agents/:id - Update agent name
agentsRouter.patch("/:id", async (c) => {
  try {
    const id = c.req.param("id");

    // Validate UUID format
    const idValidation = agentIdSchema.safeParse(id);
    if (!idValidation.success) {
      return c.json({ error: "Invalid UUID format" }, 400);
    }

    const body = await c.req.json();
    const validation = updateAgentSchema.safeParse(body);
    if (!validation.success) {
      return c.json(
        { error: "Validation failed", details: validation.error.issues },
        400
      );
    }

    const { name } = validation.data;

    // Check if agent exists
    const existing = await db.select().from(agents).where(eq(agents.id, id));
    if (existing.length === 0) {
      return c.json({ error: "Agent not found" }, 404);
    }

    // Update agent name and lastSeenAt
    const now = new Date();
    await db
      .update(agents)
      .set({ name, lastSeenAt: now })
      .where(eq(agents.id, id));

    const updated = await db.select().from(agents).where(eq(agents.id, id));
    const agent = updated[0]!;
    return c.json({
      id: agent.id,
      name: agent.name,
      createdAt: agent.createdAt,
      lastSeenAt: agent.lastSeenAt,
    });
  } catch (error) {
    console.error("Error updating agent:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

export { agentsRouter };
