import { describe, it, expect, beforeAll, beforeEach } from "bun:test";
import { db } from "../../src/db/connection";
import { migrate } from "../../src/db/migrate";
import { projects, tasks, agents, approvalRequests } from "../../src/db/schema";
import { eq } from "drizzle-orm";

// Test configuration
const API_BASE_URL = "http://localhost:3200";

// Type for API responses
interface ApprovalResponse {
  id: string;
  taskId: string;
  agentId: string;
  actionRequested: string;
  status: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  notes: string | null;
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

describe("Approval Review API", () => {
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

  // Helper to create a pending approval request via API
  async function createPendingApproval(
    taskId: string,
    agentId: string,
    actionRequested: string = "deploy to production"
  ): Promise<ApprovalResponse> {
    const response = await fetch(`${API_BASE_URL}/api/approvals`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId, agentId, actionRequested }),
    });
    expect(response.status).toBe(201);
    return (await response.json()) as ApprovalResponse;
  }

  describe("POST /api/approvals/:id/approve - VAL-APPR-004: Approve request", () => {
    it("should approve a pending approval request", async () => {
      const projectId = await createTestProject();
      const agentId = await createTestAgent();
      const reviewerId = await createTestAgent("Reviewer");
      const taskId = await createTestTask(projectId, "Approval Task", {
        requiresApproval: true,
        status: "in_progress",
        agentId,
      });

      const approval = await createPendingApproval(taskId, agentId, "deploy");

      const response = await fetch(`${API_BASE_URL}/api/approvals/${approval.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewedBy: reviewerId }),
      });

      expect(response.status).toBe(200);
      const data = (await response.json()) as ApprovalResponse;
      expect(data.id).toBe(approval.id);
      expect(data.status).toBe("approved");
      expect(data.reviewedBy).toBe(reviewerId);
      expect(data.reviewedAt).toBeDefined();
    });

    it("should set task status to ready when approved", async () => {
      const projectId = await createTestProject();
      const agentId = await createTestAgent();
      const reviewerId = await createTestAgent("Reviewer");
      const taskId = await createTestTask(projectId, "Approval Task", {
        requiresApproval: true,
        status: "in_progress",
        agentId,
      });

      const approval = await createPendingApproval(taskId, agentId);

      // Task should be in 'review' after approval request
      const taskInReview = await db.select().from(tasks).where(eq(tasks.id, taskId));
      expect(taskInReview[0]!.status).toBe("review");
      const response = await fetch(`${API_BASE_URL}/api/approvals/${approval.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewedBy: reviewerId }),
      });

      expect(response.status).toBe(200);

      // Verify task status changed to ready
      const taskAfter = await db.select().from(tasks).where(eq(tasks.id, taskId));
      expect(taskAfter[0]!.status).toBe("ready");
    });

    it("should set reviewed_at timestamp", async () => {
      const projectId = await createTestProject();
      const agentId = await createTestAgent();
      const reviewerId = await createTestAgent("Reviewer");
      const taskId = await createTestTask(projectId, "Task", {
        requiresApproval: true,
        status: "in_progress",
        agentId,
      });

      const approval = await createPendingApproval(taskId, agentId);

      // Verify reviewed_at is null before approval
      const dbApprovalBefore = await db
        .select()
        .from(approvalRequests)
        .where(eq(approvalRequests.id, approval.id));
      expect(dbApprovalBefore[0]!.reviewedAt).toBeNull();

      const beforeTime = new Date();
      const response = await fetch(`${API_BASE_URL}/api/approvals/${approval.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewedBy: reviewerId }),
      });

      expect(response.status).toBe(200);
      const data = (await response.json()) as ApprovalResponse;
      const afterTime = new Date();

      // Verify reviewed_at is set (between before and after)
      expect(data.reviewedAt).toBeDefined();
      const reviewedAt = new Date(data.reviewedAt!);
      expect(reviewedAt.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime() - 1000);
      expect(reviewedAt.getTime()).toBeLessThanOrEqual(afterTime.getTime() + 1000);
    });

    it("should persist approval in database with correct status", async () => {
      const projectId = await createTestProject();
      const agentId = await createTestAgent();
      const reviewerId = await createTestAgent("Reviewer");
      const taskId = await createTestTask(projectId, "Task", {
        requiresApproval: true,
        status: "in_progress",
        agentId,
      });

      const approval = await createPendingApproval(taskId, agentId);

      const response = await fetch(`${API_BASE_URL}/api/approvals/${approval.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewedBy: reviewerId }),
      });

      expect(response.status).toBe(200);

      // Verify in database
      const dbApproval = await db
        .select()
        .from(approvalRequests)
        .where(eq(approvalRequests.id, approval.id));
      expect(dbApproval.length).toBe(1);
      expect(dbApproval[0]!.status).toBe("approved");
      expect(dbApproval[0]!.reviewedBy).toBe(reviewerId);
      expect(dbApproval[0]!.reviewedAt).not.toBeNull();
    });
  });

  describe("POST /api/approvals/:id/deny - VAL-APPR-005: Deny request", () => {
    it("should deny a pending approval request with notes", async () => {
      const projectId = await createTestProject();
      const agentId = await createTestAgent();
      const reviewerId = await createTestAgent("Reviewer");
      const taskId = await createTestTask(projectId, "Approval Task", {
        requiresApproval: true,
        status: "in_progress",
        agentId,
      });

      const approval = await createPendingApproval(taskId, agentId, "deploy");

      const response = await fetch(`${API_BASE_URL}/api/approvals/${approval.id}/deny`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewedBy: reviewerId,
          notes: "Needs more testing before deployment",
        }),
      });

      expect(response.status).toBe(200);
      const data = (await response.json()) as ApprovalResponse;
      expect(data.id).toBe(approval.id);
      expect(data.status).toBe("denied");
      expect(data.reviewedBy).toBe(reviewerId);
      expect(data.reviewedAt).toBeDefined();
      expect(data.notes).toBe("Needs more testing before deployment");
    });

    it("should set task status to blocked when denied", async () => {
      const projectId = await createTestProject();
      const agentId = await createTestAgent();
      const reviewerId = await createTestAgent("Reviewer");
      const taskId = await createTestTask(projectId, "Approval Task", {
        requiresApproval: true,
        status: "in_progress",
        agentId,
      });

      const approval = await createPendingApproval(taskId, agentId);

      const response = await fetch(`${API_BASE_URL}/api/approvals/${approval.id}/deny`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewedBy: reviewerId,
          notes: "Security concerns",
        }),
      });

      expect(response.status).toBe(200);

      // Verify task status changed to blocked
      const taskAfter = await db.select().from(tasks).where(eq(tasks.id, taskId));
      expect(taskAfter[0]!.status).toBe("blocked");
    });

    it("should return 400 when notes are missing for denial", async () => {
      const projectId = await createTestProject();
      const agentId = await createTestAgent();
      const reviewerId = await createTestAgent("Reviewer");
      const taskId = await createTestTask(projectId, "Approval Task", {
        requiresApproval: true,
        status: "in_progress",
        agentId,
      });

      const approval = await createPendingApproval(taskId, agentId);

      const response = await fetch(`${API_BASE_URL}/api/approvals/${approval.id}/deny`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewedBy: reviewerId,
          // notes intentionally omitted
        }),
      });

      expect(response.status).toBe(400);
      const data = (await response.json()) as ErrorResponse;
      expect(data.error).toContain("Validation failed");

      // Verify approval is still pending
      const dbApproval = await db
        .select()
        .from(approvalRequests)
        .where(eq(approvalRequests.id, approval.id));
      expect(dbApproval[0]!.status).toBe("pending");
    });

    it("should return 400 when notes are empty for denial", async () => {
      const projectId = await createTestProject();
      const agentId = await createTestAgent();
      const reviewerId = await createTestAgent("Reviewer");
      const taskId = await createTestTask(projectId, "Approval Task", {
        requiresApproval: true,
        status: "in_progress",
        agentId,
      });

      const approval = await createPendingApproval(taskId, agentId);

      const response = await fetch(`${API_BASE_URL}/api/approvals/${approval.id}/deny`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewedBy: reviewerId,
          notes: "",
        }),
      });

      expect(response.status).toBe(400);
      const data = (await response.json()) as ErrorResponse;
      expect(data.error).toContain("Validation failed");

      // Verify approval is still pending
      const dbApproval = await db
        .select()
        .from(approvalRequests)
        .where(eq(approvalRequests.id, approval.id));
      expect(dbApproval[0]!.status).toBe("pending");
    });

    it("should persist denial in database with notes", async () => {
      const projectId = await createTestProject();
      const agentId = await createTestAgent();
      const reviewerId = await createTestAgent("Reviewer");
      const taskId = await createTestTask(projectId, "Task", {
        requiresApproval: true,
        status: "in_progress",
        agentId,
      });

      const approval = await createPendingApproval(taskId, agentId);

      const response = await fetch(`${API_BASE_URL}/api/approvals/${approval.id}/deny`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewedBy: reviewerId,
          notes: "Does not meet requirements",
        }),
      });

      expect(response.status).toBe(200);

      // Verify in database
      const dbApproval = await db
        .select()
        .from(approvalRequests)
        .where(eq(approvalRequests.id, approval.id));
      expect(dbApproval.length).toBe(1);
      expect(dbApproval[0]!.status).toBe("denied");
      expect(dbApproval[0]!.reviewedBy).toBe(reviewerId);
      expect(dbApproval[0]!.reviewedAt).not.toBeNull();
      expect(dbApproval[0]!.notes).toBe("Does not meet requirements");
    });
  });

  describe("VAL-APPR-006: Approval conflict - 409 if already processed", () => {
    it("should return 409 when approving an already approved request", async () => {
      const projectId = await createTestProject();
      const agentId = await createTestAgent();
      const reviewerId = await createTestAgent("Reviewer");
      const taskId = await createTestTask(projectId, "Task", {
        requiresApproval: true,
        status: "in_progress",
        agentId,
      });

      const approval = await createPendingApproval(taskId, agentId);

      // First approval succeeds
      const firstResponse = await fetch(
        `${API_BASE_URL}/api/approvals/${approval.id}/approve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reviewedBy: reviewerId }),
        }
      );
      expect(firstResponse.status).toBe(200);

      // Second approval attempt should return 409
      const secondResponse = await fetch(
        `${API_BASE_URL}/api/approvals/${approval.id}/approve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reviewedBy: reviewerId }),
        }
      );
      expect(secondResponse.status).toBe(409);
      const data = (await secondResponse.json()) as ErrorResponse;
      expect(data.error).toContain("already");
    });

    it("should return 409 when denying an already approved request", async () => {
      const projectId = await createTestProject();
      const agentId = await createTestAgent();
      const reviewerId = await createTestAgent("Reviewer");
      const taskId = await createTestTask(projectId, "Task", {
        requiresApproval: true,
        status: "in_progress",
        agentId,
      });

      const approval = await createPendingApproval(taskId, agentId);

      // Approve first
      const approveResponse = await fetch(
        `${API_BASE_URL}/api/approvals/${approval.id}/approve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reviewedBy: reviewerId }),
        }
      );
      expect(approveResponse.status).toBe(200);

      // Try to deny after approval should return 409
      const denyResponse = await fetch(
        `${API_BASE_URL}/api/approvals/${approval.id}/deny`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reviewedBy: reviewerId, notes: "Too late" }),
        }
      );
      expect(denyResponse.status).toBe(409);
      const data = (await denyResponse.json()) as ErrorResponse;
      expect(data.error).toContain("already");
    });

    it("should return 409 when approving an already denied request", async () => {
      const projectId = await createTestProject();
      const agentId = await createTestAgent();
      const reviewerId = await createTestAgent("Reviewer");
      const taskId = await createTestTask(projectId, "Task", {
        requiresApproval: true,
        status: "in_progress",
        agentId,
      });

      const approval = await createPendingApproval(taskId, agentId);

      // Deny first
      const denyResponse = await fetch(
        `${API_BASE_URL}/api/approvals/${approval.id}/deny`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reviewedBy: reviewerId, notes: "Not good enough" }),
        }
      );
      expect(denyResponse.status).toBe(200);

      // Try to approve after denial should return 409
      const approveResponse = await fetch(
        `${API_BASE_URL}/api/approvals/${approval.id}/approve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reviewedBy: reviewerId }),
        }
      );
      expect(approveResponse.status).toBe(409);
      const data = (await approveResponse.json()) as ErrorResponse;
      expect(data.error).toContain("already");
    });

    it("should return 409 when denying an already denied request", async () => {
      const projectId = await createTestProject();
      const agentId = await createTestAgent();
      const reviewerId = await createTestAgent("Reviewer");
      const taskId = await createTestTask(projectId, "Task", {
        requiresApproval: true,
        status: "in_progress",
        agentId,
      });

      const approval = await createPendingApproval(taskId, agentId);

      // First denial
      const firstResponse = await fetch(
        `${API_BASE_URL}/api/approvals/${approval.id}/deny`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reviewedBy: reviewerId, notes: "First denial" }),
        }
      );
      expect(firstResponse.status).toBe(200);

      // Second denial attempt should return 409
      const secondResponse = await fetch(
        `${API_BASE_URL}/api/approvals/${approval.id}/deny`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reviewedBy: reviewerId, notes: "Second denial" }),
        }
      );
      expect(secondResponse.status).toBe(409);
      const data = (await secondResponse.json()) as ErrorResponse;
      expect(data.error).toContain("already");
    });

    it("should not change task status on 409 conflict", async () => {
      const projectId = await createTestProject();
      const agentId = await createTestAgent();
      const reviewerId = await createTestAgent("Reviewer");
      const taskId = await createTestTask(projectId, "Task", {
        requiresApproval: true,
        status: "in_progress",
        agentId,
      });

      const approval = await createPendingApproval(taskId, agentId);

      // Approve
      const approveResponse = await fetch(
        `${API_BASE_URL}/api/approvals/${approval.id}/approve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reviewedBy: reviewerId }),
        }
      );
      expect(approveResponse.status).toBe(200);

      // Task should be 'ready' after approval
      const taskAfterApprove = await db.select().from(tasks).where(eq(tasks.id, taskId));
      expect(taskAfterApprove[0]!.status).toBe("ready");

      // Try to deny after approval
      await fetch(`${API_BASE_URL}/api/approvals/${approval.id}/deny`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewedBy: reviewerId, notes: "Try deny" }),
      });

      // Task should still be 'ready'
      const taskAfterConflict = await db.select().from(tasks).where(eq(tasks.id, taskId));
      expect(taskAfterConflict[0]!.status).toBe("ready");
    });
  });

  describe("Input validation", () => {
    it("should return 400 for invalid approval ID format on approve", async () => {
      const response = await fetch(`${API_BASE_URL}/api/approvals/not-a-uuid/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewedBy: crypto.randomUUID() }),
      });

      expect(response.status).toBe(400);
      const data = (await response.json()) as ErrorResponse;
      expect(data.error).toContain("Invalid");
    });

    it("should return 400 for invalid approval ID format on deny", async () => {
      const response = await fetch(`${API_BASE_URL}/api/approvals/not-a-uuid/deny`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewedBy: crypto.randomUUID(), notes: "notes" }),
      });

      expect(response.status).toBe(400);
      const data = (await response.json()) as ErrorResponse;
      expect(data.error).toContain("Invalid");
    });

    it("should return 404 for non-existent approval on approve", async () => {
      const response = await fetch(
        `${API_BASE_URL}/api/approvals/${crypto.randomUUID()}/approve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reviewedBy: crypto.randomUUID() }),
        }
      );

      expect(response.status).toBe(404);
      const data = (await response.json()) as ErrorResponse;
      expect(data.error.toLowerCase()).toContain("not found");
    });

    it("should return 404 for non-existent approval on deny", async () => {
      const response = await fetch(
        `${API_BASE_URL}/api/approvals/${crypto.randomUUID()}/deny`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reviewedBy: crypto.randomUUID(), notes: "notes" }),
        }
      );

      expect(response.status).toBe(404);
      const data = (await response.json()) as ErrorResponse;
      expect(data.error.toLowerCase()).toContain("not found");
    });

    it("should return 400 for missing reviewed_by on approve", async () => {
      const projectId = await createTestProject();
      const agentId = await createTestAgent();
      const taskId = await createTestTask(projectId, "Task", {
        requiresApproval: true,
        status: "in_progress",
        agentId,
      });

      const approval = await createPendingApproval(taskId, agentId);

      const response = await fetch(`${API_BASE_URL}/api/approvals/${approval.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(400);
      const data = (await response.json()) as ErrorResponse;
      expect(data.error).toContain("Validation failed");
    });

    it("should return 400 for invalid reviewed_by format on approve", async () => {
      const projectId = await createTestProject();
      const agentId = await createTestAgent();
      const taskId = await createTestTask(projectId, "Task", {
        requiresApproval: true,
        status: "in_progress",
        agentId,
      });

      const approval = await createPendingApproval(taskId, agentId);

      const response = await fetch(`${API_BASE_URL}/api/approvals/${approval.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewedBy: "not-a-uuid" }),
      });

      expect(response.status).toBe(400);
      const data = (await response.json()) as ErrorResponse;
      expect(data.error).toContain("Validation failed");
    });

    it("should return 400 for missing reviewed_by on deny", async () => {
      const projectId = await createTestProject();
      const agentId = await createTestAgent();
      const taskId = await createTestTask(projectId, "Task", {
        requiresApproval: true,
        status: "in_progress",
        agentId,
      });

      const approval = await createPendingApproval(taskId, agentId);

      const response = await fetch(`${API_BASE_URL}/api/approvals/${approval.id}/deny`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: "some notes" }),
      });

      expect(response.status).toBe(400);
      const data = (await response.json()) as ErrorResponse;
      expect(data.error).toContain("Validation failed");
    });

    it("should return 400 for invalid JSON body", async () => {
      const response = await fetch(`${API_BASE_URL}/api/approvals/${crypto.randomUUID()}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not valid json",
      });

      expect(response.status).toBe(400);
    });
  });

  describe("Activity logging", () => {
    it("should log task status change when approval is approved", async () => {
      const projectId = await createTestProject();
      const agentId = await createTestAgent();
      const reviewerId = await createTestAgent("Reviewer");
      const taskId = await createTestTask(projectId, "Task", {
        requiresApproval: true,
        status: "in_progress",
        agentId,
      });

      const approval = await createPendingApproval(taskId, agentId);

      const response = await fetch(`${API_BASE_URL}/api/approvals/${approval.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewedBy: reviewerId }),
      });

      expect(response.status).toBe(200);

      // Verify log entry for status change (review -> ready)
      const logsResponse = await fetch(`${API_BASE_URL}/api/logs?task_id=${taskId}`);
      const logs = (await logsResponse.json()) as Array<{
        taskId: string;
        action: string;
        details: string;
      }>;

      // Find the status change log from approval (not the one from request creation)
      const statusLogs = logs.filter(
        (l) => l.action === "updated" && l.taskId === taskId
      );
      expect(statusLogs.length).toBeGreaterThanOrEqual(2);
      const statusLog = statusLogs.find((l) => {
        const details = JSON.parse(l.details);
        return details.field_changes?.some(
          (fc: { field: string; old_value: string; new_value: string }) =>
            fc.old_value === "review" && fc.new_value === "ready"
        );
      });
      expect(statusLog).toBeDefined();
      const details = JSON.parse(statusLog!.details);
      expect(details.field_changes).toContainEqual(
        expect.objectContaining({
          field: "status",
          old_value: "review",
          new_value: "ready",
        })
      );
    });

    it("should log task status change when approval is denied", async () => {
      const projectId = await createTestProject();
      const agentId = await createTestAgent();
      const reviewerId = await createTestAgent("Reviewer");
      const taskId = await createTestTask(projectId, "Task", {
        requiresApproval: true,
        status: "in_progress",
        agentId,
      });

      const approval = await createPendingApproval(taskId, agentId);

      const response = await fetch(`${API_BASE_URL}/api/approvals/${approval.id}/deny`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewedBy: reviewerId, notes: "Not ready" }),
      });

      expect(response.status).toBe(200);

      // Verify log entry for status change (review -> blocked)
      const logsResponse = await fetch(`${API_BASE_URL}/api/logs?task_id=${taskId}`);
      const logs = (await logsResponse.json()) as Array<{
        taskId: string;
        action: string;
        details: string;
      }>;

      // Find the status change log from denial (not the one from request creation)
      const statusLogs = logs.filter(
        (l) => l.action === "updated" && l.taskId === taskId
      );
      expect(statusLogs.length).toBeGreaterThanOrEqual(2);
      const statusLog = statusLogs.find((l) => {
        const details = JSON.parse(l.details);
        return details.field_changes?.some(
          (fc: { field: string; old_value: string; new_value: string }) =>
            fc.old_value === "review" && fc.new_value === "blocked"
        );
      });
      expect(statusLog).toBeDefined();
      const details = JSON.parse(statusLog!.details);
      expect(details.field_changes).toContainEqual(
        expect.objectContaining({
          field: "status",
          old_value: "review",
          new_value: "blocked",
        })
      );
    });
  });

  describe("Integration: full approval workflow", () => {
    it("should allow re-requesting approval after denial (VAL-APPR-009)", async () => {
      const projectId = await createTestProject();
      const agentId = await createTestAgent();
      const reviewerId = await createTestAgent("Reviewer");
      const taskId = await createTestTask(projectId, "Task", {
        requiresApproval: true,
        status: "in_progress",
        agentId,
      });

      // Create approval request
      const firstApproval = await createPendingApproval(taskId, agentId, "deploy v1");

      // Deny the request
      const denyResponse = await fetch(
        `${API_BASE_URL}/api/approvals/${firstApproval.id}/deny`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reviewedBy: reviewerId, notes: "Fix security issues" }),
        }
      );
      expect(denyResponse.status).toBe(200);

      // Task should be blocked
      const taskAfterDeny = await db.select().from(tasks).where(eq(tasks.id, taskId));
      expect(taskAfterDeny[0]!.status).toBe("blocked");

      // Re-request approval
      const secondResponse = await fetch(`${API_BASE_URL}/api/approvals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, agentId, actionRequested: "deploy v2" }),
      });
      expect(secondResponse.status).toBe(201);
      const secondApproval = (await secondResponse.json()) as ApprovalResponse;

      // Task should be back in review
      const taskAfterReRequest = await db.select().from(tasks).where(eq(tasks.id, taskId));
      expect(taskAfterReRequest[0]!.status).toBe("review");

      // Approve the second request
      const approveResponse = await fetch(
        `${API_BASE_URL}/api/approvals/${secondApproval.id}/approve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reviewedBy: reviewerId }),
        }
      );
      expect(approveResponse.status).toBe(200);

      // Task should be ready
      const taskAfterApprove = await db.select().from(tasks).where(eq(tasks.id, taskId));
      expect(taskAfterApprove[0]!.status).toBe("ready");

      // Both approval records should exist in history
      const historyResponse = await fetch(`${API_BASE_URL}/api/approvals?task_id=${taskId}`);
      const history = (await historyResponse.json()) as ApprovalResponse[];
      expect(history.length).toBe(2);

      const deniedRecord = history.find((a) => a.id === firstApproval.id);
      expect(deniedRecord!.status).toBe("denied");
      expect(deniedRecord!.notes).toBe("Fix security issues");

      const approvedRecord = history.find((a) => a.id === secondApproval.id);
      expect(approvedRecord!.status).toBe("approved");
    });
  });
});
