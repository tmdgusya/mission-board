import { describe, it, expect, beforeAll, afterAll, beforeEach } from "bun:test";
import { sqlite, db } from "../../src/db/connection";
import { migrate } from "../../src/db/migrate";
import { projects, tasks, taskLogs, approvalRequests, agents } from "../../src/db/schema";
import { eq } from "drizzle-orm";

// Test configuration
const API_BASE_URL = "http://localhost:3200";

// Type for API responses
interface ProjectResponse {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ErrorResponse {
  error: string;
  details?: unknown;
}

describe("Project CRUD API", () => {
  beforeAll(() => {
    // Run migrations before tests
    migrate();
  });

  beforeEach(async () => {
    // Clean up tables before each test
    await db.delete(approvalRequests);
    await db.delete(taskLogs);
    await db.delete(tasks);
    await db.delete(projects);
  });

  afterAll(() => {
    // Don't close the database connection - other tests may need it
    // sqlite.close();
  });

  describe("POST /api/projects", () => {
    it("should create a project with valid data and return 201", async () => {
      const response = await fetch(`${API_BASE_URL}/api/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Test Project",
          description: "A test project description",
        }),
      });

      expect(response.status).toBe(201);
      const data = await response.json() as ProjectResponse;
      expect(data.id).toBeDefined();
      expect(data.name).toBe("Test Project");
      expect(data.description).toBe("A test project description");
      expect(data.createdAt).toBeDefined();
      expect(data.updatedAt).toBeDefined();
    });

    it("should create a project without description", async () => {
      const response = await fetch(`${API_BASE_URL}/api/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Minimal Project",
        }),
      });

      expect(response.status).toBe(201);
      const data = await response.json() as ProjectResponse;
      expect(data.name).toBe("Minimal Project");
      expect(data.description).toBeNull();
    });

    it("should return 400 when name is missing", async () => {
      const response = await fetch(`${API_BASE_URL}/api/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: "Missing name",
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json() as ErrorResponse;
      expect(data.error).toBeDefined();
    });

    it("should return 400 when name is empty string", async () => {
      const response = await fetch(`${API_BASE_URL}/api/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "",
          description: "Empty name",
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json() as ErrorResponse;
      expect(data.error).toBeDefined();
    });

    it("should return 400 for invalid JSON", async () => {
      const response = await fetch(`${API_BASE_URL}/api/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not valid json",
      });

      expect(response.status).toBe(400);
    });
  });

  describe("GET /api/projects", () => {
    it("should return an array of all projects", async () => {
      // Create test projects
      const now = new Date();
      await db.insert(projects).values([
        { id: crypto.randomUUID(), name: "Project 1", createdAt: now, updatedAt: now },
        { id: crypto.randomUUID(), name: "Project 2", createdAt: now, updatedAt: now },
      ]);

      const response = await fetch(`${API_BASE_URL}/api/projects`);
      expect(response.status).toBe(200);

      const data = await response.json() as ProjectResponse[];
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(2);
      expect(data[0]!.name).toBeDefined();
      expect(data[0]!.id).toBeDefined();
      expect(data[0]!.createdAt).toBeDefined();
      expect(data[0]!.updatedAt).toBeDefined();
    });

    it("should return empty array when no projects exist", async () => {
      const response = await fetch(`${API_BASE_URL}/api/projects`);
      expect(response.status).toBe(200);

      const data = await response.json() as ProjectResponse[];
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(0);
    });
  });

  describe("GET /api/projects/:id", () => {
    it("should return a single project with valid UUID", async () => {
      const projectId = crypto.randomUUID();
      const now = new Date();
      await db.insert(projects).values({
        id: projectId,
        name: "Single Project",
        description: "Test description",
        createdAt: now,
        updatedAt: now,
      });

      const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}`);
      expect(response.status).toBe(200);

      const data = await response.json() as ProjectResponse;
      expect(data.id).toBe(projectId);
      expect(data.name).toBe("Single Project");
      expect(data.description).toBe("Test description");
    });

    it("should return 404 for non-existent project", async () => {
      const nonExistentId = crypto.randomUUID();
      const response = await fetch(`${API_BASE_URL}/api/projects/${nonExistentId}`);
      expect(response.status).toBe(404);

      const data = await response.json() as ErrorResponse;
      expect(data.error).toBeDefined();
    });

    it("should return 400 for invalid UUID format", async () => {
      const response = await fetch(`${API_BASE_URL}/api/projects/not-a-uuid`);
      expect(response.status).toBe(400);

      const data = await response.json() as ErrorResponse;
      expect(data.error).toBeDefined();
    });
  });

  describe("PATCH /api/projects/:id", () => {
    it("should update only provided fields", async () => {
      const projectId = crypto.randomUUID();
      const now = new Date();
      await db.insert(projects).values({
        id: projectId,
        name: "Original Name",
        description: "Original description",
        createdAt: now,
        updatedAt: now,
      });

      const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Updated Name",
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json() as ProjectResponse;
      expect(data.name).toBe("Updated Name");
      expect(data.description).toBe("Original description"); // Unchanged
    });

    it("should update updated_at timestamp", async () => {
      const projectId = crypto.randomUUID();
      const now = new Date();
      await db.insert(projects).values({
        id: projectId,
        name: "Original Name",
        createdAt: now,
        updatedAt: now,
      });

      // Wait a bit to ensure timestamp difference (SQLite uses second precision)
      await new Promise((resolve) => setTimeout(resolve, 1100));

      const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: "New description",
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json() as ProjectResponse;
      expect(new Date(data.updatedAt).getTime()).toBeGreaterThan(now.getTime());
    });

    it("should update both name and description", async () => {
      const projectId = crypto.randomUUID();
      const now = new Date();
      await db.insert(projects).values({
        id: projectId,
        name: "Original Name",
        description: "Original description",
        createdAt: now,
        updatedAt: now,
      });

      const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "New Name",
          description: "New description",
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json() as ProjectResponse;
      expect(data.name).toBe("New Name");
      expect(data.description).toBe("New description");
    });

    it("should return 404 for non-existent project", async () => {
      const nonExistentId = crypto.randomUUID();
      const response = await fetch(`${API_BASE_URL}/api/projects/${nonExistentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New Name" }),
      });

      expect(response.status).toBe(404);
    });

    it("should return 400 for invalid UUID format", async () => {
      const response = await fetch(`${API_BASE_URL}/api/projects/not-a-uuid`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New Name" }),
      });

      expect(response.status).toBe(400);
    });

    it("should return 400 for empty name", async () => {
      const projectId = crypto.randomUUID();
      const now = new Date();
      await db.insert(projects).values({
        id: projectId,
        name: "Original Name",
        createdAt: now,
        updatedAt: now,
      });

      const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "" }),
      });

      expect(response.status).toBe(400);
    });
  });

  describe("DELETE /api/projects/:id", () => {
    it("should delete project and return 204", async () => {
      const projectId = crypto.randomUUID();
      const now = new Date();
      await db.insert(projects).values({
        id: projectId,
        name: "Project to Delete",
        createdAt: now,
        updatedAt: now,
      });

      const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}`, {
        method: "DELETE",
      });

      expect(response.status).toBe(204);

      // Verify project is deleted
      const projectResult = await db.select().from(projects).where(eq(projects.id, projectId));
      expect(projectResult.length).toBe(0);
    });

    it("should cascade delete associated tasks", async () => {
      const projectId = crypto.randomUUID();
      const taskId = crypto.randomUUID();
      const now = new Date();

      await db.insert(projects).values({
        id: projectId,
        name: "Project with Tasks",
        createdAt: now,
        updatedAt: now,
      });

      await db.insert(tasks).values({
        id: taskId,
        projectId: projectId,
        title: "Task to Cascade Delete",
        taskType: "implementation",
        status: "backlog",
        createdAt: now,
        updatedAt: now,
      });

      const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}`, {
        method: "DELETE",
      });

      expect(response.status).toBe(204);

      // Verify task is also deleted
      const taskResult = await db.select().from(tasks).where(eq(tasks.id, taskId));
      expect(taskResult.length).toBe(0);
    });

    it("should cascade delete associated tasks and their logs", async () => {
      const projectId = crypto.randomUUID();
      const taskId = crypto.randomUUID();
      const logId = crypto.randomUUID();
      const now = new Date();

      await db.insert(projects).values({
        id: projectId,
        name: "Project with Tasks and Logs",
        createdAt: now,
        updatedAt: now,
      });

      await db.insert(tasks).values({
        id: taskId,
        projectId: projectId,
        title: "Task with Logs",
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

      const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}`, {
        method: "DELETE",
      });

      expect(response.status).toBe(204);

      // Verify log still exists (logs are kept for audit purposes)
      // The task_id remains since there's no foreign key constraint
      const logResult = await db.select().from(taskLogs).where(eq(taskLogs.id, logId));
      expect(logResult.length).toBe(1);
      expect(logResult[0]!.taskId).toBe(taskId);
    });

    it("should cascade delete associated approval requests", async () => {
      const projectId = crypto.randomUUID();
      const taskId = crypto.randomUUID();
      const agentId = crypto.randomUUID();
      const approvalId = crypto.randomUUID();
      const now = new Date();

      await db.insert(projects).values({
        id: projectId,
        name: "Project with Approvals",
        createdAt: now,
        updatedAt: now,
      });

      await db.insert(agents).values({
        id: agentId,
        name: "Test Agent",
        createdAt: now,
        lastSeenAt: now,
      });

      await db.insert(tasks).values({
        id: taskId,
        projectId: projectId,
        title: "Task with Approval",
        taskType: "deployment",
        requiresApproval: true,
        status: "review",
        createdAt: now,
        updatedAt: now,
      });

      await db.insert(approvalRequests).values({
        id: approvalId,
        taskId: taskId,
        agentId: agentId,
        actionRequested: "deploy",
        status: "pending",
        createdAt: now,
      });

      const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}`, {
        method: "DELETE",
      });

      expect(response.status).toBe(204);

      // Verify approval request is also deleted
      const approvalResult = await db.select().from(approvalRequests).where(eq(approvalRequests.id, approvalId));
      expect(approvalResult.length).toBe(0);
    });

    it("should return 404 for non-existent project", async () => {
      const nonExistentId = crypto.randomUUID();
      const response = await fetch(`${API_BASE_URL}/api/projects/${nonExistentId}`, {
        method: "DELETE",
      });

      expect(response.status).toBe(404);
    });

    it("should return 400 for invalid UUID format", async () => {
      const response = await fetch(`${API_BASE_URL}/api/projects/not-a-uuid`, {
        method: "DELETE",
      });

      expect(response.status).toBe(400);
    });
  });
});
