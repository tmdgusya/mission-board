import { describe, test, expect, beforeAll, beforeEach } from "bun:test";
import { migrate } from "../../src/db/migrate";
import { resetDatabase } from "../db/reset";

const API_URL = "http://localhost:3200";

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
  createdAt: string;
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

async function createTask(agentId: string | null | undefined, projectId: string, title: string, taskType: string, requiresApproval?: boolean): Promise<Task> {
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

async function claimTask(taskId: string, agentId: string) {
  const response = await fetch(`${API_URL}/api/tasks/${taskId}/claim`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agentId }),
  });
  return { status: response.status, data: await response.json() };
}

async function releaseTask(taskId: string) {
  const response = await fetch(`${API_URL}/api/tasks/${taskId}/release`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  return { status: response.status, data: await response.json() };
}

async function updateTask(taskId: string, updates: Record<string, unknown>) {
  const response = await fetch(`${API_URL}/api/tasks/${taskId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  return { status: response.status, data: await response.json() };
}

async function deleteTask(taskId: string) {
  const response = await fetch(`${API_URL}/api/tasks/${taskId}`, {
    method: "DELETE",
  });
  return { status: response.status };
}

async function getLogs(params?: Record<string, string>): Promise<{ status: number; data: TaskLog[] }> {
  const queryString = params
    ? "?" + new URLSearchParams(params).toString()
    : "";
  const response = await fetch(`${API_URL}/api/logs${queryString}`);
  return { status: response.status, data: await response.json() as TaskLog[] };
}

describe("Activity Logging", () => {
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

  describe("VAL-LOG-001: Log task creation", () => {
    test("should create log entry when task is created", async () => {
      const task = await createTask(agentId, projectId, "Test Task", "implementation");

      const { status, data: logs } = await getLogs();
      expect(status).toBe(200);
      expect(Array.isArray(logs)).toBe(true);
      expect(logs.length).toBeGreaterThan(0);

      const createdLog = logs.find((log: { action: string; taskId: string }) =>
        log.action === "created" && log.taskId === task.id
      );
      expect(createdLog).toBeDefined();
      expect(createdLog!.agentId).toBe(agentId);
    });

    test("log details should include title, project_id, task_type, initial_status", async () => {
      const task = await createTask(agentId, projectId, "My Test Task", "bugfix");

      const { data: logs } = await getLogs();
      const createdLog = logs.find((log: { action: string; taskId: string }) =>
        log.action === "created" && log.taskId === task.id
      );

      expect(createdLog).toBeDefined();
      expect(createdLog!.details).toBeDefined();
      const details = JSON.parse(createdLog!.details);
      expect(details.title).toBe("My Test Task");
      expect(details.project_id).toBe(projectId);
      expect(details.task_type).toBe("bugfix");
      expect(details.initial_status).toBe("backlog");
    });
  });

  describe("VAL-LOG-002: Log task claim", () => {
    test("should create log entry when task is claimed", async () => {
      // Create task without agent (unclaimed)
      const task = await createTask(undefined, projectId, "Test Task", "implementation");
      const claimAgentId = crypto.randomUUID();

      await claimTask(task.id, claimAgentId);

      const { data: logs } = await getLogs();
      const claimedLog = logs.find((log: { action: string; taskId: string }) =>
        log.action === "claimed" && log.taskId === task.id
      );
      expect(claimedLog).toBeDefined();
      expect(claimedLog!.agentId).toBe(claimAgentId);
    });

    test("log details should include agent_id and previous_status", async () => {
      // Create task without agent (unclaimed)
      const task = await createTask(undefined, projectId, "Test Task", "implementation");
      const claimAgentId = crypto.randomUUID();

      // First move task to ready status
      await updateTask(task.id, { status: "ready" });

      await claimTask(task.id, claimAgentId);

      const { data: logs } = await getLogs();
      const claimedLog = logs.find((log: { action: string; taskId: string }) =>
        log.action === "claimed" && log.taskId === task.id
      );

      expect(claimedLog).toBeDefined();
      const details = JSON.parse(claimedLog!.details);
      expect(details.agent_id).toBe(claimAgentId);
      expect(details.previous_status).toBe("ready");
    });
  });

  describe("VAL-LOG-003: Log task status change", () => {
    test("should create log entry when task status is updated", async () => {
      const task = await createTask(agentId, projectId, "Test Task", "implementation");

      await updateTask(task.id, { status: "ready" });

      const { data: logs } = await getLogs();
      const updatedLog = logs.find((log: { action: string; taskId: string }) =>
        log.action === "updated" && log.taskId === task.id
      );
      expect(updatedLog).toBeDefined();
    });

    test("log details should include field_changes array with old and new values", async () => {
      const task = await createTask(agentId, projectId, "Test Task", "implementation");

      await updateTask(task.id, { status: "ready" });

      const { data: logs } = await getLogs();
      const updatedLog = logs.find((log: { action: string; taskId: string; details: string }) => {
        if (log.action !== "updated" || log.taskId !== task.id) return false;
        const details = JSON.parse(log.details);
        return details.field_changes?.some((change: { field: string }) => change.field === "status");
      });

      expect(updatedLog).toBeDefined();
      const details = JSON.parse(updatedLog!.details);
      expect(Array.isArray(details.field_changes)).toBe(true);

      const statusChange = details.field_changes.find((change: { field: string }) => change.field === "status");
      expect(statusChange).toBeDefined();
      expect(statusChange.old_value).toBe("backlog");
      expect(statusChange.new_value).toBe("ready");
    });

    test("should log multiple field changes in a single update", async () => {
      const task = await createTask(agentId, projectId, "Original Title", "implementation");

      await updateTask(task.id, { 
        title: "Updated Title",
        status: "ready" 
      });

      const { data: logs } = await getLogs();
      const updatedLog = logs.find((log: { action: string; taskId: string }) => 
        log.action === "updated" && log.taskId === task.id
      );

      expect(updatedLog).toBeDefined();
      const details = JSON.parse(updatedLog!.details);
      expect(details.field_changes.length).toBe(2);

      const titleChange = details.field_changes.find((change: { field: string }) => change.field === "title");
      expect(titleChange.old_value).toBe("Original Title");
      expect(titleChange.new_value).toBe("Updated Title");

      const statusChange = details.field_changes.find((change: { field: string }) => change.field === "status");
      expect(statusChange.old_value).toBe("backlog");
      expect(statusChange.new_value).toBe("ready");
    });
  });

  describe("VAL-LOG-004: List logs with filters", () => {
    test("should return all logs without filters", async () => {
      const task1 = await createTask(agentId, projectId, "Task 1", "implementation");
      const task2 = await createTask(agentId, projectId, "Task 2", "bugfix");

      const { status, data: logs } = await getLogs();
      expect(status).toBe(200);
      expect(Array.isArray(logs)).toBe(true);
      expect(logs.length).toBeGreaterThanOrEqual(2);
    });

    test("should filter logs by task_id", async () => {
      const task1 = await createTask(agentId, projectId, "Task 1", "implementation");
      const task2 = await createTask(agentId, projectId, "Task 2", "bugfix");

      const { data: logs } = await getLogs({ task_id: task1.id });
      expect(logs.every((log: { taskId: string }) => log.taskId === task1.id)).toBe(true);
    });

    test("should filter logs by agent_id", async () => {
      const agent1 = crypto.randomUUID();
      const agent2 = crypto.randomUUID();
      
      await createTask(agent1, projectId, "Task 1", "implementation");
      await createTask(agent2, projectId, "Task 2", "bugfix");

      const { data: logs } = await getLogs({ agent_id: agent1 });
      expect(logs.every((log: { agentId: string | null }) => log.agentId === agent1)).toBe(true);
    });

    test("should filter logs by project_id", async () => {
      const project2 = await createProject("Project 2");
      
      await createTask(agentId, projectId, "Task 1", "implementation");
      await createTask(agentId, project2.id, "Task 2", "bugfix");

      const { data: logs } = await getLogs({ project_id: projectId });
      // Logs should include task logs for tasks in the specified project
      expect(logs.length).toBeGreaterThan(0);
    });

    test("should filter logs by action", async () => {
      const task = await createTask(agentId, projectId, "Test Task", "implementation");
      await updateTask(task.id, { status: "ready" });

      const { data: createdLogs } = await getLogs({ action: "created" });
      expect(createdLogs.every((log: { action: string }) => log.action === "created")).toBe(true);

      const { data: updatedLogs } = await getLogs({ action: "updated" });
      expect(updatedLogs.every((log: { action: string }) => log.action === "updated")).toBe(true);
    });

    test("should combine multiple filters", async () => {
      const task = await createTask(agentId, projectId, "Test Task", "implementation");
      
      const { data: logs } = await getLogs({ 
        task_id: task.id, 
        action: "created",
        agent_id: agentId 
      });
      
      expect(logs.length).toBe(1);
      expect(logs[0]!.action).toBe("created");
      expect(logs[0]!.taskId).toBe(task.id);
    });
  });

  describe("VAL-LOG-005: Log detail view", () => {
    test("created action should have structured details", async () => {
      const task = await createTask(agentId, projectId, "Test Task", "feature", true);

      const { data: logs } = await getLogs({ action: "created" });
      const log = logs.find((l: { taskId: string }) => l.taskId === task.id);
      
      expect(log).toBeDefined();
      const details = JSON.parse(log!.details);
      expect(details).toHaveProperty("title");
      expect(details).toHaveProperty("project_id");
      expect(details).toHaveProperty("task_type");
      expect(details).toHaveProperty("initial_status");
    });

    test("claimed action should have structured details", async () => {
      // Create task without agent (unclaimed)
      const task = await createTask(undefined, projectId, "Test Task", "implementation");
      const claimAgentId = crypto.randomUUID();
      
      await claimTask(task.id, claimAgentId);

      const { data: logs } = await getLogs({ action: "claimed" });
      const log = logs.find((l: { taskId: string }) => l.taskId === task.id);
      
      expect(log).toBeDefined();
      const details = JSON.parse(log!.details);
      expect(details).toHaveProperty("agent_id");
      expect(details).toHaveProperty("previous_status");
    });

    test("released action should have structured details", async () => {
      const task = await createTask(agentId, projectId, "Test Task", "implementation");
      const claimAgentId = crypto.randomUUID();
      
      await claimTask(task.id, claimAgentId);
      await releaseTask(task.id);

      const { data: logs } = await getLogs({ action: "released" });
      const log = logs.find((l: { taskId: string }) => l.taskId === task.id);
      
      expect(log).toBeDefined();
      const details = JSON.parse(log!.details);
      expect(details).toHaveProperty("agent_id");
      expect(details).toHaveProperty("new_status");
    });

    test("updated action should have field_changes array", async () => {
      const task = await createTask(agentId, projectId, "Test Task", "implementation");
      await updateTask(task.id, { title: "Updated Title" });

      const { data: logs } = await getLogs({ action: "updated" });
      const log = logs.find((l: { taskId: string }) => l.taskId === task.id);
      
      expect(log).toBeDefined();
      const details = JSON.parse(log!.details);
      expect(details).toHaveProperty("field_changes");
      expect(Array.isArray(details.field_changes)).toBe(true);
      expect(details.field_changes[0]).toHaveProperty("field");
      expect(details.field_changes[0]).toHaveProperty("old_value");
      expect(details.field_changes[0]).toHaveProperty("new_value");
    });

    test("deleted action should have final task state", async () => {
      const task = await createTask(agentId, projectId, "Test Task", "implementation");
      const taskId = task.id;
      
      // Get the task details before deletion
      const taskResponse = await fetch(`${API_URL}/api/tasks/${taskId}`);
      const taskBeforeDelete = await taskResponse.json() as Task;
      
      await deleteTask(taskId);

      const { data: logs } = await getLogs({ action: "deleted" });
      const log = logs.find((l: { taskId: string }) => l.taskId === taskId);
      
      expect(log).toBeDefined();
      const details = JSON.parse(log!.details);
      expect(details).toHaveProperty("final_state");
      expect(details.final_state.title).toBe(taskBeforeDelete.title);
      expect(details.final_state.status).toBe(taskBeforeDelete.status);
    });
  });

  describe("VAL-LOG-006: Log task release", () => {
    test("should create log entry when task is released", async () => {
      // Create task without agent (unclaimed)
      const task = await createTask(undefined, projectId, "Test Task", "implementation");
      const claimAgentId = crypto.randomUUID();

      await claimTask(task.id, claimAgentId);
      await releaseTask(task.id);

      const { data: logs } = await getLogs();
      const releasedLog = logs.find((log: { action: string; taskId: string }) => 
        log.action === "released" && log.taskId === task.id
      );
      expect(releasedLog).toBeDefined();
    });

    test("log details should include agent_id and new_status", async () => {
      // Create task without agent (unclaimed)
      const task = await createTask(undefined, projectId, "Test Task", "implementation");
      const claimAgentId = crypto.randomUUID();

      await claimTask(task.id, claimAgentId);
      await releaseTask(task.id);

      const { data: logs } = await getLogs({ action: "released" });
      const releasedLog = logs[0];

      const details = JSON.parse(releasedLog!.details);
      expect(details.agent_id).toBe(claimAgentId);
      expect(details.new_status).toBe("ready");
    });
  });

  describe("VAL-LOG-007: Log task deletion", () => {
    test("should create log entry when task is deleted", async () => {
      const task = await createTask(agentId, projectId, "Test Task", "implementation");
      const taskId = task.id;

      await deleteTask(taskId);

      const { data: logs } = await getLogs();
      const deletedLog = logs.find((log: { action: string; taskId: string }) =>
        log.action === "deleted" && log.taskId === taskId
      );
      expect(deletedLog).toBeDefined();
    });

    test("log entry should exist after task is deleted", async () => {
      const task = await createTask(agentId, projectId, "Test Task", "implementation");
      const taskId = task.id;

      await deleteTask(taskId);

      // Verify the task is deleted
      const taskResponse = await fetch(`${API_URL}/api/tasks/${taskId}`);
      expect(taskResponse.status).toBe(404);

      // But the log should still exist
      const { data: logs } = await getLogs({ task_id: taskId });
      expect(logs.length).toBeGreaterThan(0);
      expect(logs.some((log: { action: string }) => log.action === "deleted")).toBe(true);
    });
  });

  describe("GET /api/logs endpoint", () => {
    test("should return 200 with array of logs", async () => {
      await createTask(agentId, projectId, "Test Task", "implementation");

      const { status, data: logs } = await getLogs();
      expect(status).toBe(200);
      expect(Array.isArray(logs)).toBe(true);
    });

    test("should return empty array when no logs match filters", async () => {
      const nonExistentTaskId = crypto.randomUUID();
      const { data: logs } = await getLogs({ task_id: nonExistentTaskId });
      expect(logs).toEqual([]);
    });

    test("should return 400 for invalid UUID format in filters", async () => {
      const { status, data } = await getLogs({ task_id: "invalid-uuid" }) as { status: number; data: { error?: string } };
      expect(status).toBe(400);
      expect(data.error).toBeDefined();
    });

    test("log entries should have all required fields", async () => {
      const task = await createTask(agentId, projectId, "Test Task", "implementation");

      const { data: logs } = await getLogs();
      const log = logs.find((l: { taskId: string }) => l.taskId === task.id);

      expect(log).toBeDefined();
      expect(log!).toHaveProperty("id");
      expect(log!).toHaveProperty("taskId");
      expect(log!).toHaveProperty("agentId");
      expect(log!).toHaveProperty("action");
      expect(log!).toHaveProperty("details");
      expect(log!).toHaveProperty("createdAt");
    });
  });
});
