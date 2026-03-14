// NOTE: Uses a dedicated test API server to avoid touching production data.
// Start test server: DATABASE_PATH=./data/test.db PORT=3299 bun run src/server.ts
// Run tests: DATABASE_PATH=./data/test.db TEST_PORT=3299 bun test tests/api/reasoning.test.ts

import { describe, test, expect, beforeAll, beforeEach } from "bun:test";
import { db } from "../../src/db/connection";
import { migrate } from "../../src/db/migrate";
import { resetDatabase } from "../db/reset";
import { projects, tasks, agents, taskLogs } from "../../src/db/schema";
import { eq } from "drizzle-orm";
import { API_BASE_URL as API_URL } from "../test-config";

// Type definitions
interface Project {
  id: string;
  name: string;
  description?: string;
}

interface Task {
  id: string;
  projectId: string;
  agentId: string | null;
  title: string;
  description?: string;
  taskType: string;
  requiresApproval: boolean;
  status: string;
  createdAt: string;
  updatedAt: string;
  claimedAt: string | null;
}

interface TaskLog {
  id: string;
  taskId: string;
  agentId: string | null;
  action: string;
  details: string;
  reason: string | null;
  transcript: string | null;
  createdAt: string;
}

interface ErrorResponse {
  error: string;
  details?: unknown;
}

// Helper functions
async function createProject(name: string, description?: string): Promise<Project> {
  const response = await fetch(`${API_URL}/api/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, description }),
  });
  return response.json() as Promise<Project>;
}

async function createTask(
  agentId: string | null | undefined,
  projectId: string,
  title: string,
  taskType: string,
  requiresApproval?: boolean
): Promise<Task> {
  const body: Record<string, unknown> = {
    projectId,
    title,
    taskType,
    requiresApproval,
  };
  if (agentId) {
    body.agentId = agentId;
  }
  const response = await fetch(`${API_URL}/api/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return response.json() as Promise<Task>;
}

async function claimTask(
  taskId: string,
  agentId: string,
  reason?: string,
  transcript?: { step: number; thought: string }[]
) {
  const body: Record<string, unknown> = { agentId };
  if (reason !== undefined) body.reason = reason;
  if (transcript !== undefined) body.transcript = transcript;

  const response = await fetch(`${API_URL}/api/tasks/${taskId}/claim`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: response.status, data: await response.json() };
}

async function releaseTask(
  taskId: string,
  reason?: string,
  transcript?: { step: number; thought: string }[]
) {
  const body: Record<string, unknown> = {};
  if (reason !== undefined) body.reason = reason;
  if (transcript !== undefined) body.transcript = transcript;

  const response = await fetch(`${API_URL}/api/tasks/${taskId}/release`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: response.status, data: await response.json() };
}

async function updateTask(
  taskId: string,
  updates: Record<string, unknown>,
  reason?: string,
  transcript?: { step: number; thought: string }[]
) {
  const body: Record<string, unknown> = { ...updates };
  if (reason !== undefined) body.reason = reason;
  if (transcript !== undefined) body.transcript = transcript;

  const response = await fetch(`${API_URL}/api/tasks/${taskId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: response.status, data: await response.json() };
}

async function requestApproval(
  taskId: string,
  agentId: string,
  actionRequested: string,
  reason?: string,
  transcript?: { step: number; thought: string }[]
) {
  const body: Record<string, unknown> = { taskId, agentId, actionRequested };
  if (reason !== undefined) body.reason = reason;
  if (transcript !== undefined) body.transcript = transcript;

  const response = await fetch(`${API_URL}/api/approvals`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: response.status, data: await response.json() };
}

async function getLogs(params?: Record<string, string>): Promise<{ status: number; data: TaskLog[] }> {
  const queryString = params
    ? "?" + new URLSearchParams(params).toString()
    : "";
  const response = await fetch(`${API_URL}/api/logs${queryString}`);
  return { status: response.status, data: await response.json() as TaskLog[] };
}

describe("Agent Reasoning API Tests", () => {
  let projectId: string;
  let agentId: string;

  beforeAll(async () => {
    // Run migrations first
    migrate();
    await resetDatabase();
  });

  beforeEach(async () => {
    await resetDatabase();
    agentId = crypto.randomUUID();
    const project = await createProject("Test Project", "Test Description");
    projectId = project.id;
  });

  describe("Claim with reasoning", () => {
    test("should create log entry with reason and transcript when claiming with reasoning", async () => {
      const task = await createTask(undefined, projectId, "Test Task", "implementation");
      const claimAgentId = crypto.randomUUID();

      const reason = "I have the right skills for this task";
      const transcript = [
        { step: 1, thought: "Analyzed task requirements" },
        { step: 2, thought: "Matched my specialization" },
        { step: 3, thought: "Decided to claim this task" },
      ];

      await claimTask(task.id, claimAgentId, reason, transcript);

      const { status, data: logs } = await getLogs({ task_id: task.id, action: "claimed" });
      expect(status).toBe(200);
      expect(Array.isArray(logs)).toBe(true);
      expect(logs.length).toBeGreaterThan(0);

      const claimedLog = logs.find((log) => log.action === "claimed" && log.taskId === task.id);
      expect(claimedLog).toBeDefined();
      expect(claimedLog!.reason).toBe(reason);
      expect(claimedLog!.transcript).not.toBeNull();

      const parsedTranscript = JSON.parse(claimedLog!.transcript!);
      expect(parsedTranscript).toEqual(transcript);
    });

    test("should create log entry with null reason and transcript when claiming without reasoning", async () => {
      const task = await createTask(undefined, projectId, "Test Task", "implementation");
      const claimAgentId = crypto.randomUUID();

      await claimTask(task.id, claimAgentId);

      const { data: logs } = await getLogs({ task_id: task.id, action: "claimed" });
      const claimedLog = logs.find((log) => log.action === "claimed" && log.taskId === task.id);

      expect(claimedLog).toBeDefined();
      expect(claimedLog!.reason).toBeNull();
      expect(claimedLog!.transcript).toBeNull();
    });
  });

  describe("Update with reasoning", () => {
    test("should create log entry with reason and transcript when updating with reasoning", async () => {
      const task = await createTask(agentId, projectId, "Test Task", "implementation");

      const reason = "Task requirements changed, updating status";
      const transcript = [
        { step: 1, thought: "Reviewed task progress" },
        { step: 2, thought: "Determined task is ready" },
      ];

      await updateTask(task.id, { status: "ready" }, reason, transcript);

      const { data: logs } = await getLogs({ task_id: task.id, action: "updated" });
      const updatedLog = logs.find((log) => log.action === "updated" && log.taskId === task.id);

      expect(updatedLog).toBeDefined();
      expect(updatedLog!.reason).toBe(reason);
      expect(updatedLog!.transcript).not.toBeNull();

      const parsedTranscript = JSON.parse(updatedLog!.transcript!);
      expect(parsedTranscript).toEqual(transcript);
    });

    test("should create log entry with null reason and transcript when updating without reasoning", async () => {
      const task = await createTask(agentId, projectId, "Test Task", "implementation");

      await updateTask(task.id, { status: "ready" });

      const { data: logs } = await getLogs({ task_id: task.id, action: "updated" });
      const updatedLog = logs.find((log) => log.action === "updated" && log.taskId === task.id);

      expect(updatedLog).toBeDefined();
      expect(updatedLog!.reason).toBeNull();
      expect(updatedLog!.transcript).toBeNull();
    });
  });

  describe("Release with reasoning", () => {
    test("should create log entry with reason and transcript when releasing with reasoning", async () => {
      const task = await createTask(agentId, projectId, "Test Task", "implementation");
      const claimAgentId = crypto.randomUUID();

      // First claim the task
      await claimTask(task.id, claimAgentId);

      const reason = "Task is blocked, releasing for another agent";
      const transcript = [
        { step: 1, thought: "Identified blocking issue" },
        { step: 2, thought: "Decided to release task" },
      ];

      await releaseTask(task.id, reason, transcript);

      const { data: logs } = await getLogs({ task_id: task.id, action: "released" });
      const releasedLog = logs.find((log) => log.action === "released" && log.taskId === task.id);

      expect(releasedLog).toBeDefined();
      expect(releasedLog!.reason).toBe(reason);
      expect(releasedLog!.transcript).not.toBeNull();

      const parsedTranscript = JSON.parse(releasedLog!.transcript!);
      expect(parsedTranscript).toEqual(transcript);
    });

    test("should create log entry with null reason and transcript when releasing without reasoning", async () => {
      const task = await createTask(agentId, projectId, "Test Task", "implementation");
      const claimAgentId = crypto.randomUUID();

      await claimTask(task.id, claimAgentId);
      await releaseTask(task.id);

      const { data: logs } = await getLogs({ task_id: task.id, action: "released" });
      const releasedLog = logs.find((log) => log.action === "released" && log.taskId === task.id);

      expect(releasedLog).toBeDefined();
      expect(releasedLog!.reason).toBeNull();
      expect(releasedLog!.transcript).toBeNull();
    });
  });

  describe("Approval with reasoning", () => {
    test("should create task_logs entry with approval_requested action and reasoning", async () => {
      const task = await createTask(agentId, projectId, "Approval Task", "implementation", true);
      // Set task to in_progress status
      await db.update(tasks).set({ status: "in_progress" }).where(eq(tasks.id, task.id));

      const reason = "Task complete, requesting approval for deployment";
      const transcript = [
        { step: 1, thought: "Completed implementation" },
        { step: 2, thought: "Verified all tests pass" },
        { step: 3, thought: "Ready for deployment approval" },
      ];

      const result = await requestApproval(task.id, agentId, "deploy to production", reason, transcript);

      expect(result.status).toBe(201);

      // Check task_logs for approval_requested entry
      const { data: logs } = await getLogs({ task_id: task.id, action: "approval_requested" });
      const approvalLog = logs.find((log) => log.action === "approval_requested" && log.taskId === task.id);

      expect(approvalLog).toBeDefined();
      expect(approvalLog!.agentId).toBe(agentId);
      expect(approvalLog!.reason).toBe(reason);
      expect(approvalLog!.transcript).not.toBeNull();

      const parsedTranscript = JSON.parse(approvalLog!.transcript!);
      expect(parsedTranscript).toEqual(transcript);
    });

    test("should create approval_requested log entry with null reason and transcript when no reasoning provided", async () => {
      const task = await createTask(agentId, projectId, "Approval Task", "implementation", true);
      await db.update(tasks).set({ status: "in_progress" }).where(eq(tasks.id, task.id));

      const result = await requestApproval(task.id, agentId, "deploy to production");

      expect(result.status).toBe(201);

      const { data: logs } = await getLogs({ task_id: task.id, action: "approval_requested" });
      const approvalLog = logs.find((log) => log.action === "approval_requested" && log.taskId === task.id);

      expect(approvalLog).toBeDefined();
      expect(approvalLog!.reason).toBeNull();
      expect(approvalLog!.transcript).toBeNull();
    });
  });

  describe("Validation tests", () => {
    test("should return 400 when reason exceeds 280 characters", async () => {
      const task = await createTask(undefined, projectId, "Test Task", "implementation");
      const claimAgentId = crypto.randomUUID();

      const tooLongReason = "a".repeat(281);

      const result = await claimTask(task.id, claimAgentId, tooLongReason);

      expect(result.status).toBe(400);
      expect((result.data as ErrorResponse).error).toContain("Validation failed");
    });

    test("should return 400 when transcript has more than 50 steps", async () => {
      const task = await createTask(undefined, projectId, "Test Task", "implementation");
      const claimAgentId = crypto.randomUUID();

      const tooLongTranscript = Array.from({ length: 51 }, (_, i) => ({
        step: i + 1,
        thought: `Step ${i + 1}`,
      }));

      const result = await claimTask(task.id, claimAgentId, undefined, tooLongTranscript);

      expect(result.status).toBe(400);
      expect((result.data as ErrorResponse).error).toContain("Validation failed");
    });

    test("should return 400 when transcript step has invalid step number", async () => {
      const task = await createTask(undefined, projectId, "Test Task", "implementation");
      const claimAgentId = crypto.randomUUID();

      const invalidTranscript = [
        { step: 0, thought: "Invalid step number" }, // step must be positive
      ];

      const result = await claimTask(task.id, claimAgentId, undefined, invalidTranscript);

      expect(result.status).toBe(400);
      expect((result.data as ErrorResponse).error).toContain("Validation failed");
    });

    test("should return 400 when transcript step has step number greater than 100", async () => {
      const task = await createTask(undefined, projectId, "Test Task", "implementation");
      const claimAgentId = crypto.randomUUID();

      const invalidTranscript = [
        { step: 101, thought: "Step number too large" },
      ];

      const result = await claimTask(task.id, claimAgentId, undefined, invalidTranscript);

      expect(result.status).toBe(400);
      expect((result.data as ErrorResponse).error).toContain("Validation failed");
    });

    test("should return 400 when transcript step thought is empty", async () => {
      const task = await createTask(undefined, projectId, "Test Task", "implementation");
      const claimAgentId = crypto.randomUUID();

      const invalidTranscript = [
        { step: 1, thought: "" },
      ];

      const result = await claimTask(task.id, claimAgentId, undefined, invalidTranscript);

      expect(result.status).toBe(400);
      expect((result.data as ErrorResponse).error).toContain("Validation failed");
    });

    test("should return 400 when transcript step thought exceeds 2000 characters", async () => {
      const task = await createTask(undefined, projectId, "Test Task", "implementation");
      const claimAgentId = crypto.randomUUID();

      const invalidTranscript = [
        { step: 1, thought: "a".repeat(2001) },
      ];

      const result = await claimTask(task.id, claimAgentId, undefined, invalidTranscript);

      expect(result.status).toBe(400);
      expect((result.data as ErrorResponse).error).toContain("Validation failed");
    });

    test("should return 400 when transcript step is missing required fields", async () => {
      const task = await createTask(undefined, projectId, "Test Task", "implementation");
      const claimAgentId = crypto.randomUUID();

      // Missing 'thought' field
      const invalidTranscript = [
        { step: 1 } as unknown as { step: number; thought: string },
      ];

      const result = await claimTask(task.id, claimAgentId, undefined, invalidTranscript);

      expect(result.status).toBe(400);
      expect((result.data as ErrorResponse).error).toContain("Validation failed");
    });

    test("should return 400 when transcript is not an array", async () => {
      const task = await createTask(undefined, projectId, "Test Task", "implementation");
      const claimAgentId = crypto.randomUUID();

      const body = {
        agentId: claimAgentId,
        transcript: "not an array",
      };

      const response = await fetch(`${API_URL}/api/tasks/${task.id}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      expect(response.status).toBe(400);
      const data = await response.json() as ErrorResponse;
      expect(data.error).toContain("Validation failed");
    });
  });

  describe("Backwards compatibility", () => {
    test("should allow claim without reasoning fields (existing API clients)", async () => {
      const task = await createTask(undefined, projectId, "Test Task", "implementation");
      const claimAgentId = crypto.randomUUID();

      const result = await claimTask(task.id, claimAgentId);

      expect(result.status).toBe(200);
      expect((result.data as Task).agentId).toBe(claimAgentId);
    });

    test("should allow update without reasoning fields (existing API clients)", async () => {
      const task = await createTask(agentId, projectId, "Test Task", "implementation");

      const result = await updateTask(task.id, { status: "ready" });

      expect(result.status).toBe(200);
      expect((result.data as Task).status).toBe("ready");
    });

    test("should allow release without reasoning fields (existing API clients)", async () => {
      const task = await createTask(agentId, projectId, "Test Task", "implementation");
      const claimAgentId = crypto.randomUUID();

      await claimTask(task.id, claimAgentId);
      const result = await releaseTask(task.id);

      expect(result.status).toBe(200);
      expect((result.data as Task).agentId).toBeNull();
    });

    test("should allow approval request without reasoning fields (existing API clients)", async () => {
      const task = await createTask(agentId, projectId, "Approval Task", "implementation", true);
      await db.update(tasks).set({ status: "in_progress" }).where(eq(tasks.id, task.id));

      const result = await requestApproval(task.id, agentId, "deploy to production");

      expect(result.status).toBe(201);
    });
  });

  describe("GET /api/logs response includes reasoning fields", () => {
    test("should include reason and transcript fields in logs response", async () => {
      const task = await createTask(undefined, projectId, "Test Task", "implementation");
      const claimAgentId = crypto.randomUUID();

      const reason = "Test reason";
      const transcript = [{ step: 1, thought: "Test thought" }];

      await claimTask(task.id, claimAgentId, reason, transcript);

      const { status, data: logs } = await getLogs();
      expect(status).toBe(200);

      const claimedLog = logs.find((log) => log.action === "claimed" && log.taskId === task.id);
      expect(claimedLog).toBeDefined();
      expect(claimedLog!).toHaveProperty("reason");
      expect(claimedLog!).toHaveProperty("transcript");
      expect(claimedLog!.reason).toBe(reason);
      expect(claimedLog!.transcript).not.toBeNull();
    });

    test("should return null for reason and transcript when not provided", async () => {
      const task = await createTask(undefined, projectId, "Test Task", "implementation");
      const claimAgentId = crypto.randomUUID();

      await claimTask(task.id, claimAgentId);

      const { data: logs } = await getLogs();
      const claimedLog = logs.find((log) => log.action === "claimed" && log.taskId === task.id);

      expect(claimedLog).toBeDefined();
      expect(claimedLog!.reason).toBeNull();
      expect(claimedLog!.transcript).toBeNull();
    });
  });
});
