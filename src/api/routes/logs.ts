import { Hono } from "hono";
import { z } from "zod";
import { getTaskLogs } from "../../services/taskLogs";

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Valid action types
const VALID_ACTIONS = ["created", "claimed", "released", "updated", "deleted", "approval_requested"] as const;

// Query schema for logs
const logsQuerySchema = z.object({
  task_id: z.string().regex(UUID_REGEX, "Invalid task ID format").optional(),
  agent_id: z.string().regex(UUID_REGEX, "Invalid agent ID format").optional(),
  project_id: z.string().regex(UUID_REGEX, "Invalid project ID format").optional(),
  action: z.enum(VALID_ACTIONS).optional(),
});

const logsRouter = new Hono();

// GET /api/logs - List task logs with optional filters
logsRouter.get("/", async (c) => {
  try {
    const query = c.req.query();

    // Validate query parameters
    const validationResult = logsQuerySchema.safeParse(query);
    if (!validationResult.success) {
      return c.json(
        {
          error: "Validation failed",
          details: validationResult.error.issues,
        },
        400
      );
    }

    const filters = validationResult.data;

    // Fetch logs with filters
    const logs = await getTaskLogs({
      taskId: filters.task_id,
      agentId: filters.agent_id,
      projectId: filters.project_id,
      action: filters.action,
    });

    // Format response
    const formattedLogs = logs.map((log) => ({
      id: log.id,
      taskId: log.taskId,
      agentId: log.agentId,
      action: log.action,
      details: log.details,
      reason: log.reason,
      transcript: log.transcript,
      createdAt: log.createdAt,
    }));

    return c.json(formattedLogs);
  } catch (error) {
    console.error("Error fetching logs:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

export { logsRouter };
