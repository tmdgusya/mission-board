import { describe, it, expect } from "bun:test";
import React from "react";
import {
  isValidStatusTransition,
  getInvalidTransitionMessage,
  STATUS_LABELS,
  STATUS_COLORS,
  TASK_STATUSES,
  type TaskStatus,
} from "../lib/status-transitions";
import type { Task } from "../lib/api-client";

// =============================================
// Unit tests for status transition logic
// =============================================

describe("Status Transitions", () => {
  it("all 6 statuses are defined", () => {
    expect(TASK_STATUSES).toHaveLength(6);
    expect(TASK_STATUSES).toContain("backlog");
    expect(TASK_STATUSES).toContain("ready");
    expect(TASK_STATUSES).toContain("in_progress");
    expect(TASK_STATUSES).toContain("review");
    expect(TASK_STATUSES).toContain("done");
    expect(TASK_STATUSES).toContain("blocked");
  });

  it("each status has a label", () => {
    for (const status of TASK_STATUSES) {
      expect(STATUS_LABELS[status]).toBeTruthy();
      expect(typeof STATUS_LABELS[status]).toBe("string");
    }
  });

  it("each status has a unique color", () => {
    const colors = TASK_STATUSES.map((s) => STATUS_COLORS[s]);
    const uniqueColors = new Set(colors);
    expect(uniqueColors.size).toBe(colors.length);
  });

  it("backlog can only go to ready or blocked", () => {
    expect(isValidStatusTransition("backlog", "ready")).toBe(true);
    expect(isValidStatusTransition("backlog", "blocked")).toBe(true);
    expect(isValidStatusTransition("backlog", "in_progress")).toBe(false);
    expect(isValidStatusTransition("backlog", "review")).toBe(false);
    expect(isValidStatusTransition("backlog", "done")).toBe(false);
  });

  it("ready can go to backlog, in_progress, or blocked", () => {
    expect(isValidStatusTransition("ready", "backlog")).toBe(true);
    expect(isValidStatusTransition("ready", "in_progress")).toBe(true);
    expect(isValidStatusTransition("ready", "blocked")).toBe(true);
    expect(isValidStatusTransition("ready", "review")).toBe(false);
    expect(isValidStatusTransition("ready", "done")).toBe(false);
  });

  it("in_progress can go to ready, review, or blocked", () => {
    expect(isValidStatusTransition("in_progress", "ready")).toBe(true);
    expect(isValidStatusTransition("in_progress", "review")).toBe(true);
    expect(isValidStatusTransition("in_progress", "blocked")).toBe(true);
    expect(isValidStatusTransition("in_progress", "done")).toBe(false);
    expect(isValidStatusTransition("in_progress", "backlog")).toBe(false);
  });

  it("review can go to in_progress, done, or blocked", () => {
    expect(isValidStatusTransition("review", "in_progress")).toBe(true);
    expect(isValidStatusTransition("review", "done")).toBe(true);
    expect(isValidStatusTransition("review", "blocked")).toBe(true);
    expect(isValidStatusTransition("review", "backlog")).toBe(false);
    expect(isValidStatusTransition("review", "ready")).toBe(false);
  });

  it("done can go to review or blocked", () => {
    expect(isValidStatusTransition("done", "review")).toBe(true);
    expect(isValidStatusTransition("done", "blocked")).toBe(true);
    expect(isValidStatusTransition("done", "backlog")).toBe(false);
    expect(isValidStatusTransition("done", "ready")).toBe(false);
    expect(isValidStatusTransition("done", "in_progress")).toBe(false);
  });

  it("blocked can go to any status", () => {
    for (const status of TASK_STATUSES) {
      expect(isValidStatusTransition("blocked", status)).toBe(true);
    }
  });

  it("same status is always valid (no-op)", () => {
    for (const status of TASK_STATUSES) {
      expect(isValidStatusTransition(status, status)).toBe(true);
    }
  });

  it("invalid transition messages mention both source and target", () => {
    const msg = getInvalidTransitionMessage("backlog", "done");
    expect(msg).toContain("Backlog");
    expect(msg).toContain("Done");
  });

  it("invalid transition messages list valid transitions", () => {
    const msg = getInvalidTransitionMessage("backlog", "done");
    expect(msg).toContain("Ready");
    expect(msg).toContain("Blocked");
  });
});

// =============================================
// Column label verification
// =============================================

describe("Column Labels", () => {
  it("Backlog label is correct", () => {
    expect(STATUS_LABELS["backlog"]).toBe("Backlog");
  });
  it("Ready label is correct", () => {
    expect(STATUS_LABELS["ready"]).toBe("Ready");
  });
  it("In Progress label is correct", () => {
    expect(STATUS_LABELS["in_progress"]).toBe("In Progress");
  });
  it("Review label is correct", () => {
    expect(STATUS_LABELS["review"]).toBe("Review");
  });
  it("Done label is correct", () => {
    expect(STATUS_LABELS["done"]).toBe("Done");
  });
  it("Blocked label is correct", () => {
    expect(STATUS_LABELS["blocked"]).toBe("Blocked");
  });
});

// =============================================
// Task data grouping unit tests
// =============================================

describe("Task Grouping", () => {
  const mockTasks: Task[] = [
    {
      id: "task-1",
      projectId: "proj-1",
      agentId: null,
      title: "Design API schema",
      description: null,
      taskType: "implementation",
      requiresApproval: false,
      status: "backlog",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      claimedAt: null,
    },
    {
      id: "task-2",
      projectId: "proj-1",
      agentId: "agent-1",
      title: "Build endpoints",
      description: null,
      taskType: "implementation",
      requiresApproval: false,
      status: "in_progress",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      claimedAt: new Date().toISOString(),
    },
    {
      id: "task-3",
      projectId: "proj-1",
      agentId: "agent-2",
      title: "Write tests",
      description: null,
      taskType: "testing",
      requiresApproval: false,
      status: "review",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      claimedAt: new Date().toISOString(),
    },
    {
      id: "task-4",
      projectId: "proj-1",
      agentId: null,
      title: "Deploy to production",
      description: null,
      taskType: "deployment",
      requiresApproval: true,
      status: "blocked",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      claimedAt: null,
    },
    {
      id: "task-5",
      projectId: "proj-1",
      agentId: null,
      title: "Update docs",
      description: null,
      taskType: "documentation",
      requiresApproval: false,
      status: "done",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      claimedAt: null,
    },
    {
      id: "task-6",
      projectId: "proj-1",
      agentId: null,
      title: "Setup CI",
      description: null,
      taskType: "implementation",
      requiresApproval: false,
      status: "ready",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      claimedAt: null,
    },
  ];

  it("groups tasks by status correctly", () => {
    const tasksByStatus = new Map<TaskStatus, Task[]>();
    for (const status of TASK_STATUSES) {
      tasksByStatus.set(status, mockTasks.filter((t) => t.status === status));
    }
    expect(tasksByStatus.get("backlog")).toHaveLength(1);
    expect(tasksByStatus.get("ready")).toHaveLength(1);
    expect(tasksByStatus.get("in_progress")).toHaveLength(1);
    expect(tasksByStatus.get("review")).toHaveLength(1);
    expect(tasksByStatus.get("done")).toHaveLength(1);
    expect(tasksByStatus.get("blocked")).toHaveLength(1);
  });

  it("identifies unclaimed tasks (agentId is null)", () => {
    const unclaimed = mockTasks.filter((t) => !t.agentId);
    expect(unclaimed).toHaveLength(4);
  });

  it("identifies claimed tasks", () => {
    const claimed = mockTasks.filter((t) => t.agentId);
    expect(claimed).toHaveLength(2);
  });
});

// =============================================
// Droppable ID parsing (used by drag-and-drop)
// =============================================

describe("Droppable ID Parsing", () => {
  it("parses column status from droppable id", () => {
    for (const status of TASK_STATUSES) {
      const droppableId = `column-${status}`;
      const extracted = droppableId.replace("column-", "");
      expect(extracted).toBe(status);
    }
  });
});
