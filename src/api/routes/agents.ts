import { Hono } from "hono";
import { db } from "../../db/connection";
import { agents, tasks, taskLogs } from "../../db/schema";
import { eq, inArray, or } from "drizzle-orm";
import { z } from "zod";

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Schema for agent ID parameter
const agentIdSchema = z.string().regex(UUID_REGEX, "Invalid UUID format");

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

export { agentsRouter };
