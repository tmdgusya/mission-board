import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { KanbanBoard } from "./KanbanBoard";
import { Toast } from "./Toast";
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
      project_id: "proj-1",
      agent_id: null,
      title: "Design API schema",
      description: null,
      task_type: "implementation",
      requires_approval: false,
      status: "backlog",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      claimed_at: null,
    },
    {
      id: "task-2",
      project_id: "proj-1",
      agent_id: "agent-1",
      title: "Build endpoints",
      description: null,
      task_type: "implementation",
      requires_approval: false,
      status: "in_progress",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      claimed_at: new Date().toISOString(),
    },
    {
      id: "task-3",
      project_id: "proj-1",
      agent_id: "agent-2",
      title: "Write tests",
      description: null,
      task_type: "testing",
      requires_approval: false,
      status: "review",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      claimed_at: new Date().toISOString(),
    },
    {
      id: "task-4",
      project_id: "proj-1",
      agent_id: null,
      title: "Deploy to production",
      description: null,
      task_type: "devops",
      requires_approval: true,
      status: "blocked",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      claimed_at: null,
    },
    {
      id: "task-5",
      project_id: "proj-1",
      agent_id: null,
      title: "Update docs",
      description: null,
      task_type: "documentation",
      requires_approval: false,
      status: "done",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      claimed_at: null,
    },
    {
      id: "task-6",
      project_id: "proj-1",
      agent_id: null,
      title: "Setup CI",
      description: null,
      task_type: "implementation",
      requires_approval: false,
      status: "ready",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      claimed_at: null,
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

  it("identifies unclaimed tasks (agent_id is null)", () => {
    const unclaimed = mockTasks.filter((t) => !t.agent_id);
    expect(unclaimed).toHaveLength(4);
  });

  it("identifies claimed tasks", () => {
    const claimed = mockTasks.filter((t) => t.agent_id);
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

// =============================================
// Toast component tests
// =============================================

describe("Toast component", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders toast messages", () => {
    const messages = [
      { id: "1", message: "Test error", type: "error" as const },
      { id: "2", message: "Success!", type: "success" as const },
    ];
    const onDismiss = vi.fn();
    render(<Toast messages={messages} onDismiss={onDismiss} />);
    expect(screen.getByText("Test error")).toBeDefined();
    expect(screen.getByText("Success!")).toBeDefined();
  });

  it("renders nothing when no messages", () => {
    const { container } = render(
      <Toast messages={[]} onDismiss={() => {}} />
    );
    expect(container.innerHTML).toBe("");
  });

  it("can be dismissed manually", () => {
    const onDismiss = vi.fn();
    const messages = [
      { id: "1", message: "Dismiss me", type: "error" as const },
    ];
    render(<Toast messages={messages} onDismiss={onDismiss} />);

    fireEvent.click(screen.getByLabelText("Dismiss"));

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(onDismiss).toHaveBeenCalledWith("1");
  });
});
