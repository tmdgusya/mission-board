import { describe, it, expect, beforeAll, beforeEach } from "bun:test";
import { db } from "../../src/db/connection";
import { migrate } from "../../src/db/migrate";
import { projects, tasks, agents, approvalRequests, taskLogs } from "../../src/db/schema";
import { eq } from "drizzle-orm";
import { API_BASE_URL } from "../test-config";

// Types for API responses
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

interface LogResponse {
  id: string;
  taskId: string;
  agentId: string | null;
  action: string;
  details: string | null;
  createdAt: string;
}

const TEST_AGENT_ID = "aabbccdd-1111-2222-3333-444455556666";
const REVIEWER_ID = "aabbccdd-1111-2222-3333-444455556677";
const TEST_PROJECT = "Cross-Flow Approval Test Project";

let projectId: string;

/**
 * Helper to create a project via API
 */
async function createProject(name: string): Promise<string> {
  const res = await fetch(`${API_BASE_URL}/api/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  expect(res.status).toBe(201);
  const data = await res.json();
  return data.id;
}

/**
 * Helper to create a task via API
 */
async function createTask(params: {
  projectId: string;
  agentId: string;
  title: string;
  taskType: string;
  requiresApproval: boolean;
}): Promise<TaskResponse> {
  const res = await fetch(`${API_BASE_URL}/api/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (res.status !== 201) {
    const errorBody = await res.text();
    throw new Error(`Expected 201 but got ${res.status}: ${errorBody}`);
  }
  return res.json();
}

/**
 * Helper to claim a task via API
 */
async function claimTask(taskId: string, agentId: string): Promise<TaskResponse> {
  const res = await fetch(`${API_BASE_URL}/api/tasks/${taskId}/claim`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agentId }),
  });
  expect(res.status).toBe(200);
  return res.json();
}

/**
 * Helper to request approval via API
 */
async function requestApproval(
  taskId: string,
  agentId: string,
  actionRequested: string
): Promise<ApprovalResponse> {
  const res = await fetch(`${API_BASE_URL}/api/approvals`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ taskId, agentId, actionRequested }),
  });
  expect(res.status).toBe(201);
  return res.json();
}

/**
 * Helper to approve an approval request
 */
async function approveRequest(
  approvalId: string,
  reviewedBy: string
): Promise<ApprovalResponse> {
  const res = await fetch(`${API_BASE_URL}/api/approvals/${approvalId}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reviewedBy }),
  });
  expect(res.status).toBe(200);
  return res.json();
}

/**
 * Helper to update task status via API
 */
async function updateTaskStatus(taskId: string, status: string): Promise<TaskResponse> {
  const res = await fetch(`${API_BASE_URL}/api/tasks/${taskId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  expect(res.status).toBe(200);
  return res.json();
}

/**
 * Helper to get task logs
 */
async function getTaskLogs(taskId: string): Promise<LogResponse[]> {
  const res = await fetch(`${API_BASE_URL}/api/logs?taskId=${taskId}`);
  expect(res.status).toBe(200);
  return res.json();
}

describe("VAL-CROSS-003: Full Approval Workflow Integration", () => {
  beforeAll(() => {
    migrate();
  });

  beforeEach(async () => {
    // Clean up all tables (order matters for foreign keys)
    await db.delete(taskLogs);
    await db.delete(approvalRequests);
    await db.delete(tasks);
    await db.delete(projects);
    await db.delete(agents);
  });

  it("completes full approval flow: claim → request-approval → approve → complete", async () => {
    // Step 1: Create a task requiring approval
    projectId = await createProject(TEST_PROJECT);
    const task = await createTask({
      projectId,
      agentId: TEST_AGENT_ID,
      title: "Deployment to production",
      taskType: "deployment",
      requiresApproval: true,
    });

    expect(task.status).toBe("backlog");
    expect(task.requiresApproval).toBe(true);
    const taskId = task.id;

    // Step 2: Agent claims the task
    const claimedTask = await claimTask(taskId, TEST_AGENT_ID);
    expect(claimedTask.status).toBe("in_progress");
    expect(claimedTask.agentId).toBe(TEST_AGENT_ID);
    expect(claimedTask.claimedAt).toBeTruthy();

    // Step 3: Agent requests approval
    const approval = await requestApproval(taskId, TEST_AGENT_ID, "Deploy to production");
    expect(approval.status).toBe("pending");
    expect(approval.actionRequested).toBe("Deploy to production");

    // Task should have moved to 'review' status
    const taskAfterRequest = await (await fetch(`${API_BASE_URL}/api/tasks/${taskId}`)).json();
    expect(taskAfterRequest.status).toBe("review");

    // Step 4: Human approves via dashboard (simulated via API)
    const approvedApproval = await approveRequest(approval.id, REVIEWER_ID);
    expect(approvedApproval.status).toBe("approved");
    expect(approvedApproval.reviewedBy).toBe(REVIEWER_ID);
    expect(approvedApproval.reviewedAt).toBeTruthy();

    // Task should have moved to 'ready' status after approval
    const taskAfterApprove = await (await fetch(`${API_BASE_URL}/api/tasks/${taskId}`)).json();
    expect(taskAfterApprove.status).toBe("ready");

    // Step 5: Agent checks approval status (simulated via API)
    const approvals = await (await fetch(`${API_BASE_URL}/api/approvals?taskId=${taskId}`)).json();
    expect(approvals).toHaveLength(1);
    expect(approvals[0].status).toBe("approved");

    // Step 6: Agent re-claims and completes task
    const reClaimed = await claimTask(taskId, TEST_AGENT_ID);
    expect(reClaimed.status).toBe("in_progress");

    const inReview = await updateTaskStatus(taskId, "review");
    expect(inReview.status).toBe("review");

    const done = await updateTaskStatus(taskId, "done");
    expect(done.status).toBe("done");

    // Step 7: Verify logs captured at each step
    const logs = await getTaskLogs(taskId);
    const logActions = logs.map((l) => l.action);

    // Should have: created, claimed, updated (to review), updated (to ready via approval),
    // claimed (re-claim), updated (to review), updated (to done)
    expect(logActions).toContain("created");
    expect(logActions).toContain("claimed");
    expect(logActions.filter((a) => a === "updated").length).toBeGreaterThanOrEqual(3);

    // Verify the approval-related log entries
    const approvalLogs = logs.filter((l) => {
      const details = l.details ? JSON.parse(l.details) : {};
      return details.approval_request_id || details.action;
    });
    expect(approvalLogs.length).toBeGreaterThanOrEqual(2); // request created + approved
  });

  it("denies approval and blocks task correctly", async () => {
    projectId = await createProject("Deny Test Project");
    const task = await createTask({
      projectId,
      agentId: TEST_AGENT_ID,
      title: "Task to be denied",
      taskType: "deployment",
      requiresApproval: true,
    });

    const taskId = task.id;

    // Claim and request approval
    await claimTask(taskId, TEST_AGENT_ID);
    const approval = await requestApproval(taskId, TEST_AGENT_ID, "Deploy v2");

    // Deny with notes
    const res = await fetch(`${API_BASE_URL}/api/approvals/${approval.id}/deny`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reviewedBy: REVIEWER_ID,
        notes: "Critical bug found in testing",
      }),
    });
    expect(res.status).toBe(200);
    const deniedApproval = await res.json();
    expect(deniedApproval.status).toBe("denied");
    expect(deniedApproval.notes).toBe("Critical bug found in testing");

    // Task should be in 'blocked' status after denial
    const taskAfterDeny = await (await fetch(`${API_BASE_URL}/api/tasks/${taskId}`)).json();
    expect(taskAfterDeny.status).toBe("blocked");

    // Logs should capture the denial
    const logs = await getTaskLogs(taskId);
    const approvalLogs = logs.filter((l) => {
      const details = l.details ? JSON.parse(l.details) : {};
      return details.action === "denied";
    });
    expect(approvalLogs.length).toBeGreaterThanOrEqual(1);
  });

  it("prevents double approval (409 conflict)", async () => {
    projectId = await createProject("Double Approval Project");
    const task = await createTask({
      projectId,
      agentId: TEST_AGENT_ID,
      title: "Double approval test",
      taskType: "deployment",
      requiresApproval: true,
    });

    await claimTask(task.id, TEST_AGENT_ID);
    const approval = await requestApproval(task.id, TEST_AGENT_ID, "First action");

    // First approve should succeed
    await approveRequest(approval.id, REVIEWER_ID);

    // Second approve should return 409
    const res = await fetch(`${API_BASE_URL}/api/approvals/${approval.id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reviewedBy: REVIEWER_ID }),
    });
    expect(res.status).toBe(409);
  });

  it("prevents approval request for task without requires_approval (400)", async () => {
    projectId = await createProject("No Approval Project");
    const task = await createTask({
      projectId,
      agentId: TEST_AGENT_ID,
      title: "No approval needed",
      taskType: "implementation",
      requiresApproval: false,
    });

    await claimTask(task.id, TEST_AGENT_ID);

    // Requesting approval should fail with 400
    const res = await fetch(`${API_BASE_URL}/api/approvals`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        taskId: task.id,
        agentId: TEST_AGENT_ID,
        actionRequested: "Some action",
      }),
    });
    expect(res.status).toBe(400);
  });
});
