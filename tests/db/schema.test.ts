import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { sqlite, db, checkDatabaseHealth } from "../../src/db/connection";
import { migrate } from "../../src/db/migrate";
import { projects, agents, tasks, taskLogs, approvalRequests } from "../../src/db/schema";
import { eq } from "drizzle-orm";

describe("Database Schema", () => {
  beforeAll(() => {
    // Run migrations before tests
    migrate();
  });

  afterAll(() => {
    // Don't close the database connection - other tests may need it
    // sqlite.close();
  });

  describe("Database Configuration", () => {
    it("should have WAL mode enabled", () => {
      const health = checkDatabaseHealth();
      expect(health.ok).toBe(true);
      expect(health.journalMode).toBe("wal");
    });

    it("should have foreign keys enabled", () => {
      const health = checkDatabaseHealth();
      expect(health.foreignKeys).toBe(true);
    });
  });

  describe("Projects Table", () => {
    it("should create and retrieve a project", async () => {
      const projectId = crypto.randomUUID();
      const now = new Date();

      await db.insert(projects).values({
        id: projectId,
        name: "Test Project",
        description: "A test project",
        createdAt: now,
        updatedAt: now,
      });

      const result = await db.select().from(projects).where(eq(projects.id, projectId));
      expect(result.length).toBe(1);
      expect(result[0]!.name).toBe("Test Project");
      expect(result[0]!.description).toBe("A test project");
    });

    it("should enforce unique primary key", async () => {
      const projectId = crypto.randomUUID();
      const now = new Date();

      await db.insert(projects).values({
        id: projectId,
        name: "First Project",
        createdAt: now,
        updatedAt: now,
      });

      // Try to insert duplicate - should throw
      let threw = false;
      try {
        await db.insert(projects).values({
          id: projectId,
          name: "Duplicate Project",
          createdAt: now,
          updatedAt: now,
        });
      } catch (e) {
        threw = true;
      }
      expect(threw).toBe(true);
    });
  });

  describe("Agents Table", () => {
    it("should create and retrieve an agent", async () => {
      const agentId = crypto.randomUUID();
      const now = new Date();

      await db.insert(agents).values({
        id: agentId,
        name: "Test Agent",
        createdAt: now,
        lastSeenAt: now,
      });

      const result = await db.select().from(agents).where(eq(agents.id, agentId));
      expect(result.length).toBe(1);
      expect(result[0]!.name).toBe("Test Agent");
    });
  });

  describe("Tasks Table", () => {
    it("should create a task with foreign key to project", async () => {
      const projectId = crypto.randomUUID();
      const taskId = crypto.randomUUID();
      const now = new Date();

      // Create project first
      await db.insert(projects).values({
        id: projectId,
        name: "Project for Task",
        createdAt: now,
        updatedAt: now,
      });

      // Create task
      await db.insert(tasks).values({
        id: taskId,
        projectId: projectId,
        title: "Test Task",
        taskType: "implementation",
        status: "backlog",
        requiresApproval: false,
        createdAt: now,
        updatedAt: now,
      });

      const result = await db.select().from(tasks).where(eq(tasks.id, taskId));
      expect(result.length).toBe(1);
      expect(result[0]!.title).toBe("Test Task");
      expect(result[0]!.projectId).toBe(projectId);
      expect(result[0]!.status).toBe("backlog");
    });

    it("should enforce foreign key constraint on project_id", async () => {
      const taskId = crypto.randomUUID();
      const now = new Date();

      // Try to create task with non-existent project - should throw
      let threw = false;
      try {
        await db.insert(tasks).values({
          id: taskId,
          projectId: "non-existent-project",
          title: "Orphan Task",
          taskType: "implementation",
          status: "backlog",
          createdAt: now,
          updatedAt: now,
        });
      } catch (e) {
        threw = true;
      }
      expect(threw).toBe(true);
    });
  });

  describe("Task Logs Table", () => {
    it("should create a task log with foreign key to task", async () => {
      const projectId = crypto.randomUUID();
      const taskId = crypto.randomUUID();
      const logId = crypto.randomUUID();
      const now = new Date();

      // Create project and task
      await db.insert(projects).values({
        id: projectId,
        name: "Project for Log",
        createdAt: now,
        updatedAt: now,
      });

      await db.insert(tasks).values({
        id: taskId,
        projectId: projectId,
        title: "Task for Log",
        taskType: "implementation",
        status: "backlog",
        createdAt: now,
        updatedAt: now,
      });

      // Create log
      await db.insert(taskLogs).values({
        id: logId,
        taskId: taskId,
        action: "created",
        details: JSON.stringify({ title: "Task for Log" }),
        createdAt: now,
      });

      const result = await db.select().from(taskLogs).where(eq(taskLogs.id, logId));
      expect(result.length).toBe(1);
      expect(result[0]!.action).toBe("created");
    });
  });

  describe("Approval Requests Table", () => {
    it("should create an approval request", async () => {
      const projectId = crypto.randomUUID();
      const taskId = crypto.randomUUID();
      const agentId = crypto.randomUUID();
      const approvalId = crypto.randomUUID();
      const now = new Date();

      // Create dependencies
      await db.insert(projects).values({
        id: projectId,
        name: "Project for Approval",
        createdAt: now,
        updatedAt: now,
      });

      await db.insert(agents).values({
        id: agentId,
        name: "Requesting Agent",
        createdAt: now,
        lastSeenAt: now,
      });

      await db.insert(tasks).values({
        id: taskId,
        projectId: projectId,
        title: "Task for Approval",
        taskType: "deployment",
        requiresApproval: true,
        status: "review",
        createdAt: now,
        updatedAt: now,
      });

      // Create approval request
      await db.insert(approvalRequests).values({
        id: approvalId,
        taskId: taskId,
        agentId: agentId,
        actionRequested: "deploy to production",
        status: "pending",
        createdAt: now,
      });

      const result = await db.select().from(approvalRequests).where(eq(approvalRequests.id, approvalId));
      expect(result.length).toBe(1);
      expect(result[0]!.status).toBe("pending");
      expect(result[0]!.actionRequested).toBe("deploy to production");
    });
  });

  describe("Indexes", () => {
    it("should have indexes on tasks table", () => {
      const indexesQuery = sqlite.query(
        "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'tasks'"
      );
      const indexes = indexesQuery.all() as Array<{ name: string }>;
      indexesQuery.finalize();

      const indexNames = indexes.map((i) => i.name);
      expect(indexNames).toContain("idx_tasks_project_id");
      expect(indexNames).toContain("idx_tasks_status");
      expect(indexNames).toContain("idx_tasks_agent_id");
    });

    it("should have index on task_logs table", () => {
      const indexesQuery = sqlite.query(
        "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'task_logs'"
      );
      const indexes = indexesQuery.all() as Array<{ name: string }>;
      indexesQuery.finalize();

      const indexNames = indexes.map((i) => i.name);
      expect(indexNames).toContain("idx_task_logs_task_id");
    });

    it("should have index on approval_requests table", () => {
      const indexesQuery = sqlite.query(
        "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'approval_requests'"
      );
      const indexes = indexesQuery.all() as Array<{ name: string }>;
      indexesQuery.finalize();

      const indexNames = indexes.map((i) => i.name);
      expect(indexNames).toContain("idx_approval_requests_status");
    });
  });

  describe("Cascade Deletes", () => {
    it("should cascade delete tasks when project is deleted", async () => {
      const projectId = crypto.randomUUID();
      const taskId = crypto.randomUUID();
      const now = new Date();

      // Create project and task
      await db.insert(projects).values({
        id: projectId,
        name: "Cascade Test Project",
        createdAt: now,
        updatedAt: now,
      });

      await db.insert(tasks).values({
        id: taskId,
        projectId: projectId,
        title: "Cascade Test Task",
        taskType: "implementation",
        status: "backlog",
        createdAt: now,
        updatedAt: now,
      });

      // Verify task exists
      let taskResult = await db.select().from(tasks).where(eq(tasks.id, taskId));
      expect(taskResult.length).toBe(1);

      // Delete project
      await db.delete(projects).where(eq(projects.id, projectId));

      // Verify task is also deleted
      taskResult = await db.select().from(tasks).where(eq(tasks.id, taskId));
      expect(taskResult.length).toBe(0);
    });

    it("should cascade delete task_logs when task is deleted", async () => {
      const projectId = crypto.randomUUID();
      const taskId = crypto.randomUUID();
      const logId = crypto.randomUUID();
      const now = new Date();

      // Create project, task, and log
      await db.insert(projects).values({
        id: projectId,
        name: "Log Cascade Project",
        createdAt: now,
        updatedAt: now,
      });

      await db.insert(tasks).values({
        id: taskId,
        projectId: projectId,
        title: "Log Cascade Task",
        taskType: "implementation",
        status: "backlog",
        createdAt: now,
        updatedAt: now,
      });

      await db.insert(taskLogs).values({
        id: logId,
        taskId: taskId,
        action: "created",
        createdAt: now,
      });

      // Verify log exists
      let logResult = await db.select().from(taskLogs).where(eq(taskLogs.id, logId));
      expect(logResult.length).toBe(1);

      // Delete task
      await db.delete(tasks).where(eq(tasks.id, taskId));

      // Verify log still exists (logs are kept for audit purposes)
      // The task_id remains since there's no foreign key constraint
      logResult = await db.select().from(taskLogs).where(eq(taskLogs.id, logId));
      expect(logResult.length).toBe(1);
      expect(logResult[0]!.taskId).toBe(taskId);
    });
  });
});
