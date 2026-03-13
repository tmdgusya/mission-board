import { Hono } from "hono";
import {
  createApprovalRequestSchema,
} from "../../schemas/approvals";
import {
  createApprovalRequest,
  listApprovalRequests,
} from "../../services/approvals";

const approvalsRouter = new Hono();

// POST /api/approvals - Create a new approval request
approvalsRouter.post("/", async (c) => {
  try {
    const body = await c.req.json();

    // Validate input
    const validationResult = createApprovalRequestSchema.safeParse(body);
    if (!validationResult.success) {
      return c.json(
        {
          error: "Validation failed",
          details: validationResult.error.issues,
        },
        400
      );
    }

    const { taskId, agentId, actionRequested } = validationResult.data;

    const result = await createApprovalRequest({
      taskId,
      agentId,
      actionRequested,
    });

    if (!result.success) {
      const statusCode = result.statusCode as 400 | 404 | 409;
      return c.json({ error: result.error }, statusCode);
    }

    return c.json(result.approval, 201);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return c.json({ error: "Invalid JSON" }, 400);
    }
    console.error("Error creating approval request:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// GET /api/approvals - List approval requests with optional filters
approvalsRouter.get("/", async (c) => {
  try {
    const taskId = c.req.query("task_id");
    const status = c.req.query("status");

    // Validate status if provided
    const validStatuses = ["pending", "approved", "denied"];
    if (status && !validStatuses.includes(status)) {
      return c.json(
        {
          error: "Invalid status filter",
          details: `Valid statuses are: ${validStatuses.join(", ")}`,
        },
        400
      );
    }

    const filters: { taskId?: string; status?: string } = {};
    if (taskId) {
      filters.taskId = taskId;
    }
    if (status) {
      filters.status = status;
    }

    const results = await listApprovalRequests(filters);

    return c.json(results);
  } catch (error) {
    console.error("Error fetching approval requests:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

export { approvalsRouter };
