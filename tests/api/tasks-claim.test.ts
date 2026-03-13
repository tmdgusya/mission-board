import { describe, it, expect, beforeAll, beforeEach } from "bun:test";
import { db } from "../../src/db/connection";
import { migrate } from "../../src/db/migrate";
import { projects, tasks, agents } from "../../src/db/schema";
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
  currentOwner?: {
    agentId: string;
    claimedAt: string;
  };
}

describe("Task Claim/Release API", () => {
  beforeAll(() => {
    // Run migrations before tests
    migrate();
  });

  beforeEach(async () => {
    // Clean up tables before each test
    await db.delete(tasks);
    await db.delete(projects);
    await db.delete(agents);
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

  // Helper to create a test task
  async function createTestTask(
    projectId: string,
    title: string,
    status: string = "backlog",
    agentId: string | null = null
  ): Promise<string> {
    const taskId = crypto.randomUUID();
    const now = new Date();
    await db.insert(tasks).values({
      id: taskId,
      projectId,
      agentId,
      title,
      taskType: "implementation",
      status,
      createdAt: now,
      updatedAt: now,
      claimedAt: agentId ? now : null,
    });
    return taskId;
  }

  describe("POST /api/tasks/:id/claim", () => {
    it("should claim an unclaimed task from backlog status", async () => {
      const projectId = await createTestProject();
      const agentId = await createTestAgent();
      const taskId = await createTestTask(projectId, "Unclaimed Task", "backlog");

      const response = await fetch(`${API_BASE_URL}/api/tasks/${taskId}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId }),
      });

      expect(response.status).toBe(200);
      const data = await response.json() as TaskResponse;
      expect(data.id).toBe(taskId);
      expect(data.agentId).toBe(agentId);
      expect(data.status).toBe("in_progress");
      expect(data.claimedAt).toBeDefined();
    });

    it("should claim an unclaimed task from ready status", async () => {
      const projectId = await createTestProject();
      const agentId = await createTestAgent();
      const taskId = await createTestTask(projectId, "Ready Task", "ready");

      const response = await fetch(`${API_BASE_URL}/api/tasks/${taskId}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId }),
      });

      expect(response.status).toBe(200);
      const data = await response.json() as TaskResponse;
      expect(data.agentId).toBe(agentId);
      expect(data.status).toBe("in_progress");
      expect(data.claimedAt).toBeDefined();
    });

    it("should return 409 when task is already claimed by another agent", async () => {
      const projectId = await createTestProject();
      const firstAgentId = await createTestAgent("First Agent");
      const secondAgentId = await createTestAgent("Second Agent");
      const taskId = await createTestTask(projectId, "Claimed Task", "in_progress", firstAgentId);

      const response = await fetch(`${API_BASE_URL}/api/tasks/${taskId}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: secondAgentId }),
      });

      expect(response.status).toBe(409);
      const data = await response.json() as ErrorResponse;
      expect(data.error).toContain("already claimed");
      expect(data.currentOwner).toBeDefined();
      expect(data.currentOwner!.agentId).toBe(firstAgentId);
    });

    it("should return 400 for invalid agent_id format", async () => {
      const projectId = await createTestProject();
      const taskId = await createTestTask(projectId, "Task", "backlog");

      const response = await fetch(`${API_BASE_URL}/api/tasks/${taskId}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: "not-a-uuid" }),
      });

      expect(response.status).toBe(400);
      const data = await response.json() as ErrorResponse;
      expect(data.error).toBeDefined();
    });

    it("should auto-register non-existent agent when claiming", async () => {
      const projectId = await createTestProject();
      const taskId = await createTestTask(projectId, "Task", "backlog");
      const newAgentId = crypto.randomUUID();

      // Verify agent doesn't exist yet
      const agentsBefore = await db.select().from(agents).where(eq(agents.id, newAgentId));
      expect(agentsBefore.length).toBe(0);

      const response = await fetch(`${API_BASE_URL}/api/tasks/${taskId}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: newAgentId }),
      });

      // Should succeed and auto-create the agent
      expect(response.status).toBe(200);
      const data = await response.json() as TaskResponse;
      expect(data.agentId).toBe(newAgentId);

      // Verify agent was created
      const agentsAfter = await db.select().from(agents).where(eq(agents.id, newAgentId));
      expect(agentsAfter.length).toBe(1);
      expect(agentsAfter[0]!.id).toBe(newAgentId);
    });

    it("should return 404 for non-existent task", async () => {
      const agentId = await createTestAgent();
      const nonExistentTaskId = crypto.randomUUID();

      const response = await fetch(`${API_BASE_URL}/api/tasks/${nonExistentTaskId}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId }),
      });

      expect(response.status).toBe(404);
      const data = await response.json() as ErrorResponse;
      expect(data.error).toContain("Task not found");
    });

    it("should return 400 for invalid task UUID format", async () => {
      const agentId = await createTestAgent();

      const response = await fetch(`${API_BASE_URL}/api/tasks/not-a-uuid/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId }),
      });

      expect(response.status).toBe(400);
      const data = await response.json() as ErrorResponse;
      expect(data.error).toContain("Invalid UUID");
    });

    it("should return 400 when agent_id is missing", async () => {
      const projectId = await createTestProject();
      const taskId = await createTestTask(projectId, "Task", "backlog");

      const response = await fetch(`${API_BASE_URL}/api/tasks/${taskId}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(400);
      const data = await response.json() as ErrorResponse;
      expect(data.error).toBeDefined();
    });

    it("should update claimed_at timestamp when claiming", async () => {
      const projectId = await createTestProject();
      const agentId = await createTestAgent();
      const taskId = await createTestTask(projectId, "Task", "backlog");

      const beforeClaim = new Date();
      // Subtract 1 second to account for SQLite timestamp precision (seconds only)
      const beforeClaimAdjusted = new Date(beforeClaim.getTime() - 1000);

      const response = await fetch(`${API_BASE_URL}/api/tasks/${taskId}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId }),
      });

      expect(response.status).toBe(200);
      const data = await response.json() as TaskResponse;
      expect(data.claimedAt).toBeDefined();
      expect(data.claimedAt).not.toBeNull();
      const claimedAt = new Date(data.claimedAt!);
      // Allow for 1 second precision difference due to SQLite storage
      expect(claimedAt.getTime()).toBeGreaterThanOrEqual(beforeClaimAdjusted.getTime());
    });

    it("should not allow claiming a task in review status", async () => {
      const projectId = await createTestProject();
      const agentId = await createTestAgent();
      const taskId = await createTestTask(projectId, "Task", "review");

      const response = await fetch(`${API_BASE_URL}/api/tasks/${taskId}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId }),
      });

      expect(response.status).toBe(400);
      const data = await response.json() as ErrorResponse;
      expect(data.error).toContain("Cannot claim task");
    });

    it("should not allow claiming a task in done status", async () => {
      const projectId = await createTestProject();
      const agentId = await createTestAgent();
      const taskId = await createTestTask(projectId, "Task", "done");

      const response = await fetch(`${API_BASE_URL}/api/tasks/${taskId}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId }),
      });

      expect(response.status).toBe(400);
      const data = await response.json() as ErrorResponse;
      expect(data.error).toContain("Cannot claim task");
    });
  });

  describe("POST /api/tasks/:id/release", () => {
    it("should release a claimed task", async () => {
      const projectId = await createTestProject();
      const agentId = await createTestAgent();
      const taskId = await createTestTask(projectId, "Claimed Task", "in_progress", agentId);

      const response = await fetch(`${API_BASE_URL}/api/tasks/${taskId}/release`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      expect(response.status).toBe(200);
      const data = await response.json() as TaskResponse;
      expect(data.id).toBe(taskId);
      expect(data.agentId).toBeNull();
      expect(data.status).toBe("ready");
      expect(data.claimedAt).toBeNull();
    });

    it("should return 404 for non-existent task", async () => {
      const nonExistentTaskId = crypto.randomUUID();

      const response = await fetch(`${API_BASE_URL}/api/tasks/${nonExistentTaskId}/release`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      expect(response.status).toBe(404);
      const data = await response.json() as ErrorResponse;
      expect(data.error).toContain("Task not found");
    });

    it("should return 400 for invalid task UUID format", async () => {
      const response = await fetch(`${API_BASE_URL}/api/tasks/not-a-uuid/release`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      expect(response.status).toBe(400);
      const data = await response.json() as ErrorResponse;
      expect(data.error).toContain("Invalid UUID");
    });

    it("should release a task from in_progress status", async () => {
      const projectId = await createTestProject();
      const agentId = await createTestAgent();
      const taskId = await createTestTask(projectId, "Task", "in_progress", agentId);

      const response = await fetch(`${API_BASE_URL}/api/tasks/${taskId}/release`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      expect(response.status).toBe(200);
      const data = await response.json() as TaskResponse;
      expect(data.status).toBe("ready");
      expect(data.agentId).toBeNull();
    });

    it("should clear claimed_at when releasing", async () => {
      const projectId = await createTestProject();
      const agentId = await createTestAgent();
      const taskId = await createTestTask(projectId, "Task", "in_progress", agentId);

      // Verify task has claimed_at initially
      const taskBefore = await db.select().from(tasks).where(eq(tasks.id, taskId));
      expect(taskBefore[0]!.claimedAt).not.toBeNull();

      const response = await fetch(`${API_BASE_URL}/api/tasks/${taskId}/release`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      expect(response.status).toBe(200);
      const data = await response.json() as TaskResponse;
      expect(data.claimedAt).toBeNull();

      // Verify in database
      const taskAfter = await db.select().from(tasks).where(eq(tasks.id, taskId));
      expect(taskAfter[0]!.claimedAt).toBeNull();
    });
  });
});
