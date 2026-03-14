import { Hono } from "hono";
import {
  createApprovalRequestSchema,
  approveRequestSchema,
  denyRequestSchema,
  approvalIdSchema,
} from "../../schemas/approvals";
import {
  createApprovalRequest,
  listApprovalRequests,
  approveApprovalRequest,
  denyApprovalRequest,
} from "../../services/approvals";
import { logApprovalRequested } from "../../services/taskLogs";

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

    const { taskId, agentId, actionRequested, reason, transcript } = validationResult.data;

    const result = await createApprovalRequest({
      taskId,
      agentId,
      actionRequested,
    });

    if (!result.success) {
      const statusCode = result.statusCode as 400 | 404 | 409;
      return c.json({ error: result.error }, statusCode);
    }

    // Log the approval request with reasoning if provided
    const reasoning = reason || transcript ? { reason, transcript } : undefined;
    await logApprovalRequested(
      taskId,
      agentId,
      result.approval.id,
      actionRequested,
      reasoning
    );

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

// POST /api/approvals/:id/approve - Approve a pending approval request
approvalsRouter.post("/:id/approve", async (c) => {
  try {
    // Validate approval ID parameter
    const idParam = c.req.param("id");
    const idValidation = approvalIdSchema.safeParse(idParam);
    if (!idValidation.success) {
      return c.json(
        {
          error: "Invalid approval ID format",
          details: idValidation.error.issues,
        },
        400
      );
    }

    const body = await c.req.json();

    // Validate input
    const validationResult = approveRequestSchema.safeParse(body);
    if (!validationResult.success) {
      return c.json(
        {
          error: "Validation failed",
          details: validationResult.error.issues,
        },
        400
      );
    }

    const { reviewedBy } = validationResult.data;

    const result = await approveApprovalRequest({
      approvalId: idValidation.data,
      reviewedBy,
    });

    if (!result.success) {
      const statusCode = result.statusCode as 400 | 404 | 409;
      return c.json({ error: result.error }, statusCode);
    }

    return c.json(result.approval, 200);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return c.json({ error: "Invalid JSON" }, 400);
    }
    console.error("Error approving request:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// POST /api/approvals/:id/deny - Deny a pending approval request
approvalsRouter.post("/:id/deny", async (c) => {
  try {
    // Validate approval ID parameter
    const idParam = c.req.param("id");
    const idValidation = approvalIdSchema.safeParse(idParam);
    if (!idValidation.success) {
      return c.json(
        {
          error: "Invalid approval ID format",
          details: idValidation.error.issues,
        },
        400
      );
    }

    const body = await c.req.json();

    // Validate input
    const validationResult = denyRequestSchema.safeParse(body);
    if (!validationResult.success) {
      return c.json(
        {
          error: "Validation failed",
          details: validationResult.error.issues,
        },
        400
      );
    }

    const { reviewedBy, notes } = validationResult.data;

    const result = await denyApprovalRequest({
      approvalId: idValidation.data,
      reviewedBy,
      notes,
    });

    if (!result.success) {
      const statusCode = result.statusCode as 400 | 404 | 409;
      return c.json({ error: result.error }, statusCode);
    }

    return c.json(result.approval, 200);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return c.json({ error: "Invalid JSON" }, 400);
    }
    console.error("Error denying request:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

export { approvalsRouter };
