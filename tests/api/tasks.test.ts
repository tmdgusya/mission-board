import { describe, it, expect, beforeAll, afterAll, beforeEach } from "bun:test";
import { sqlite, db } from "../../src/db/connection";
import { migrate } from "../../src/db/migrate";
import { projects, tasks, taskLogs, agents } from "../../src/db/schema";
import { eq } from "drizzle-orm";

// Test configuration
const API_BASE_URL = "http://localhost:3200";

// Type for API responses
interface TaskResponse {
  id: string;
  projectId: string;
  agentId: string | null;
  title: string;
  description: string | null;
  taskType: string;
  requiresApproval: boolean;
  status: string;
  createdAt: string;
  updatedAt: string;
  claimedAt: string | null;
}

interface ErrorResponse {
  error: string;
  details?: unknown;
}

describe("Task CRUD API", () => {
  beforeAll(() => {
    // Run migrations before tests
    migrate();
  });

  beforeEach(async () => {
    // Clean up tables before each test
    await db.delete(taskLogs);
    await db.delete(tasks);
    await db.delete(projects);
    await db.delete(agents);
  });

  afterAll(() => {
    // Don't close the database connection - other tests may need it
    // sqlite.close();
  });

  // Helper to create a test project
  async function createTestProject(name: string = "Test Project"): Promise<string> {
    const projectId = crypto.randomUUID();
    const now = new Date();
    await db.insert(projects).values({
      id: projectId,
      name,
      createdAt: now,
      updatedAt: now,
    });
    return projectId;
  }

  // Helper to create a test agent
  async function createTestAgent(name: string = "Test Agent"): Promise<string> {
    const agentId = crypto.randomUUID();
    const now = new Date();
    await db.insert(agents).values({
      id: agentId,
      name,
      createdAt: now,
      lastSeenAt: now,
    });
    return agentId;
  }

  describe("POST /api/tasks", () => {
    it("should create a task with valid data and return 201", async () => {
      const projectId = await createTestProject();
      const agentId = await createTestAgent();

      const response = await fetch(`${API_BASE_URL}/api/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId,
          projectId,
          title: "Test Task",
          taskType: "implementation",
          description: "A test task description",
        }),
      });

      expect(response.status).toBe(201);
      const data = await response.json() as TaskResponse;
      expect(data.id).toBeDefined();
      expect(data.projectId).toBe(projectId);
      expect(data.agentId).toBe(agentId);
      expect(data.title).toBe("Test Task");
      expect(data.taskType).toBe("implementation");
      expect(data.description).toBe("A test task description");
      expect(data.status).toBe("backlog");
      expect(data.requiresApproval).toBe(false);
      expect(data.createdAt).toBeDefined();
      expect(data.updatedAt).toBeDefined();
    });

    it("should create a task with requires_approval flag", async () => {
      const projectId = await createTestProject();
      const agentId = await createTestAgent();

      const response = await fetch(`${API_BASE_URL}/api/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId,
          projectId,
          title: "Task Requiring Approval",
          taskType: "deployment",
          requiresApproval: true,
        }),
      });

      expect(response.status).toBe(201);
      const data = await response.json() as TaskResponse;
      expect(data.requiresApproval).toBe(true);
      expect(data.status).toBe("backlog");
    });

    it("should create a task with minimal required fields", async () => {
      const projectId = await createTestProject();
      const agentId = await createTestAgent();

      const response = await fetch(`${API_BASE_URL}/api/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId,
          projectId,
          title: "Minimal Task",
          taskType: "bugfix",
        }),
      });

      expect(response.status).toBe(201);
      const data = await response.json() as TaskResponse;
      expect(data.title).toBe("Minimal Task");
      expect(data.description).toBeNull();
      expect(data.requiresApproval).toBe(false);
      expect(data.status).toBe("backlog");
    });

    it("should return 400 when required fields are missing", async () => {
      const response = await fetch(`${API_BASE_URL}/api/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Missing fields",
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json() as ErrorResponse;
      expect(data.error).toBeDefined();
    });

    it("should return 400 when title is empty", async () => {
      const projectId = await createTestProject();
      const agentId = await createTestAgent();

      const response = await fetch(`${API_BASE_URL}/api/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId,
          projectId,
          title: "",
          taskType: "implementation",
        }),
      });

      expect(response.status).toBe(400);
    });

    it("should return 404 for non-existent project", async () => {
      const agentId = await createTestAgent();
      const nonExistentProjectId = crypto.randomUUID();

      const response = await fetch(`${API_BASE_URL}/api/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId,
          projectId: nonExistentProjectId,
          title: "Task for non-existent project",
          taskType: "implementation",
        }),
      });

      expect(response.status).toBe(404);
    });

    it("should return 400 for invalid JSON", async () => {
      const response = await fetch(`${API_BASE_URL}/api/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not valid json",
      });

      expect(response.status).toBe(400);
    });
  });

  describe("GET /api/tasks", () => {
    it("should return an array of all tasks", async () => {
      const projectId = await createTestProject();
      const agentId = await createTestAgent();
      const now = new Date();

      await db.insert(tasks).values([
        {
          id: crypto.randomUUID(),
          projectId,
          agentId,
          title: "Task 1",
          taskType: "implementation",
          status: "backlog",
          createdAt: now,
          updatedAt: now,
        },
        {
          id: crypto.randomUUID(),
          projectId,
          agentId,
          title: "Task 2",
          taskType: "bugfix",
          status: "in_progress",
          createdAt: now,
          updatedAt: now,
        },
      ]);

      const response = await fetch(`${API_BASE_URL}/api/tasks`);
      expect(response.status).toBe(200);

      const data = await response.json() as TaskResponse[];
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(2);
    });

    it("should filter tasks by project_id", async () => {
      const projectId1 = await createTestProject("Project 1");
      const projectId2 = await createTestProject("Project 2");
      const agentId = await createTestAgent();
      const now = new Date();

      await db.insert(tasks).values([
        {
          id: crypto.randomUUID(),
          projectId: projectId1,
          agentId,
          title: "Task in Project 1",
          taskType: "implementation",
          status: "backlog",
          createdAt: now,
          updatedAt: now,
        },
        {
          id: crypto.randomUUID(),
          projectId: projectId2,
          agentId,
          title: "Task in Project 2",
          taskType: "bugfix",
          status: "in_progress",
          createdAt: now,
          updatedAt: now,
        },
      ]);

      const response = await fetch(`${API_BASE_URL}/api/tasks?project_id=${projectId1}`);
      expect(response.status).toBe(200);

      const data = await response.json() as TaskResponse[];
      expect(data.length).toBe(1);
      expect(data[0]!.title).toBe("Task in Project 1");
    });

    it("should filter tasks by status", async () => {
      const projectId = await createTestProject();
      const agentId = await createTestAgent();
      const now = new Date();

      await db.insert(tasks).values([
        {
          id: crypto.randomUUID(),
          projectId,
          agentId,
          title: "Backlog Task",
          taskType: "implementation",
          status: "backlog",
          createdAt: now,
          updatedAt: now,
        },
        {
          id: crypto.randomUUID(),
          projectId,
          agentId,
          title: "In Progress Task",
          taskType: "bugfix",
          status: "in_progress",
          createdAt: now,
          updatedAt: now,
        },
      ]);

      const response = await fetch(`${API_BASE_URL}/api/tasks?status=backlog`);
      expect(response.status).toBe(200);

      const data = await response.json() as TaskResponse[];
      expect(data.length).toBe(1);
      expect(data[0]!.title).toBe("Backlog Task");
    });

    it("should filter tasks by agent_id", async () => {
      const projectId = await createTestProject();
      const agentId1 = await createTestAgent("Agent 1");
      const agentId2 = await createTestAgent("Agent 2");
      const now = new Date();

      await db.insert(tasks).values([
        {
          id: crypto.randomUUID(),
          projectId,
          agentId: agentId1,
          title: "Task for Agent 1",
          taskType: "implementation",
          status: "backlog",
          createdAt: now,
          updatedAt: now,
        },
        {
          id: crypto.randomUUID(),
          projectId,
          agentId: agentId2,
          title: "Task for Agent 2",
          taskType: "bugfix",
          status: "in_progress",
          createdAt: now,
          updatedAt: now,
        },
      ]);

      const response = await fetch(`${API_BASE_URL}/api/tasks?agent_id=${agentId1}`);
      expect(response.status).toBe(200);

      const data = await response.json() as TaskResponse[];
      expect(data.length).toBe(1);
      expect(data[0]!.title).toBe("Task for Agent 1");
    });

    it("should combine multiple filters", async () => {
      const projectId = await createTestProject();
      const agentId = await createTestAgent();
      const now = new Date();

      await db.insert(tasks).values([
        {
          id: crypto.randomUUID(),
          projectId,
          agentId,
          title: "Backlog Task",
          taskType: "implementation",
          status: "backlog",
          createdAt: now,
          updatedAt: now,
        },
        {
          id: crypto.randomUUID(),
          projectId,
          agentId,
          title: "In Progress Task",
          taskType: "bugfix",
          status: "in_progress",
          createdAt: now,
          updatedAt: now,
        },
      ]);

      const response = await fetch(
        `${API_BASE_URL}/api/tasks?project_id=${projectId}&status=backlog&agent_id=${agentId}`
      );
      expect(response.status).toBe(200);

      const data = await response.json() as TaskResponse[];
      expect(data.length).toBe(1);
      expect(data[0]!.title).toBe("Backlog Task");
    });

    it("should return empty array when no tasks match filters", async () => {
      const projectId = await createTestProject();
      const agentId = await createTestAgent();
      const now = new Date();

      await db.insert(tasks).values({
        id: crypto.randomUUID(),
        projectId,
        agentId,
        title: "Task",
        taskType: "implementation",
        status: "backlog",
        createdAt: now,
        updatedAt: now,
      });

      const response = await fetch(`${API_BASE_URL}/api/tasks?status=done`);
      expect(response.status).toBe(200);

      const data = await response.json() as TaskResponse[];
      expect(data.length).toBe(0);
    });
  });

  describe("GET /api/tasks/:id", () => {
    it("should return a single task with valid UUID", async () => {
      const projectId = await createTestProject();
      const agentId = await createTestAgent();
      const taskId = crypto.randomUUID();
      const now = new Date();

      await db.insert(tasks).values({
        id: taskId,
        projectId,
        agentId,
        title: "Single Task",
        description: "Test description",
        taskType: "implementation",
        status: "backlog",
        createdAt: now,
        updatedAt: now,
      });

      const response = await fetch(`${API_BASE_URL}/api/tasks/${taskId}`);
      expect(response.status).toBe(200);

      const data = await response.json() as TaskResponse;
      expect(data.id).toBe(taskId);
      expect(data.title).toBe("Single Task");
      expect(data.description).toBe("Test description");
    });

    it("should return 404 for non-existent task", async () => {
      const nonExistentId = crypto.randomUUID();
      const response = await fetch(`${API_BASE_URL}/api/tasks/${nonExistentId}`);
      expect(response.status).toBe(404);

      const data = await response.json() as ErrorResponse;
      expect(data.error).toBeDefined();
    });

    it("should return 400 for invalid UUID format", async () => {
      const response = await fetch(`${API_BASE_URL}/api/tasks/not-a-uuid`);
      expect(response.status).toBe(400);

      const data = await response.json() as ErrorResponse;
      expect(data.error).toBeDefined();
    });
  });

  describe("PATCH /api/tasks/:id", () => {
    it("should update task title", async () => {
      const projectId = await createTestProject();
      const agentId = await createTestAgent();
      const taskId = crypto.randomUUID();
      const now = new Date();

      await db.insert(tasks).values({
        id: taskId,
        projectId,
        agentId,
        title: "Original Title",
        taskType: "implementation",
        status: "backlog",
        createdAt: now,
        updatedAt: now,
      });

      const response = await fetch(`${API_BASE_URL}/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Updated Title",
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json() as TaskResponse;
      expect(data.title).toBe("Updated Title");
    });

    it("should update task description", async () => {
      const projectId = await createTestProject();
      const agentId = await createTestAgent();
      const taskId = crypto.randomUUID();
      const now = new Date();

      await db.insert(tasks).values({
        id: taskId,
        projectId,
        agentId,
        title: "Task",
        description: "Original description",
        taskType: "implementation",
        status: "backlog",
        createdAt: now,
        updatedAt: now,
      });

      const response = await fetch(`${API_BASE_URL}/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: "Updated description",
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json() as TaskResponse;
      expect(data.description).toBe("Updated description");
    });

    it("should update task status with valid transition (backlog -> ready)", async () => {
      const projectId = await createTestProject();
      const agentId = await createTestAgent();
      const taskId = crypto.randomUUID();
      const now = new Date();

      await db.insert(tasks).values({
        id: taskId,
        projectId,
        agentId,
        title: "Task",
        taskType: "implementation",
        status: "backlog",
        createdAt: now,
        updatedAt: now,
      });

      const response = await fetch(`${API_BASE_URL}/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "ready",
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json() as TaskResponse;
      expect(data.status).toBe("ready");
    });

    it("should update task status with valid transition (ready -> in_progress)", async () => {
      const projectId = await createTestProject();
      const agentId = await createTestAgent();
      const taskId = crypto.randomUUID();
      const now = new Date();

      await db.insert(tasks).values({
        id: taskId,
        projectId,
        agentId,
        title: "Task",
        taskType: "implementation",
        status: "ready",
        createdAt: now,
        updatedAt: now,
      });

      const response = await fetch(`${API_BASE_URL}/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "in_progress",
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json() as TaskResponse;
      expect(data.status).toBe("in_progress");
    });

    it("should update task status with valid transition (in_progress -> review)", async () => {
      const projectId = await createTestProject();
      const agentId = await createTestAgent();
      const taskId = crypto.randomUUID();
      const now = new Date();

      await db.insert(tasks).values({
        id: taskId,
        projectId,
        agentId,
        title: "Task",
        taskType: "implementation",
        status: "in_progress",
        createdAt: now,
        updatedAt: now,
      });

      const response = await fetch(`${API_BASE_URL}/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "review",
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json() as TaskResponse;
      expect(data.status).toBe("review");
    });

    it("should update task status with valid transition (review -> done)", async () => {
      const projectId = await createTestProject();
      const agentId = await createTestAgent();
      const taskId = crypto.randomUUID();
      const now = new Date();

      await db.insert(tasks).values({
        id: taskId,
        projectId,
        agentId,
        title: "Task",
        taskType: "implementation",
        status: "review",
        createdAt: now,
        updatedAt: now,
      });

      const response = await fetch(`${API_BASE_URL}/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "done",
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json() as TaskResponse;
      expect(data.status).toBe("done");
    });

    it("should allow transition to blocked from any status", async () => {
      const projectId = await createTestProject();
      const agentId = await createTestAgent();
      const taskId = crypto.randomUUID();
      const now = new Date();

      await db.insert(tasks).values({
        id: taskId,
        projectId,
        agentId,
        title: "Task",
        taskType: "implementation",
        status: "backlog",
        createdAt: now,
        updatedAt: now,
      });

      const response = await fetch(`${API_BASE_URL}/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "blocked",
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json() as TaskResponse;
      expect(data.status).toBe("blocked");
    });

    it("should allow transition from blocked to any status", async () => {
      const projectId = await createTestProject();
      const agentId = await createTestAgent();
      const taskId = crypto.randomUUID();
      const now = new Date();

      await db.insert(tasks).values({
        id: taskId,
        projectId,
        agentId,
        title: "Task",
        taskType: "implementation",
        status: "blocked",
        createdAt: now,
        updatedAt: now,
      });

      const response = await fetch(`${API_BASE_URL}/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "ready",
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json() as TaskResponse;
      expect(data.status).toBe("ready");
    });

    it("should reject invalid status transition (backlog -> in_progress)", async () => {
      const projectId = await createTestProject();
      const agentId = await createTestAgent();
      const taskId = crypto.randomUUID();
      const now = new Date();

      await db.insert(tasks).values({
        id: taskId,
        projectId,
        agentId,
        title: "Task",
        taskType: "implementation",
        status: "backlog",
        createdAt: now,
        updatedAt: now,
      });

      const response = await fetch(`${API_BASE_URL}/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "in_progress",
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json() as ErrorResponse;
      expect(data.error).toContain("Invalid status transition");
    });

    it("should reject invalid status transition (backlog -> done)", async () => {
      const projectId = await createTestProject();
      const agentId = await createTestAgent();
      const taskId = crypto.randomUUID();
      const now = new Date();

      await db.insert(tasks).values({
        id: taskId,
        projectId,
        agentId,
        title: "Task",
        taskType: "implementation",
        status: "backlog",
        createdAt: now,
        updatedAt: now,
      });

      const response = await fetch(`${API_BASE_URL}/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "done",
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json() as ErrorResponse;
      expect(data.error).toContain("Invalid status transition");
    });

    it("should reject invalid status transition (ready -> done)", async () => {
      const projectId = await createTestProject();
      const agentId = await createTestAgent();
      const taskId = crypto.randomUUID();
      const now = new Date();

      await db.insert(tasks).values({
        id: taskId,
        projectId,
        agentId,
        title: "Task",
        taskType: "implementation",
        status: "ready",
        createdAt: now,
        updatedAt: now,
      });

      const response = await fetch(`${API_BASE_URL}/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "done",
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json() as ErrorResponse;
      expect(data.error).toContain("Invalid status transition");
    });

    it("should reject invalid status transition (in_progress -> done)", async () => {
      const projectId = await createTestProject();
      const agentId = await createTestAgent();
      const taskId = crypto.randomUUID();
      const now = new Date();

      await db.insert(tasks).values({
        id: taskId,
        projectId,
        agentId,
        title: "Task",
        taskType: "implementation",
        status: "in_progress",
        createdAt: now,
        updatedAt: now,
      });

      const response = await fetch(`${API_BASE_URL}/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "done",
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json() as ErrorResponse;
      expect(data.error).toContain("Invalid status transition");
    });

    it("should update updated_at timestamp", async () => {
      const projectId = await createTestProject();
      const agentId = await createTestAgent();
      const taskId = crypto.randomUUID();
      const now = new Date();

      await db.insert(tasks).values({
        id: taskId,
        projectId,
        agentId,
        title: "Task",
        taskType: "implementation",
        status: "backlog",
        createdAt: now,
        updatedAt: now,
      });

      // Wait a bit to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 1100));

      const response = await fetch(`${API_BASE_URL}/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Updated Title",
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json() as TaskResponse;
      expect(new Date(data.updatedAt).getTime()).toBeGreaterThan(now.getTime());
    });

    it("should return 404 for non-existent task", async () => {
      const nonExistentId = crypto.randomUUID();
      const response = await fetch(`${API_BASE_URL}/api/tasks/${nonExistentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New Title" }),
      });

      expect(response.status).toBe(404);
    });

    it("should return 400 for invalid UUID format", async () => {
      const response = await fetch(`${API_BASE_URL}/api/tasks/not-a-uuid`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New Title" }),
      });

      expect(response.status).toBe(400);
    });

    it("should return 400 for empty title", async () => {
      const projectId = await createTestProject();
      const agentId = await createTestAgent();
      const taskId = crypto.randomUUID();
      const now = new Date();

      await db.insert(tasks).values({
        id: taskId,
        projectId,
        agentId,
        title: "Original Title",
        taskType: "implementation",
        status: "backlog",
        createdAt: now,
        updatedAt: now,
      });

      const response = await fetch(`${API_BASE_URL}/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "" }),
      });

      expect(response.status).toBe(400);
    });

    it("should return 400 for invalid status value", async () => {
      const projectId = await createTestProject();
      const agentId = await createTestAgent();
      const taskId = crypto.randomUUID();
      const now = new Date();

      await db.insert(tasks).values({
        id: taskId,
        projectId,
        agentId,
        title: "Task",
        taskType: "implementation",
        status: "backlog",
        createdAt: now,
        updatedAt: now,
      });

      const response = await fetch(`${API_BASE_URL}/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "invalid_status" }),
      });

      expect(response.status).toBe(400);
    });
  });

  describe("DELETE /api/tasks/:id", () => {
    it("should delete task and return 204", async () => {
      const projectId = await createTestProject();
      const agentId = await createTestAgent();
      const taskId = crypto.randomUUID();
      const now = new Date();

      await db.insert(tasks).values({
        id: taskId,
        projectId,
        agentId,
        title: "Task to Delete",
        taskType: "implementation",
        status: "backlog",
        createdAt: now,
        updatedAt: now,
      });

      const response = await fetch(`${API_BASE_URL}/api/tasks/${taskId}`, {
        method: "DELETE",
      });

      expect(response.status).toBe(204);

      // Verify task is deleted
      const taskResult = await db.select().from(tasks).where(eq(tasks.id, taskId));
      expect(taskResult.length).toBe(0);
    });

    it("should cascade delete associated task logs", async () => {
      const projectId = await createTestProject();
      const agentId = await createTestAgent();
      const taskId = crypto.randomUUID();
      const logId = crypto.randomUUID();
      const now = new Date();

      await db.insert(tasks).values({
        id: taskId,
        projectId,
        agentId,
        title: "Task with Logs",
        taskType: "implementation",
        status: "backlog",
        createdAt: now,
        updatedAt: now,
      });

      await db.insert(taskLogs).values({
        id: logId,
        taskId,
        agentId,
        action: "created",
        createdAt: now,
      });

      const response = await fetch(`${API_BASE_URL}/api/tasks/${taskId}`, {
        method: "DELETE",
      });

      expect(response.status).toBe(204);

      // Verify log is also deleted
      const logResult = await db.select().from(taskLogs).where(eq(taskLogs.id, logId));
      expect(logResult.length).toBe(0);
    });

    it("should return 404 for non-existent task", async () => {
      const nonExistentId = crypto.randomUUID();
      const response = await fetch(`${API_BASE_URL}/api/tasks/${nonExistentId}`, {
        method: "DELETE",
      });

      expect(response.status).toBe(404);
    });

    it("should return 400 for invalid UUID format", async () => {
      const response = await fetch(`${API_BASE_URL}/api/tasks/not-a-uuid`, {
        method: "DELETE",
      });

      expect(response.status).toBe(400);
    });
  });
});
