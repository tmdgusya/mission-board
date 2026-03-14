import { describe, it, expect, beforeAll, beforeEach } from "bun:test";
import { db } from "../../src/db/connection";
import { migrate } from "../../src/db/migrate";
import { projects, tasks, agents, taskLogs } from "../../src/db/schema";
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

describe("Agent API Endpoints", () => {
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

  // Helper to create a test agent directly
  async function createTestAgent(name: string): Promise<string> {
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
  async function createTestTask(projectId: string, agentId: string | null, title: string, status: string = "backlog"): Promise<string> {
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

  describe("GET /api/agents - List all agents", () => {
    it("should return empty array when no agents exist", async () => {
      const response = await fetch(`${API_BASE_URL}/api/agents`);
      expect(response.status).toBe(200);

      const data = await response.json() as AgentResponse[];
      expect(data).toBeArray();
      expect(data.length).toBe(0);
    });

    it("should return array of agents with id, name, created_at, last_seen_at", async () => {
      // Create test agents
      const agentId1 = await createTestAgent("Agent One");
      const agentId2 = await createTestAgent("Agent Two");

      const response = await fetch(`${API_BASE_URL}/api/agents`);
      expect(response.status).toBe(200);

      const data = await response.json() as AgentResponse[];
      expect(data).toBeArray();
      expect(data.length).toBe(2);

      // Verify response structure
      const agent1 = data.find(a => a.id === agentId1);
      const agent2 = data.find(a => a.id === agentId2);

      expect(agent1).toBeDefined();
      expect(agent1!.name).toBe("Agent One");
      expect(agent1!.createdAt).toBeDefined();
      expect(agent1!.lastSeenAt).toBeDefined();

      expect(agent2).toBeDefined();
      expect(agent2!.name).toBe("Agent Two");
    });
  });

  describe("GET /api/agents/:id - Get single agent", () => {
    it("should return agent details for existing agent", async () => {
      const agentId = await createTestAgent("Test Agent");

      const response = await fetch(`${API_BASE_URL}/api/agents/${agentId}`);
      expect(response.status).toBe(200);

      const data = await response.json() as AgentResponse;
      expect(data.id).toBe(agentId);
      expect(data.name).toBe("Test Agent");
      expect(data.createdAt).toBeDefined();
      expect(data.lastSeenAt).toBeDefined();
    });

    it("should return 404 for non-existent agent", async () => {
      const nonExistentId = crypto.randomUUID();

      const response = await fetch(`${API_BASE_URL}/api/agents/${nonExistentId}`);
      expect(response.status).toBe(404);

      const data = await response.json() as ErrorResponse;
      expect(data.error).toBeDefined();
    });

    it("should return 400 for invalid UUID format", async () => {
      const response = await fetch(`${API_BASE_URL}/api/agents/invalid-uuid`);
      expect(response.status).toBe(400);

      const data = await response.json() as ErrorResponse;
      expect(data.error).toBeDefined();
    });
  });

  describe("GET /api/agents/:id/tasks - List agent tasks", () => {
    it("should return empty array when agent has no tasks", async () => {
      const agentId = await createTestAgent("Test Agent");

      const response = await fetch(`${API_BASE_URL}/api/agents/${agentId}/tasks`);
      expect(response.status).toBe(200);

      const data = await response.json() as TaskResponse[];
      expect(data).toBeArray();
      expect(data.length).toBe(0);
    });

    it("should return tasks assigned to agent (current and historical)", async () => {
      const projectId = await createTestProject();
      const agentId = await createTestAgent("Test Agent");

      // Create tasks assigned to this agent
      const taskId1 = await createTestTask(projectId, agentId, "Task 1", "in_progress");
      const taskId2 = await createTestTask(projectId, agentId, "Task 2", "done");

      // Create a task not assigned to this agent
      const otherAgentId = await createTestAgent("Other Agent");
      await createTestTask(projectId, otherAgentId, "Other Task", "in_progress");

      const response = await fetch(`${API_BASE_URL}/api/agents/${agentId}/tasks`);
      expect(response.status).toBe(200);

      const data = await response.json() as TaskResponse[];
      expect(data).toBeArray();
      expect(data.length).toBe(2);

      // Verify tasks belong to the agent
      const taskIds = data.map(t => t.id);
      expect(taskIds).toContain(taskId1);
      expect(taskIds).toContain(taskId2);

      // Verify task structure
      const task1 = data.find(t => t.id === taskId1);
      expect(task1!.title).toBe("Task 1");
      expect(task1!.agentId).toBe(agentId);
      expect(task1!.status).toBe("in_progress");
    });

    it("should return 404 for non-existent agent", async () => {
      const nonExistentId = crypto.randomUUID();

      const response = await fetch(`${API_BASE_URL}/api/agents/${nonExistentId}/tasks`);
      expect(response.status).toBe(404);

      const data = await response.json() as ErrorResponse;
      expect(data.error).toBeDefined();
    });

    it("should include tasks from task_logs history", async () => {
      const projectId = await createTestProject();
      const agentId = await createTestAgent("Test Agent");

      // Create a task that was previously assigned to this agent (via task_logs)
      const taskId = await createTestTask(projectId, null, "Historical Task", "ready");

      // Add a task_log entry showing this agent previously worked on it
      await db.insert(taskLogs).values({
        id: crypto.randomUUID(),
        taskId,
        agentId,
        action: "claimed",
        details: JSON.stringify({ previousStatus: "backlog" }),
        createdAt: new Date(),
      });

      const response = await fetch(`${API_BASE_URL}/api/agents/${agentId}/tasks`);
      expect(response.status).toBe(200);

      const data = await response.json() as TaskResponse[];
      // Should include tasks from both current assignments and task_logs history
      expect(data.length).toBeGreaterThanOrEqual(1);
    });
  });
});

describe("POST /api/agents - Register agent", () => {
  beforeAll(() => {
    migrate();
  });

  beforeEach(async () => {
    await db.delete(taskLogs);
    await db.delete(tasks);
    await db.delete(projects);
    await db.delete(agents);
  });

  it("should create a new agent with id and name", async () => {
    const agentId = crypto.randomUUID();
    const response = await fetch(`${API_BASE_URL}/api/agents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: agentId, name: "alice" }),
    });

    expect(response.status).toBe(201);
    const data = await response.json() as AgentResponse;
    expect(data.id).toBe(agentId);
    expect(data.name).toBe("alice");
    expect(data.createdAt).toBeDefined();
    expect(data.lastSeenAt).toBeDefined();
  });

  it("should update name if agent with id already exists", async () => {
    const agentId = crypto.randomUUID();

    // Create agent first
    const res1 = await fetch(`${API_BASE_URL}/api/agents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: agentId, name: "alice" }),
    });
    expect(res1.status).toBe(201);

    // Register again with different name — should update
    const res2 = await fetch(`${API_BASE_URL}/api/agents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: agentId, name: "bob" }),
    });
    expect(res2.status).toBe(200);

    const data = await res2.json() as AgentResponse;
    expect(data.id).toBe(agentId);
    expect(data.name).toBe("bob");
  });

  it("should return 400 when name is missing", async () => {
    const agentId = crypto.randomUUID();
    const response = await fetch(`${API_BASE_URL}/api/agents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: agentId }),
    });
    expect(response.status).toBe(400);

    const data = await response.json() as ErrorResponse;
    expect(data.error).toBeDefined();
  });

  it("should return 400 for invalid UUID format in id", async () => {
    const response = await fetch(`${API_BASE_URL}/api/agents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "not-a-uuid", name: "alice" }),
    });
    expect(response.status).toBe(400);

    const data = await response.json() as ErrorResponse;
    expect(data.error).toBeDefined();
  });

  it("should return 400 when name is empty string", async () => {
    const agentId = crypto.randomUUID();
    const response = await fetch(`${API_BASE_URL}/api/agents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: agentId, name: "" }),
    });
    expect(response.status).toBe(400);
  });
});

describe("PATCH /api/agents/:id - Update agent name", () => {
  beforeAll(() => {
    migrate();
  });

  beforeEach(async () => {
    await db.delete(taskLogs);
    await db.delete(tasks);
    await db.delete(projects);
    await db.delete(agents);
  });

  async function createTestAgent(name: string): Promise<string> {
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

  it("should update agent name", async () => {
    const agentId = await createTestAgent("alice");

    const response = await fetch(`${API_BASE_URL}/api/agents/${agentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "bob" }),
    });

    expect(response.status).toBe(200);
    const data = await response.json() as AgentResponse;
    expect(data.id).toBe(agentId);
    expect(data.name).toBe("bob");
  });

  it("should return 404 for non-existent agent", async () => {
    const nonExistentId = crypto.randomUUID();
    const response = await fetch(`${API_BASE_URL}/api/agents/${nonExistentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "alice" }),
    });

    expect(response.status).toBe(404);
  });

  it("should return 400 when name is missing", async () => {
    const agentId = await createTestAgent("alice");

    const response = await fetch(`${API_BASE_URL}/api/agents/${agentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(400);
  });

  it("should return 400 for invalid UUID in path", async () => {
    const response = await fetch(`${API_BASE_URL}/api/agents/invalid-uuid`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "alice" }),
    });

    expect(response.status).toBe(400);
  });
});

describe("Agent Auto-Registration", () => {
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
