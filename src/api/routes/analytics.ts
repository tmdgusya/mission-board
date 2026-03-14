import { Hono } from "hono";
import { db } from "../../db/connection";
import { tasks, agents, taskLogs } from "../../db/schema";
import { sql, eq, and, isNotNull, gte, lte, desc } from "drizzle-orm";

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const analyticsRouter = new Hono();

// Helper: parse date query param
function parseDateParam(value: string | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

// Helper: build date conditions for created_at filtering
function buildDateConditions(dateFrom: Date | null, dateTo: Date | null) {
  const conditions: ReturnType<typeof gte>[] = [];
  if (dateFrom) conditions.push(gte(tasks.createdAt, dateFrom));
  if (dateTo) conditions.push(lte(tasks.createdAt, dateTo));
  return conditions;
}

// GET /api/analytics/agents - Per-agent performance stats
analyticsRouter.get("/agents", async (c) => {
  try {
    const projectId = c.req.query("project_id");
    const dateFrom = parseDateParam(c.req.query("date_from"));
    const dateTo = parseDateParam(c.req.query("date_to"));

    // Build base conditions
    const taskConditions = [
      ...(projectId ? [eq(tasks.projectId, projectId)] : []),
      ...buildDateConditions(dateFrom, dateTo),
    ];

    // Get all agents
    const agentList = await db.select().from(agents);

    // For each agent, compute stats
    const agentStats = await Promise.all(
      agentList.map(async (agent) => {
        const conditions = [
          eq(tasks.agentId, agent.id),
          ...taskConditions,
        ];

        const agentTasks = await db
          .select()
          .from(tasks)
          .where(and(...conditions));

        const completedTasks = agentTasks.filter((t) => t.status === "done");
        const inProgressTasks = agentTasks.filter((t) => t.status === "in_progress");

        // Calculate average completion time for completed tasks
        // that have both created_at and claimed_at timestamps
        const completionTimes: number[] = [];
        for (const task of completedTasks) {
          if (task.createdAt && task.claimedAt && task.updatedAt) {
            const claimTime = new Date(task.claimedAt).getTime();
            const updateTime = new Date(task.updatedAt).getTime();
            completionTimes.push(updateTime - claimTime);
          }
        }

        const avgCompletionTime =
          completionTimes.length > 0
            ? completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length
            : null;

        // Success rate: completed / (completed + blocked + non-backlog/ready that aren't done)
        const totalAttempted = agentTasks.filter(
          (t) =>
            t.status === "done" ||
            t.status === "blocked" ||
            t.status === "in_progress" ||
            t.status === "review"
        ).length;

        const successRate =
          totalAttempted > 0
            ? (completedTasks.length / totalAttempted) * 100
            : null;

        return {
          agentId: agent.id,
          agentName: agent.name,
          tasksCompleted: completedTasks.length,
          tasksInProgress: inProgressTasks.length,
          totalTasks: agentTasks.length,
          avgCompletionTimeMs: avgCompletionTime ? Math.round(avgCompletionTime) : null,
          successRate: successRate !== null ? Math.round(successRate * 10) / 10 : null,
        };
      })
    );

    // Filter out agents with zero tasks in the current context
    const nonEmptyStats = agentStats.filter((s) => s.totalTasks > 0);

    // Sort by tasks completed (descending)
    nonEmptyStats.sort((a, b) => b.tasksCompleted - a.tasksCompleted);

    return c.json(nonEmptyStats);
  } catch (error) {
    console.error("Error fetching agent analytics:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// GET /api/analytics/tasks - Overall task metrics
analyticsRouter.get("/tasks", async (c) => {
  try {
    const projectId = c.req.query("project_id");
    const dateFrom = parseDateParam(c.req.query("date_from"));
    const dateTo = parseDateParam(c.req.query("date_to"));

    // Build conditions
    const conditions = [
      ...(projectId ? [eq(tasks.projectId, projectId)] : []),
      ...buildDateConditions(dateFrom, dateTo),
    ];

    // Get all tasks (or filtered by project)
    const allTasks =
      conditions.length > 0
        ? await db.select().from(tasks).where(and(...conditions))
        : await db.select().from(tasks);

    // Count tasks by status
    const statusCounts: Record<string, number> = {
      backlog: 0,
      ready: 0,
      in_progress: 0,
      review: 0,
      done: 0,
      blocked: 0,
    };

    for (const task of allTasks) {
      if (task.status in statusCounts) {
        statusCounts[task.status] = (statusCounts[task.status] ?? 0) + 1;
      }
    }

    const totalTasks = allTasks.length;
    const completedTasks = statusCounts["done"] ?? 0;
    const completionRate =
      totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 1000) / 10 : 0;

    // Average time to completion for completed tasks
    const completionTimes: number[] = [];
    for (const task of allTasks) {
      if (
        task.status === "done" &&
        task.createdAt &&
        task.updatedAt
      ) {
        const createdTime = new Date(task.createdAt).getTime();
        const updateTime = new Date(task.updatedAt).getTime();
        completionTimes.push(updateTime - createdTime);
      }
    }

    const avgTimeToCompletionMs =
      completionTimes.length > 0
        ? Math.round(
            completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length
          )
        : null;

    return c.json({
      totalTasks,
      statusCounts,
      completionRate,
      avgTimeToCompletionMs,
    });
  } catch (error) {
    console.error("Error fetching task analytics:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// GET /api/analytics/time-tracking - Time tracking metrics
analyticsRouter.get("/time-tracking", async (c) => {
  try {
    const projectId = c.req.query("project_id");
    const dateFrom = parseDateParam(c.req.query("date_from"));
    const dateTo = parseDateParam(c.req.query("date_to"));

    // Build conditions
    const conditions = [
      ...(projectId ? [eq(tasks.projectId, projectId)] : []),
      ...buildDateConditions(dateFrom, dateTo),
    ];

    // Get all tasks (or filtered by project)
    const allTasks =
      conditions.length > 0
        ? await db.select().from(tasks).where(and(...conditions))
        : await db.select().from(tasks);

    // Calculate time from created to claimed
    const createdToClaimedTimes: number[] = [];
    // Calculate time from claimed to completed (done)
    const claimedToCompletedTimes: number[] = [];

    for (const task of allTasks) {
      // Created to claimed time
      if (task.createdAt && task.claimedAt) {
        const createdTime = new Date(task.createdAt).getTime();
        const claimedTime = new Date(task.claimedAt).getTime();
        createdToClaimedTimes.push(claimedTime - createdTime);
      }

      // Claimed to completed time (only for done tasks)
      if (
        task.status === "done" &&
        task.claimedAt &&
        task.updatedAt
      ) {
        const claimedTime = new Date(task.claimedAt).getTime();
        const completedTime = new Date(task.updatedAt).getTime();
        claimedToCompletedTimes.push(completedTime - claimedTime);
      }
    }

    const avgCreatedToClaimedMs =
      createdToClaimedTimes.length > 0
        ? Math.round(
            createdToClaimedTimes.reduce((a, b) => a + b, 0) /
              createdToClaimedTimes.length
          )
        : null;

    const avgClaimedToCompletedMs =
      claimedToCompletedTimes.length > 0
        ? Math.round(
            claimedToCompletedTimes.reduce((a, b) => a + b, 0) /
              claimedToCompletedTimes.length
          )
        : null;

    const tasksWithClaimData = createdToClaimedTimes.length;
    const tasksWithCompletionData = claimedToCompletedTimes.length;

    return c.json({
      avgCreatedToClaimedMs,
      avgClaimedToCompletedMs,
      tasksWithClaimData,
      tasksWithCompletionData,
    });
  } catch (error) {
    console.error("Error fetching time tracking analytics:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// GET /api/analytics/velocity - Velocity over time (tasks completed per day)
analyticsRouter.get("/velocity", async (c) => {
  try {
    const projectId = c.req.query("project_id");
    const dateFrom = parseDateParam(c.req.query("date_from"));
    const dateTo = parseDateParam(c.req.query("date_to"));

    // Default: last 30 days if no date range specified
    const toDate = dateTo || new Date();
    const fromDate = dateFrom || new Date(toDate.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Build conditions: done tasks within the date range
    const conditions = [
      eq(tasks.status, "done"),
      gte(tasks.updatedAt, fromDate),
      lte(tasks.updatedAt, toDate),
      ...(projectId ? [eq(tasks.projectId, projectId)] : []),
    ];

    const completedTasks = await db
      .select()
      .from(tasks)
      .where(and(...conditions))
      .orderBy(desc(tasks.updatedAt));

    // Group by date
    const velocityMap: Record<string, number> = {};
    for (const task of completedTasks) {
      if (task.updatedAt) {
        const parts = task.updatedAt.toISOString().split("T");
        const dateStr = parts[0] ?? "";
        velocityMap[dateStr] = (velocityMap[dateStr] || 0) + 1;
      }
    }

    // Fill in missing dates with 0 (use UTC dates to match toISOString())
    const velocityData: { date: string; count: number }[] = [];
    const current = new Date(fromDate.getTime());
    // Normalize to UTC midnight
    current.setUTCHours(0, 0, 0, 0);
    const end = new Date(toDate.getTime());
    end.setUTCHours(23, 59, 59, 999);

    while (current <= end) {
      const dateStrParts = current.toISOString().split("T");
      const dateStr = dateStrParts[0] ?? "";
      velocityData.push({
        date: dateStr,
        count: velocityMap[dateStr] || 0,
      });
      current.setUTCDate(current.getUTCDate() + 1);
    }

    return c.json(velocityData);
  } catch (error) {
    console.error("Error fetching velocity analytics:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

export { analyticsRouter };
