import { describe, it, expect, beforeAll, beforeEach } from "bun:test";
import { db } from "../../src/db/connection";
import { migrate } from "../../src/db/migrate";
import { projects, tasks, agents, taskComments, taskLogs, approvalRequests } from "../../src/db/schema";
import { API_BASE_URL } from "../test-config";

interface CommentResponse {
  id: string;
  taskId: string;
  agentId: string;
  content: string;
  createdAt: string;
}

interface ErrorResponse {
  error: string;
  details?: unknown;
}

describe("Task Comments API Endpoints", () => {
  beforeAll(() => {
    migrate();
  });

  beforeEach(async () => {
    await db.delete(taskComments);
    await db.delete(approvalRequests);
    await db.delete(taskLogs);
    await db.delete(tasks);
    await db.delete(projects);
    await db.delete(agents);
  });

  // Helpers
  async function createTestProject(): Promise<string> {
    const id = crypto.randomUUID();
    const now = new Date();
    await db.insert(projects).values({
      id,
      name: "Test Project",
      createdAt: now,
      updatedAt: now,
    });
    return id;
  }

  async function createTestAgent(name: string = "Test Agent"): Promise<string> {
    const id = crypto.randomUUID();
    const now = new Date();
    await db.insert(agents).values({
      id,
      name,
      createdAt: now,
      lastSeenAt: now,
    });
    return id;
  }

  async function createTestTask(projectId: string): Promise<string> {
    const id = crypto.randomUUID();
    const now = new Date();
    await db.insert(tasks).values({
      id,
      projectId,
      title: "Test Task",
      taskType: "implementation",
      status: "backlog",
      createdAt: now,
      updatedAt: now,
    });
    return id;
  }

  describe("POST /api/tasks/:id/comments - Create comment", () => {
    it("should create a comment on an existing task", async () => {
      const projectId = await createTestProject();
      const agentId = await createTestAgent();
      const taskId = await createTestTask(projectId);

      const response = await fetch(
        `${API_BASE_URL}/api/tasks/${taskId}/comments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agentId, content: "This looks good!" }),
        }
      );

      expect(response.status).toBe(201);
      const data = (await response.json()) as CommentResponse;
      expect(data.id).toBeDefined();
      expect(data.taskId).toBe(taskId);
      expect(data.agentId).toBe(agentId);
      expect(data.content).toBe("This looks good!");
      expect(data.createdAt).toBeDefined();
    });

    it("should return 404 when task does not exist", async () => {
      const agentId = await createTestAgent();
      const fakeTaskId = crypto.randomUUID();

      const response = await fetch(
        `${API_BASE_URL}/api/tasks/${fakeTaskId}/comments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agentId, content: "Hello" }),
        }
      );

      expect(response.status).toBe(404);
      const data = (await response.json()) as ErrorResponse;
      expect(data.error).toBe("Task not found");
    });

    it("should return 400 when content is empty", async () => {
      const projectId = await createTestProject();
      const agentId = await createTestAgent();
      const taskId = await createTestTask(projectId);

      const response = await fetch(
        `${API_BASE_URL}/api/tasks/${taskId}/comments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agentId, content: "" }),
        }
      );

      expect(response.status).toBe(400);
    });

    it("should return 400 when content is missing", async () => {
      const projectId = await createTestProject();
      const agentId = await createTestAgent();
      const taskId = await createTestTask(projectId);

      const response = await fetch(
        `${API_BASE_URL}/api/tasks/${taskId}/comments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agentId }),
        }
      );

      expect(response.status).toBe(400);
    });

    it("should return 400 when agentId is invalid UUID", async () => {
      const projectId = await createTestProject();
      const taskId = await createTestTask(projectId);

      const response = await fetch(
        `${API_BASE_URL}/api/tasks/${taskId}/comments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agentId: "invalid", content: "Hello" }),
        }
      );

      expect(response.status).toBe(400);
    });
  });

  describe("GET /api/tasks/:id/comments - List comments", () => {
    it("should return empty array when no comments exist", async () => {
      const projectId = await createTestProject();
      const taskId = await createTestTask(projectId);

      const response = await fetch(
        `${API_BASE_URL}/api/tasks/${taskId}/comments`
      );

      expect(response.status).toBe(200);
      const data = (await response.json()) as CommentResponse[];
      expect(data).toBeArray();
      expect(data.length).toBe(0);
    });

    it("should return comments ordered by createdAt ascending", async () => {
      const projectId = await createTestProject();
      const agentId = await createTestAgent();
      const taskId = await createTestTask(projectId);

      // Create comments with slight delay to ensure ordering
      await fetch(`${API_BASE_URL}/api/tasks/${taskId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId, content: "First comment" }),
      });

      // Small delay to ensure different timestamps
      await new Promise((r) => setTimeout(r, 50));

      await fetch(`${API_BASE_URL}/api/tasks/${taskId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId, content: "Second comment" }),
      });

      await new Promise((r) => setTimeout(r, 50));

      await fetch(`${API_BASE_URL}/api/tasks/${taskId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId, content: "Third comment" }),
      });

      const response = await fetch(
        `${API_BASE_URL}/api/tasks/${taskId}/comments`
      );

      expect(response.status).toBe(200);
      const data = (await response.json()) as CommentResponse[];
      expect(data.length).toBe(3);
      expect(data[0].content).toBe("First comment");
      expect(data[1].content).toBe("Second comment");
      expect(data[2].content).toBe("Third comment");
    });

    it("should return 404 when task does not exist", async () => {
      const fakeTaskId = crypto.randomUUID();

      const response = await fetch(
        `${API_BASE_URL}/api/tasks/${fakeTaskId}/comments`
      );

      expect(response.status).toBe(404);
    });

    it("should only return comments for the specified task", async () => {
      const projectId = await createTestProject();
      const agentId = await createTestAgent();
      const taskId1 = await createTestTask(projectId);
      const taskId2 = await createTestTask(projectId);

      // Add comment to task 1
      await fetch(`${API_BASE_URL}/api/tasks/${taskId1}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId, content: "Comment on task 1" }),
      });

      // Add comment to task 2
      await fetch(`${API_BASE_URL}/api/tasks/${taskId2}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId, content: "Comment on task 2" }),
      });

      // Get comments for task 1 only
      const response = await fetch(
        `${API_BASE_URL}/api/tasks/${taskId1}/comments`
      );

      expect(response.status).toBe(200);
      const data = (await response.json()) as CommentResponse[];
      expect(data.length).toBe(1);
      expect(data[0].content).toBe("Comment on task 1");
      expect(data[0].taskId).toBe(taskId1);
    });
  });
});
