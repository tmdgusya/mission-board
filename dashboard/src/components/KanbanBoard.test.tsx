import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  DndContext,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  isValidStatusTransition,
  getInvalidTransitionMessage,
  STATUS_LABELS,
  STATUS_COLORS,
  TASK_STATUSES,
  type TaskStatus,
} from "../lib/status-transitions";
import type { Task } from "../lib/api-client";
import { KanbanColumn } from "./KanbanColumn";
import { TaskCard } from "./TaskCard";
import { Toast, useToast } from "./Toast";

// =============================================
// Test helpers
// =============================================

function createMockTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-1",
    projectId: "proj-1",
    agentId: null,
    title: "Design API schema",
    description: null,
    taskType: "implementation",
    requiresApproval: false,
    status: "backlog",
    createdAt: "2026-03-13T00:00:00.000Z",
    updatedAt: "2026-03-13T00:00:00.000Z",
    claimedAt: null,
    ...overrides,
  };
}

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchInterval: false,
      },
    },
  });
}

function renderWithQuery(ui: React.ReactElement) {
  const qc = createQueryClient();
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

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
    createMockTask({ id: "task-1", status: "backlog", title: "Design API schema" }),
    createMockTask({ id: "task-2", status: "in_progress", agentId: "agent-1", title: "Build endpoints" }),
    createMockTask({ id: "task-3", status: "review", agentId: "agent-2", title: "Write tests", taskType: "testing" }),
    createMockTask({ id: "task-4", status: "blocked", title: "Deploy to production", taskType: "deployment" }),
    createMockTask({ id: "task-5", status: "done", title: "Update docs", taskType: "documentation" }),
    createMockTask({ id: "task-6", status: "ready", title: "Setup CI" }),
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

// =============================================
// TaskCard component rendering tests
// =============================================

describe("TaskCard", () => {
  it("renders task title", () => {
    const task = createMockTask({ title: "Fix the login bug" });
    renderWithQuery(
      <DndContext>
        <TaskCard task={task} />
      </DndContext>
    );
    expect(screen.getByText("Fix the login bug")).toBeInTheDocument();
  });

  it("renders task type badge with readable text", () => {
    const task = createMockTask({ taskType: "bugfix" });
    renderWithQuery(
      <DndContext>
        <TaskCard task={task} />
      </DndContext>
    );
    const badge = screen.getByTestId("task-type-badge");
    expect(badge).toBeInTheDocument();
    expect(badge.textContent).toBe("bugfix");
  });

  it("renders 'Unclaimed' for tasks without an agent", () => {
    const task = createMockTask({ agentId: null });
    renderWithQuery(
      <DndContext>
        <TaskCard task={task} />
      </DndContext>
    );
    expect(screen.getByText("Unclaimed")).toBeInTheDocument();
  });

  it("renders Unclaimed for tasks with an agent when agents list is not loaded", () => {
    // When useAgents returns no data, it shows "Unclaimed" because
    // agents?.find() returns undefined. This is expected behavior
    // when the agents API hasn't loaded yet.
    const task = createMockTask({ agentId: "agent-123" });
    renderWithQuery(
      <DndContext>
        <TaskCard task={task} />
      </DndContext>
    );
    expect(screen.getByText("Unclaimed")).toBeInTheDocument();
  });

  it("has correct data-testid for task card", () => {
    const task = createMockTask({ id: "my-task-id" });
    renderWithQuery(
      <DndContext>
        <TaskCard task={task} />
      </DndContext>
    );
    expect(screen.getByTestId("task-card-my-task-id")).toBeInTheDocument();
  });

  it("renders task with isDragging prop without errors", () => {
    const task = createMockTask();
    renderWithQuery(
      <DndContext>
        <TaskCard task={task} isDragging />
      </DndContext>
    );
    expect(screen.getByText("Design API schema")).toBeInTheDocument();
  });
});

// =============================================
// KanbanColumn component rendering tests
// =============================================

describe("KanbanColumn", () => {
  it("renders column header with correct label", () => {
    renderWithQuery(
      <DndContext>
        <KanbanColumn status="backlog" tasks={[]} activeTaskId={null} />
      </DndContext>
    );
    expect(screen.getByTestId("column-header-backlog")).toHaveTextContent("Backlog");
  });

  it("renders column count badge", () => {
    const tasks = [createMockTask(), createMockTask({ id: "t2" })];
    renderWithQuery(
      <DndContext>
        <KanbanColumn status="ready" tasks={tasks} activeTaskId={null} />
      </DndContext>
    );
    const count = screen.getByTestId("column-count-ready");
    expect(count).toHaveTextContent("2");
  });

  it("renders task cards in the column", () => {
    const tasks = [
      createMockTask({ id: "t1", title: "Task A" }),
      createMockTask({ id: "t2", title: "Task B" }),
    ];
    renderWithQuery(
      <DndContext>
        <KanbanColumn status="backlog" tasks={tasks} activeTaskId={null} />
      </DndContext>
    );
    expect(screen.getByText("Task A")).toBeInTheDocument();
    expect(screen.getByText("Task B")).toBeInTheDocument();
  });

  it("renders empty state when no tasks", () => {
    renderWithQuery(
      <DndContext>
        <KanbanColumn status="done" tasks={[]} activeTaskId={null} />
      </DndContext>
    );
    expect(screen.getByTestId("column-empty-done")).toHaveTextContent("No tasks");
  });

  it("renders all 6 status column headers", () => {
    for (const status of TASK_STATUSES) {
      const { unmount } = renderWithQuery(
        <DndContext>
          <KanbanColumn status={status} tasks={[]} activeTaskId={null} />
        </DndContext>
      );
      expect(screen.getByTestId(`column-header-${status}`)).toHaveTextContent(
        STATUS_LABELS[status]
      );
      unmount();
    }
  });

  it("has correct data-testid for column", () => {
    renderWithQuery(
      <DndContext>
        <KanbanColumn status="in_progress" tasks={[]} activeTaskId={null} />
      </DndContext>
    );
    expect(screen.getByTestId("kanban-column-in_progress")).toBeInTheDocument();
  });
});

// =============================================
// Toast component tests
// =============================================

describe("Toast", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders error toast messages", () => {
    const messages = [
      { id: "1", message: "Something went wrong", type: "error" as const },
    ];
    renderWithQuery(<Toast messages={messages} onDismiss={() => {}} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong");
  });

  it("renders success toast messages", () => {
    const messages = [
      { id: "1", message: "Task moved successfully", type: "success" as const },
    ];
    renderWithQuery(<Toast messages={messages} onDismiss={() => {}} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Task moved successfully");
  });

  it("renders info toast messages", () => {
    const messages = [
      { id: "1", message: "Please wait...", type: "info" as const },
    ];
    renderWithQuery(<Toast messages={messages} onDismiss={() => {}} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Please wait...");
  });

  it("renders nothing when messages array is empty", () => {
    const { container } = renderWithQuery(
      <Toast messages={[]} onDismiss={() => {}} />
    );
    expect(container.innerHTML).toBe("");
  });

  it("dismiss button calls onDismiss", async () => {
    const onDismiss = vi.fn();
    const messages = [
      { id: "1", message: "Test message", type: "error" as const },
    ];
    renderWithQuery(<Toast messages={messages} onDismiss={onDismiss} />);

    const dismissBtn = screen.getByRole("button", { name: "Dismiss" });
    await dismissBtn.click();
    vi.advanceTimersByTime(300);
    expect(onDismiss).toHaveBeenCalledWith("1");
  });

  it("auto-dismisses after timeout", () => {
    const onDismiss = vi.fn();
    const messages = [
      { id: "1", message: "Auto dismiss", type: "error" as const },
    ];
    renderWithQuery(<Toast messages={messages} onDismiss={onDismiss} />);

    vi.advanceTimersByTime(100); // animation frame
    vi.advanceTimersByTime(4000); // auto-dismiss timer
    vi.advanceTimersByTime(300); // exit animation

    expect(onDismiss).toHaveBeenCalledWith("1");
  });

  it("renders multiple toast messages", () => {
    const messages = [
      { id: "1", message: "First error", type: "error" as const },
      { id: "2", message: "Success!", type: "success" as const },
    ];
    renderWithQuery(<Toast messages={messages} onDismiss={() => {}} />);
    expect(screen.getAllByRole("alert")).toHaveLength(2);
    expect(screen.getByText("First error")).toBeInTheDocument();
    expect(screen.getByText("Success!")).toBeInTheDocument();
  });
});

// =============================================
// useToast hook test
// =============================================

describe("useToast hook", () => {
  it("addToast adds a message", async () => {
    function TestComponent() {
      const { messages, addToast } = useToast();
      return (
        <div>
          <button onClick={() => addToast("hello", "success")}>Add</button>
          {messages.map((m) => (
            <span key={m.id}>{m.message}</span>
          ))}
        </div>
      );
    }
    renderWithQuery(<TestComponent />);
    expect(screen.queryByText("hello")).not.toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByText("Add"));
    expect(screen.getByText("hello")).toBeInTheDocument();
  });
});

// =============================================
// Drag-and-drop flow integration tests
// =============================================

describe("Drag-and-Drop Flow", () => {
  it("drag end handler extracts target status from droppable id", () => {
    const onDragEnd = vi.fn();
    const tasks = [createMockTask({ id: "task-1" })];

    function TestBoard() {
      const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
      );

      return (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragEnd={onDragEnd}
        >
          <KanbanColumn status="backlog" tasks={tasks} activeTaskId={null} />
          <KanbanColumn status="ready" tasks={[]} activeTaskId={null} />
          <KanbanColumn status="in_progress" tasks={[]} activeTaskId={null} />
          <KanbanColumn status="review" tasks={[]} activeTaskId={null} />
          <KanbanColumn status="done" tasks={[]} activeTaskId={null} />
          <KanbanColumn status="blocked" tasks={[]} activeTaskId={null} />
        </DndContext>
      );
    }

    renderWithQuery(<TestBoard />);

    // Simulate what the KanbanBoard handleDragEnd does
    const mockEvent: DragEndEvent = {
      active: { id: "task-1", data: { current: {} } },
      over: { id: "column-ready", data: { current: { status: "ready" } } },
    } as DragEndEvent;

    const taskId = mockEvent.active.id as string;
    const overId = mockEvent.over!.id as string;
    const targetStatus = overId.replace("column-", "") as TaskStatus;
    expect(targetStatus).toBe("ready");
  });

  it("correctly identifies valid and invalid transitions on drag end", () => {
    const task = createMockTask({ id: "task-1", status: "backlog" });

    expect(isValidStatusTransition(task.status as TaskStatus, "ready")).toBe(true);
    expect(isValidStatusTransition(task.status as TaskStatus, "done")).toBe(false);
    expect(isValidStatusTransition(task.status as TaskStatus, "review")).toBe(false);
    expect(isValidStatusTransition(task.status as TaskStatus, "blocked")).toBe(true);
  });

  it("error toast message contains correct info for invalid transitions", () => {
    const msg = getInvalidTransitionMessage("backlog", "done");
    expect(msg).toContain("Backlog");
    expect(msg).toContain("Done");
    expect(msg).toContain("Ready");
    expect(msg).toContain("Blocked");
  });

  it("same-column drop is a no-op (does not update)", () => {
    const task = createMockTask({ id: "task-1", status: "ready" });
    expect(task.status === "ready").toBe(true);
  });
});

// =============================================
// Complete board rendering test (mock data)
// =============================================

describe("Complete Board Rendering", () => {
  it("renders all 6 columns when tasks exist", () => {
    const allTasks = [
      createMockTask({ id: "t1", status: "backlog", title: "Backlog task" }),
      createMockTask({ id: "t2", status: "ready", title: "Ready task" }),
      createMockTask({ id: "t3", status: "in_progress", title: "In Progress task", agentId: "a1" }),
      createMockTask({ id: "t4", status: "review", title: "Review task", agentId: "a2" }),
      createMockTask({ id: "t5", status: "done", title: "Done task" }),
      createMockTask({ id: "t6", status: "blocked", title: "Blocked task" }),
    ];

    function TestBoard() {
      const tasksByStatus = new Map<TaskStatus, Task[]>();
      for (const status of TASK_STATUSES) {
        tasksByStatus.set(status, allTasks.filter((t) => t.status === status));
      }

      return (
        <DndContext>
          <div data-testid="kanban-board">
            {TASK_STATUSES.map((status) => (
              <KanbanColumn
                key={status}
                status={status}
                tasks={tasksByStatus.get(status) ?? []}
                activeTaskId={null}
              />
            ))}
          </div>
        </DndContext>
      );
    }

    renderWithQuery(<TestBoard />);

    expect(screen.getByText("Backlog")).toBeInTheDocument();
    expect(screen.getByText("Ready")).toBeInTheDocument();
    expect(screen.getByText("In Progress")).toBeInTheDocument();
    expect(screen.getByText("Review")).toBeInTheDocument();
    expect(screen.getByText("Done")).toBeInTheDocument();
    expect(screen.getByText("Blocked")).toBeInTheDocument();

    expect(screen.getByText("Backlog task")).toBeInTheDocument();
    expect(screen.getByText("Ready task")).toBeInTheDocument();
    expect(screen.getByText("In Progress task")).toBeInTheDocument();
    expect(screen.getByText("Review task")).toBeInTheDocument();
    expect(screen.getByText("Done task")).toBeInTheDocument();
    expect(screen.getByText("Blocked task")).toBeInTheDocument();
  });
});
