import { Hono } from "hono";
import { db } from "../../db/connection";
import { taskComments, tasks, agents } from "../../db/schema";
import { eq, asc } from "drizzle-orm";
import {
  createCommentSchema,
  commentTaskIdSchema,
} from "../../schemas/comments";

const commentsRouter = new Hono();

// POST /api/tasks/:id/comments - Add a comment to a task
commentsRouter.post("/:id/comments", async (c) => {
  try {
    const taskId = c.req.param("id");

    // Validate task ID format
    const idValidation = commentTaskIdSchema.safeParse(taskId);
    if (!idValidation.success) {
      return c.json({ error: "Invalid UUID format" }, 400);
    }

    const body = await c.req.json();
    const validation = createCommentSchema.safeParse(body);
    if (!validation.success) {
      return c.json(
        { error: "Validation failed", details: validation.error.issues },
        400
      );
    }

    const { agentId, content } = validation.data;

    // Verify task exists
    const taskResult = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, taskId));
    if (taskResult.length === 0) {
      return c.json({ error: "Task not found" }, 404);
    }

    // Verify agent exists
    const agentResult = await db
      .select()
      .from(agents)
      .where(eq(agents.id, agentId));
    if (agentResult.length === 0) {
      return c.json({ error: "Agent not found" }, 404);
    }

    // Create comment
    const commentId = crypto.randomUUID();
    const now = new Date();
    await db.insert(taskComments).values({
      id: commentId,
      taskId,
      agentId,
      content,
      createdAt: now,
    });

    const created = await db
      .select()
      .from(taskComments)
      .where(eq(taskComments.id, commentId));
    const comment = created[0]!;

    return c.json(
      {
        id: comment.id,
        taskId: comment.taskId,
        agentId: comment.agentId,
        content: comment.content,
        createdAt: comment.createdAt,
      },
      201
    );
  } catch (error) {
    console.error("Error creating comment:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// GET /api/tasks/:id/comments - List comments for a task
commentsRouter.get("/:id/comments", async (c) => {
  try {
    const taskId = c.req.param("id");

    // Validate task ID format
    const idValidation = commentTaskIdSchema.safeParse(taskId);
    if (!idValidation.success) {
      return c.json({ error: "Invalid UUID format" }, 400);
    }

    // Verify task exists
    const taskResult = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, taskId));
    if (taskResult.length === 0) {
      return c.json({ error: "Task not found" }, 404);
    }

    // Get comments ordered by createdAt ascending
    const comments = await db
      .select()
      .from(taskComments)
      .where(eq(taskComments.taskId, taskId))
      .orderBy(asc(taskComments.createdAt));

    return c.json(
      comments.map((comment) => ({
        id: comment.id,
        taskId: comment.taskId,
        agentId: comment.agentId,
        content: comment.content,
        createdAt: comment.createdAt,
      }))
    );
  } catch (error) {
    console.error("Error fetching comments:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

export { commentsRouter };
