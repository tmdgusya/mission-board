import { describe, it, expect, beforeAll, beforeEach } from "bun:test";
import { db } from "../../src/db/connection";
import { migrate } from "../../src/db/migrate";
import { projects, tasks, agents } from "../../src/db/schema";
import { eq } from "drizzle-orm";

// Test configuration
const API_BASE_URL = "http://localhost:3200";

// Type for API responses
interface AgentResponse {
  id: string;
  name: string;
  createdAt: string;
  lastSeenAt: string;
}

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

describe("Agent Auto-Registration", () => {
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

  describe("POST /api/tasks - auto-creates agent", () => {
    it("should auto-create agent on first request with new agent_id", async () => {
      const projectId = await createTestProject();
      const newAgentId = crypto.randomUUID();

      // Verify agent doesn't exist yet
      const agentsBefore = await db.select().from(agents).where(eq(agents.id, newAgentId));
      expect(agentsBefore.length).toBe(0);

      // Create a task with new agent_id
      const response = await fetch(`${API_BASE_URL}/api/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: newAgentId,
          projectId,
          title: "Test Task",
          taskType: "implementation",
        }),
      });

      expect(response.status).toBe(201);

      // Verify agent was auto-created
      const agentsAfter = await db.select().from(agents).where(eq(agents.id, newAgentId));
      expect(agentsAfter.length).toBe(1);
      
      const agent = agentsAfter[0]!;
      expect(agent.id).toBe(newAgentId);
      expect(agent.name).toBe(newAgentId); // Name defaults to id initially
      expect(agent.createdAt).toBeDefined();
      expect(agent.lastSeenAt).toBeDefined();
    });

    it("should not create duplicate agents for same agent_id", async () => {
      const projectId = await createTestProject();
      const agentId = crypto.randomUUID();

      // Create first task - should create agent
      const response1 = await fetch(`${API_BASE_URL}/api/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId,
          projectId,
          title: "First Task",
          taskType: "implementation",
        }),
      });
      expect(response1.status).toBe(201);

      // Get the agent's created_at timestamp
      const agentAfterFirst = await db.select().from(agents).where(eq(agents.id, agentId));
      expect(agentAfterFirst.length).toBe(1);
      const firstCreatedAt = agentAfterFirst[0]!.createdAt;

      // Create second task with same agent_id - should not create duplicate
      const response2 = await fetch(`${API_BASE_URL}/api/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId,
          projectId,
          title: "Second Task",
          taskType: "bugfix",
        }),
      });
      expect(response2.status).toBe(201);

      // Verify only one agent exists
      const allAgents = await db.select().from(agents).where(eq(agents.id, agentId));
      expect(allAgents.length).toBe(1);
      
      // Verify created_at hasn't changed
      expect(allAgents[0]!.createdAt.getTime()).toBe(firstCreatedAt.getTime());
    });

    it("should update last_seen_at on subsequent requests", async () => {
      const projectId = await createTestProject();
      const agentId = crypto.randomUUID();

      // Create first task
      const response1 = await fetch(`${API_BASE_URL}/api/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId,
          projectId,
          title: "First Task",
          taskType: "implementation",
        }),
      });
      expect(response1.status).toBe(201);

      // Get initial last_seen_at
      const agentAfterFirst = await db.select().from(agents).where(eq(agents.id, agentId));
      const firstLastSeenAt = agentAfterFirst[0]!.lastSeenAt;

      // Wait a bit to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Create second task with same agent_id
      const response2 = await fetch(`${API_BASE_URL}/api/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId,
          projectId,
          title: "Second Task",
          taskType: "bugfix",
        }),
      });
      expect(response2.status).toBe(201);

      // Verify last_seen_at was updated
      const agentAfterSecond = await db.select().from(agents).where(eq(agents.id, agentId));
      const secondLastSeenAt = agentAfterSecond[0]!.lastSeenAt;
      
      expect(secondLastSeenAt.getTime()).toBeGreaterThan(firstLastSeenAt.getTime());
    });
  });

  describe("POST /api/tasks/:id/claim - auto-creates agent", () => {
    it("should auto-create agent when claiming task with new agent_id", async () => {
      const projectId = await createTestProject();
      const newAgentId = crypto.randomUUID();

      // Create a task without agent first
      const taskId = crypto.randomUUID();
      const now = new Date();
      await db.insert(tasks).values({
        id: taskId,
        projectId,
        agentId: null,
        title: "Unclaimed Task",
        taskType: "implementation",
        status: "backlog",
        createdAt: now,
        updatedAt: now,
      });

      // Verify agent doesn't exist yet
      const agentsBefore = await db.select().from(agents).where(eq(agents.id, newAgentId));
      expect(agentsBefore.length).toBe(0);

      // Claim task with new agent_id
      const response = await fetch(`${API_BASE_URL}/api/tasks/${taskId}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: newAgentId }),
      });

      expect(response.status).toBe(200);

      // Verify agent was auto-created
      const agentsAfter = await db.select().from(agents).where(eq(agents.id, newAgentId));
      expect(agentsAfter.length).toBe(1);
      
      const agent = agentsAfter[0]!;
      expect(agent.id).toBe(newAgentId);
      expect(agent.name).toBe(newAgentId);
    });

    it("should update last_seen_at when claiming with existing agent", async () => {
      const projectId = await createTestProject();
      const agentId = crypto.randomUUID();

      // Create task and claim it to create the agent
      const taskId1 = crypto.randomUUID();
      const now = new Date();
      await db.insert(tasks).values({
        id: taskId1,
        projectId,
        agentId: null,
        title: "Task 1",
        taskType: "implementation",
        status: "backlog",
        createdAt: now,
        updatedAt: now,
      });

      // First claim - creates agent
      await fetch(`${API_BASE_URL}/api/tasks/${taskId1}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId }),
      });

      const agentAfterFirst = await db.select().from(agents).where(eq(agents.id, agentId));
      const firstLastSeenAt = agentAfterFirst[0]!.lastSeenAt;

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Create and claim another task
      const taskId2 = crypto.randomUUID();
      await db.insert(tasks).values({
        id: taskId2,
        projectId,
        agentId: null,
        title: "Task 2",
        taskType: "bugfix",
        status: "backlog",
        createdAt: now,
        updatedAt: now,
      });

      // Second claim - should update last_seen_at
      await fetch(`${API_BASE_URL}/api/tasks/${taskId2}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId }),
      });

      // Verify last_seen_at was updated
      const agentAfterSecond = await db.select().from(agents).where(eq(agents.id, agentId));
      const secondLastSeenAt = agentAfterSecond[0]!.lastSeenAt;
      
      expect(secondLastSeenAt.getTime()).toBeGreaterThan(firstLastSeenAt.getTime());
    });
  });

  describe("Agent idempotency", () => {
    it("should handle concurrent requests with same new agent_id gracefully", async () => {
      const projectId = await createTestProject();
      const newAgentId = crypto.randomUUID();

      // Send multiple requests concurrently with the same new agent_id
      const promises = Array.from({ length: 5 }, (_, i) =>
        fetch(`${API_BASE_URL}/api/tasks`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agentId: newAgentId,
            projectId,
            title: `Concurrent Task ${i}`,
            taskType: "implementation",
          }),
        })
      );

      const responses = await Promise.all(promises);

      // All requests should succeed
      const successCount = responses.filter((r) => r.status === 201).length;
      expect(successCount).toBe(5);

      // Verify only one agent was created
      const allAgents = await db.select().from(agents).where(eq(agents.id, newAgentId));
      expect(allAgents.length).toBe(1);
      
      const agent = allAgents[0]!;
      expect(agent.id).toBe(newAgentId);
    });
  });
});
