import { describe, it, expect, beforeAll, beforeEach } from "bun:test";
import { db } from "../../src/db/connection";
import { migrate } from "../../src/db/migrate";
import { projects, tasks, agents, approvalRequests } from "../../src/db/schema";
import { eq } from "drizzle-orm";
import { API_BASE_URL } from "../test-config";

// Type for API responses
interface ApprovalResponse {
  id: string;
  taskId: string;
  agentId: string;
  actionRequested: string;
  status: string;
  createdAt: string;
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

describe("Approval Request API", () => {
  beforeAll(() => {
    // Run migrations before tests
    migrate();
  });

  beforeEach(async () => {
    // Clean up tables before each test (order matters for foreign keys)
    await db.delete(approvalRequests);
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
    options: {
      status?: string;
      agentId?: string | null;
      requiresApproval?: boolean;
      taskType?: string;
    } = {}
  ): Promise<string> {
    const taskId = crypto.randomUUID();
    const now = new Date();
    await db.insert(tasks).values({
      id: taskId,
      projectId,
      agentId: options.agentId ?? null,
      title,
      taskType: options.taskType ?? "implementation",
      status: options.status ?? "backlog",
      requiresApproval: options.requiresApproval ?? false,
      createdAt: now,
      updatedAt: now,
      claimedAt: options.agentId ? now : null,
    });
    return taskId;
  }

  describe("POST /api/approvals - VAL-APPR-001: Request approval", () => {
    it("should create approval request with pending status for task requiring approval", async () => {
      const projectId = await createTestProject();
      const agentId = await createTestAgent();
      const taskId = await createTestTask(projectId, "Approval Task", {
        requiresApproval: true,
        status: "in_progress",
        agentId,
      });

      const response = await fetch(`${API_BASE_URL}/api/approvals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId,
          agentId,
          actionRequested: "deploy to production",
        }),
      });

      expect(response.status).toBe(201);
      const data = (await response.json()) as ApprovalResponse;
      expect(data.id).toBeDefined();
      expect(data.taskId).toBe(taskId);
      expect(data.agentId).toBe(agentId);
      expect(data.actionRequested).toBe("deploy to production");
      expect(data.status).toBe("pending");
      expect(data.createdAt).toBeDefined();
    });

    it("should transition task status to review when approval is requested", async () => {
      const projectId = await createTestProject();
      const agentId = await createTestAgent();
      const taskId = await createTestTask(projectId, "Approval Task", {
        requiresApproval: true,
        status: "in_progress",
        agentId,
      });

      // Verify task starts in in_progress
      const taskBefore = await db.select().from(tasks).where(eq(tasks.id, taskId));
      expect(taskBefore[0]!.status).toBe("in_progress");

      const response = await fetch(`${API_BASE_URL}/api/approvals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId,
          agentId,
          actionRequested: "deploy",
        }),
      });

      expect(response.status).toBe(201);

      // Verify task status changed to review
      const taskAfter = await db.select().from(tasks).where(eq(tasks.id, taskId));
      expect(taskAfter[0]!.status).toBe("review");
    });

    it("should transition task from ready to review when approval is requested", async () => {
      const projectId = await createTestProject();
      const agentId = await createTestAgent();
      const taskId = await createTestTask(projectId, "Approval Task", {
        requiresApproval: true,
        status: "ready",
      });

      const response = await fetch(`${API_BASE_URL}/api/approvals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId,
          agentId,
          actionRequested: "review",
        }),
      });

      expect(response.status).toBe(201);

      const taskAfter = await db.select().from(tasks).where(eq(tasks.id, taskId));
      expect(taskAfter[0]!.status).toBe("review");
    });

    it("should auto-register agent if it does not exist", async () => {
      const projectId = await createTestProject();
      const taskId = await createTestTask(projectId, "Approval Task", {
        requiresApproval: true,
        status: "in_progress",
      });
      const newAgentId = crypto.randomUUID();

      // Verify agent doesn't exist
      const agentsBefore = await db.select().from(agents).where(eq(agents.id, newAgentId));
      expect(agentsBefore.length).toBe(0);

      const response = await fetch(`${API_BASE_URL}/api/approvals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId,
          agentId: newAgentId,
          actionRequested: "deploy",
        }),
      });

      expect(response.status).toBe(201);

      // Verify agent was auto-created
      const agentsAfter = await db.select().from(agents).where(eq(agents.id, newAgentId));
      expect(agentsAfter.length).toBe(1);
    });
  });

  describe("POST /api/approvals - VAL-APPR-002: Request approval validation", () => {
    it("should return 400 when task does not require approval", async () => {
      const projectId = await createTestProject();
      const agentId = await createTestAgent();
      const taskId = await createTestTask(projectId, "No Approval Task", {
        requiresApproval: false,
        status: "in_progress",
        agentId,
      });

      const response = await fetch(`${API_BASE_URL}/api/approvals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId,
          agentId,
          actionRequested: "deploy",
        }),
      });

      expect(response.status).toBe(400);
      const data = (await response.json()) as ErrorResponse;
      expect(data.error).toContain("does not require approval");
    });

    it("should return 400 when task does not exist", async () => {
      const agentId = await createTestAgent();
      const nonExistentTaskId = crypto.randomUUID();

      const response = await fetch(`${API_BASE_URL}/api/approvals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: nonExistentTaskId,
          agentId,
          actionRequested: "deploy",
        }),
      });

      expect(response.status).toBe(404);
      const data = (await response.json()) as ErrorResponse;
      expect(data.error).toContain("Task not found");
    });

    it("should return 409 when approval already pending for same task", async () => {
      const projectId = await createTestProject();
      const agentId = await createTestAgent();
      const taskId = await createTestTask(projectId, "Approval Task", {
        requiresApproval: true,
        status: "in_progress",
        agentId,
      });

      // Create first approval request
      const firstResponse = await fetch(`${API_BASE_URL}/api/approvals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId,
          agentId,
          actionRequested: "deploy",
        }),
      });
      expect(firstResponse.status).toBe(201);

      // Try to create second approval request for same task
      const secondResponse = await fetch(`${API_BASE_URL}/api/approvals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId,
          agentId,
          actionRequested: "deploy again",
        }),
      });

      expect(secondResponse.status).toBe(409);
      const data = (await secondResponse.json()) as ErrorResponse;
      expect(data.error).toContain("already pending");
    });

    it("should return 400 for missing required fields", async () => {
      const response = await fetch(`${API_BASE_URL}/api/approvals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(400);
      const data = (await response.json()) as ErrorResponse;
      expect(data.error).toContain("Validation failed");
    });

    it("should return 400 for invalid task_id format", async () => {
      const agentId = await createTestAgent();

      const response = await fetch(`${API_BASE_URL}/api/approvals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: "not-a-uuid",
          agentId,
          actionRequested: "deploy",
        }),
      });

      expect(response.status).toBe(400);
      const data = (await response.json()) as ErrorResponse;
      expect(data.error).toContain("Validation failed");
    });

    it("should return 400 for invalid agent_id format", async () => {
      const response = await fetch(`${API_BASE_URL}/api/approvals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: crypto.randomUUID(),
          agentId: "not-a-uuid",
          actionRequested: "deploy",
        }),
      });

      expect(response.status).toBe(400);
      const data = (await response.json()) as ErrorResponse;
      expect(data.error).toContain("Validation failed");
    });

    it("should return 400 for empty action_requested", async () => {
      const agentId = await createTestAgent();

      const response = await fetch(`${API_BASE_URL}/api/approvals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: crypto.randomUUID(),
          agentId,
          actionRequested: "",
        }),
      });

      expect(response.status).toBe(400);
    });

    it("should return 400 for invalid JSON", async () => {
      const response = await fetch(`${API_BASE_URL}/api/approvals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not valid json",
      });

      expect(response.status).toBe(400);
    });
  });

  describe("GET /api/approvals - VAL-APPR-007: View approval history", () => {
    it("should return empty array when no approvals exist", async () => {
      const response = await fetch(`${API_BASE_URL}/api/approvals`);

      expect(response.status).toBe(200);
      const data = (await response.json()) as ApprovalResponse[];
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(0);
    });

    it("should return all approval requests", async () => {
      const projectId = await createTestProject();
      const agentId = await createTestAgent();
      const taskId1 = await createTestTask(projectId, "Task 1", {
        requiresApproval: true,
        status: "in_progress",
        agentId,
      });
      const taskId2 = await createTestTask(projectId, "Task 2", {
        requiresApproval: true,
        status: "in_progress",
        agentId,
      });

      // Create approval requests
      await fetch(`${API_BASE_URL}/api/approvals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: taskId1, agentId, actionRequested: "deploy 1" }),
      });
      await fetch(`${API_BASE_URL}/api/approvals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: taskId2, agentId, actionRequested: "deploy 2" }),
      });

      const response = await fetch(`${API_BASE_URL}/api/approvals`);

      expect(response.status).toBe(200);
      const data = (await response.json()) as ApprovalResponse[];
      expect(data.length).toBe(2);
      expect(data.every((a) => a.id)).toBe(true);
      expect(data.every((a) => a.taskId)).toBe(true);
      expect(data.every((a) => a.agentId)).toBe(true);
      expect(data.every((a) => a.actionRequested)).toBe(true);
      expect(data.every((a) => a.status)).toBe(true);
      expect(data.every((a) => a.createdAt)).toBe(true);
    });

    it("should filter approvals by status", async () => {
      const projectId = await createTestProject();
      const agentId = await createTestAgent();
      const taskId = await createTestTask(projectId, "Task", {
        requiresApproval: true,
        status: "in_progress",
        agentId,
      });

      // Create a pending approval
      await fetch(`${API_BASE_URL}/api/approvals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, agentId, actionRequested: "deploy" }),
      });

      // Manually create an approved approval
      const approvedId = crypto.randomUUID();
      const otherTaskId = await createTestTask(projectId, "Other Task", {
        requiresApproval: true,
        status: "in_progress",
        agentId,
      });
      await db.insert(approvalRequests).values({
        id: approvedId,
        taskId: otherTaskId,
        agentId,
        actionRequested: "other action",
        status: "approved",
        reviewedBy: agentId,
        reviewedAt: new Date(),
        createdAt: new Date(),
      });

      // Filter by pending
      const pendingResponse = await fetch(`${API_BASE_URL}/api/approvals?status=pending`);
      expect(pendingResponse.status).toBe(200);
      const pendingData = (await pendingResponse.json()) as ApprovalResponse[];
      expect(pendingData.length).toBe(1);
      expect(pendingData[0]!.status).toBe("pending");

      // Filter by approved
      const approvedResponse = await fetch(`${API_BASE_URL}/api/approvals?status=approved`);
      expect(approvedResponse.status).toBe(200);
      const approvedData = (await approvedResponse.json()) as ApprovalResponse[];
      expect(approvedData.length).toBe(1);
      expect(approvedData[0]!.status).toBe("approved");

      // Filter by denied
      const deniedResponse = await fetch(`${API_BASE_URL}/api/approvals?status=denied`);
      expect(deniedResponse.status).toBe(200);
      const deniedData = (await deniedResponse.json()) as ApprovalResponse[];
      expect(deniedData.length).toBe(0);
    });

    it("should return 400 for invalid status filter", async () => {
      const response = await fetch(`${API_BASE_URL}/api/approvals?status=invalid_status`);

      expect(response.status).toBe(400);
      const data = (await response.json()) as ErrorResponse;
      expect(data.error).toContain("Invalid status filter");
    });
  });

  describe("GET /api/approvals - VAL-APPR-008: Agent check approval status", () => {
    it("should filter approvals by task_id", async () => {
      const projectId = await createTestProject();
      const agentId = await createTestAgent();
      const taskId1 = await createTestTask(projectId, "Task 1", {
        requiresApproval: true,
        status: "in_progress",
        agentId,
      });
      const taskId2 = await createTestTask(projectId, "Task 2", {
        requiresApproval: true,
        status: "in_progress",
        agentId,
      });

      // Create approval requests for both tasks
      await fetch(`${API_BASE_URL}/api/approvals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: taskId1, agentId, actionRequested: "deploy 1" }),
      });
      await fetch(`${API_BASE_URL}/api/approvals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: taskId2, agentId, actionRequested: "deploy 2" }),
      });

      // Filter by task_id
      const response = await fetch(`${API_BASE_URL}/api/approvals?task_id=${taskId1}`);

      expect(response.status).toBe(200);
      const data = (await response.json()) as ApprovalResponse[];
      expect(data.length).toBe(1);
      expect(data[0]!.taskId).toBe(taskId1);
      expect(data[0]!.status).toBe("pending");
    });

    it("should return empty array when no approvals for task_id", async () => {
      const response = await fetch(
        `${API_BASE_URL}/api/approvals?task_id=${crypto.randomUUID()}`
      );

      expect(response.status).toBe(200);
      const data = (await response.json()) as ApprovalResponse[];
      expect(data.length).toBe(0);
    });

    it("should combine task_id and status filters", async () => {
      const projectId = await createTestProject();
      const agentId = await createTestAgent();
      const taskId = await createTestTask(projectId, "Task", {
        requiresApproval: true,
        status: "in_progress",
        agentId,
      });

      // Create pending approval
      await fetch(`${API_BASE_URL}/api/approvals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, agentId, actionRequested: "deploy" }),
      });

      // Filter by task_id and status=pending
      const response = await fetch(
        `${API_BASE_URL}/api/approvals?task_id=${taskId}&status=pending`
      );

      expect(response.status).toBe(200);
      const data = (await response.json()) as ApprovalResponse[];
      expect(data.length).toBe(1);
      expect(data[0]!.taskId).toBe(taskId);
      expect(data[0]!.status).toBe("pending");

      // Filter by task_id and status=approved (should be empty)
      const approvedResponse = await fetch(
        `${API_BASE_URL}/api/approvals?task_id=${taskId}&status=approved`
      );
      const approvedData = (await approvedResponse.json()) as ApprovalResponse[];
      expect(approvedData.length).toBe(0);
    });
  });

  describe("VAL-APPR-009: Re-request approval after denial", () => {
    it("should allow new approval request after denial", async () => {
      const projectId = await createTestProject();
      const agentId = await createTestAgent();
      const taskId = await createTestTask(projectId, "Approval Task", {
        requiresApproval: true,
        status: "in_progress",
        agentId,
      });

      // Create initial approval request
      const firstResponse = await fetch(`${API_BASE_URL}/api/approvals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, agentId, actionRequested: "deploy" }),
      });
      expect(firstResponse.status).toBe(201);
      const firstApproval = (await firstResponse.json()) as ApprovalResponse;

      // Manually deny the approval (simulating review step)
      await db
        .update(approvalRequests)
        .set({
          status: "denied",
          reviewedBy: agentId,
          reviewedAt: new Date(),
          notes: "Needs more work",
        })
        .where(eq(approvalRequests.id, firstApproval.id));

      // Task would be in 'blocked' status from denial
      await db
        .update(tasks)
        .set({ status: "blocked", updatedAt: new Date() })
        .where(eq(tasks.id, taskId));

      // Verify there's no pending approval
      const pendingBefore = await db
        .select()
        .from(approvalRequests)
        .where(
          eq(approvalRequests.taskId, taskId)
        );
      expect(pendingBefore.length).toBe(1);
      expect(pendingBefore[0]!.status).toBe("denied");

      // Re-request approval
      const secondResponse = await fetch(`${API_BASE_URL}/api/approvals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId,
          agentId,
          actionRequested: "deploy again",
        }),
      });

      expect(secondResponse.status).toBe(201);
      const secondApproval = (await secondResponse.json()) as ApprovalResponse;
      expect(secondApproval.status).toBe("pending");
      expect(secondApproval.id).not.toBe(firstApproval.id);

      // Verify task transitions to review
      const taskAfter = await db.select().from(tasks).where(eq(tasks.id, taskId));
      expect(taskAfter[0]!.status).toBe("review");

      // Verify both approval records exist in history
      const allApprovals = await db
        .select()
        .from(approvalRequests)
        .where(eq(approvalRequests.taskId, taskId));
      expect(allApprovals.length).toBe(2);
      expect(allApprovals.some((a) => a.status === "denied")).toBe(true);
      expect(allApprovals.some((a) => a.status === "pending")).toBe(true);
    });

    it("should preserve previous denial history when re-requesting", async () => {
      const projectId = await createTestProject();
      const agentId = await createTestAgent();
      const taskId = await createTestTask(projectId, "Task", {
        requiresApproval: true,
        status: "in_progress",
        agentId,
      });

      // Create and deny first approval
      const firstResponse = await fetch(`${API_BASE_URL}/api/approvals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, agentId, actionRequested: "first attempt" }),
      });
      const firstApproval = (await firstResponse.json()) as ApprovalResponse;

      await db
        .update(approvalRequests)
        .set({
          status: "denied",
          reviewedBy: agentId,
          reviewedAt: new Date(),
          notes: "Fix bugs first",
        })
        .where(eq(approvalRequests.id, firstApproval.id));

      await db
        .update(tasks)
        .set({ status: "blocked", updatedAt: new Date() })
        .where(eq(tasks.id, taskId));

      // Create second approval
      const secondResponse = await fetch(`${API_BASE_URL}/api/approvals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, agentId, actionRequested: "second attempt" }),
      });
      expect(secondResponse.status).toBe(201);

      // Check that both approvals are present in full history
      const historyResponse = await fetch(`${API_BASE_URL}/api/approvals?task_id=${taskId}`);
      const history = (await historyResponse.json()) as ApprovalResponse[];
      expect(history.length).toBe(2);

      // Verify first is denied
      const deniedApproval = history.find((a) => a.id === firstApproval.id);
      expect(deniedApproval).toBeDefined();

      // Verify second is pending
      const pendingApproval = history.find((a) => a.id !== firstApproval.id);
      expect(pendingApproval).toBeDefined();
      expect(pendingApproval!.status).toBe("pending");
    });
  });

  describe("Additional edge cases", () => {
    it("should persist approval request in database", async () => {
      const projectId = await createTestProject();
      const agentId = await createTestAgent();
      const taskId = await createTestTask(projectId, "Task", {
        requiresApproval: true,
        status: "in_progress",
        agentId,
      });

      const response = await fetch(`${API_BASE_URL}/api/approvals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, agentId, actionRequested: "deploy" }),
      });
      expect(response.status).toBe(201);
      const approval = (await response.json()) as ApprovalResponse;

      // Verify it's in the database
      const dbResult = await db
        .select()
        .from(approvalRequests)
        .where(eq(approvalRequests.id, approval.id));
      expect(dbResult.length).toBe(1);
      expect(dbResult[0]!.taskId).toBe(taskId);
      expect(dbResult[0]!.agentId).toBe(agentId);
      expect(dbResult[0]!.actionRequested).toBe("deploy");
      expect(dbResult[0]!.status).toBe("pending");
    });

    it("should handle creating approval for task in review status (already in review)", async () => {
      const projectId = await createTestProject();
      const agentId = await createTestAgent();
      const taskId = await createTestTask(projectId, "Task", {
        requiresApproval: true,
        status: "review",
        agentId,
      });

      const response = await fetch(`${API_BASE_URL}/api/approvals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, agentId, actionRequested: "deploy" }),
      });

      expect(response.status).toBe(201);
      const approval = (await response.json()) as ApprovalResponse;
      expect(approval.status).toBe("pending");

      // Task should still be in review
      const taskAfter = await db.select().from(tasks).where(eq(tasks.id, taskId));
      expect(taskAfter[0]!.status).toBe("review");
    });

    it("should handle creating approval for task in blocked status (after previous denial)", async () => {
      const projectId = await createTestProject();
      const agentId = await createTestAgent();
      const taskId = await createTestTask(projectId, "Task", {
        requiresApproval: true,
        status: "blocked",
        agentId,
      });

      const response = await fetch(`${API_BASE_URL}/api/approvals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, agentId, actionRequested: "retry deploy" }),
      });

      expect(response.status).toBe(201);
      const approval = (await response.json()) as ApprovalResponse;
      expect(approval.status).toBe("pending");

      // Task should transition to review
      const taskAfter = await db.select().from(tasks).where(eq(tasks.id, taskId));
      expect(taskAfter[0]!.status).toBe("review");
    });
  });
});
