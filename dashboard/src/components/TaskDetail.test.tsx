import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TaskDetail } from "./TaskDetail";
import type { Task, TaskLog, Agent, Project } from "../lib/api-client";

// =============================================
// Mock data factories
// =============================================

function createMockTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-1",
    projectId: "proj-1",
    agentId: "agent-1",
    title: "Design API schema",
    description: "Create the initial API schema for the project including all endpoints and validation.",
    taskType: "implementation",
    requiresApproval: false,
    status: "in_progress",
    createdAt: "2026-03-13T10:00:00.000Z",
    updatedAt: "2026-03-13T12:00:00.000Z",
    claimedAt: "2026-03-13T11:00:00.000Z",
    ...overrides,
  };
}

function createMockLog(overrides: Partial<TaskLog> = {}): TaskLog {
  return {
    id: "log-1",
    taskId: "task-1",
    agentId: "agent-1",
    action: "created",
    details: { title: "Design API schema", task_type: "implementation" },
    reason: null,
    transcript: null,
    createdAt: "2026-03-13T10:00:00.000Z",
    ...overrides,
  };
}

const mockAgents: Agent[] = [
  {
    id: "agent-1",
    name: "Agent Alpha",
    createdAt: "2026-03-01T00:00:00.000Z",
    lastSeenAt: "2026-03-13T12:00:00.000Z",
  },
  {
    id: "agent-2",
    name: "Agent Beta",
    createdAt: "2026-03-02T00:00:00.000Z",
    lastSeenAt: "2026-03-13T11:00:00.000Z",
  },
];

const mockProjects: Project[] = [
  {
    id: "proj-1",
    name: "Mission Control",
    description: "Main mission control system",
    createdAt: "2026-03-01T00:00:00.000Z",
    updatedAt: "2026-03-13T00:00:00.000Z",
  },
];

// =============================================
// Test helpers
// =============================================

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

// Mock fetch for API calls
const mockFetch = vi.fn();

function renderTaskDetail(
  taskId: string | null,
  onClose: () => void,
  options?: {
    taskOverrides?: Partial<Task>;
    logs?: TaskLog[];
    fetchError?: boolean;
  }
) {
  const qc = createQueryClient();

  // Set up mock responses before rendering
  if (options?.fetchError) {
    mockFetch.mockRejectedValue(new Error("Network error"));
  } else {
    const task = createMockTask(options?.taskOverrides);
    const logs = options?.logs || [createMockLog()];

    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/api/tasks/") && !url.includes("/logs")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(task),
        });
      }
      if (url.includes("/api/logs")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(logs),
        });
      }
      if (url.includes("/api/agents")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockAgents),
        });
      }
      if (url.includes("/api/projects")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockProjects),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve([]),
      });
    });
  }

  const result = render(
    <QueryClientProvider client={qc}>
      <TaskDetail taskId={taskId} onClose={onClose} />
    </QueryClientProvider>
  );

  return result;
}

// =============================================
// Tests
// =============================================

describe("TaskDetail", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockClear();
  });

  describe("Rendering", () => {
    it("renders nothing when taskId is null", () => {
      const onClose = vi.fn();
      const { container } = renderTaskDetail(null, onClose);
      expect(container.innerHTML).toBe("");
    });

    it("renders loading state while fetching task", () => {
      // Keep fetch pending by not resolving it
      mockFetch.mockReturnValue(new Promise(() => {}));

      const onClose = vi.fn();
      renderTaskDetail("task-1", onClose);

      expect(screen.getByTestId("task-detail-loading")).toBeInTheDocument();
    });

    it("renders error state when fetch fails", async () => {
      const onClose = vi.fn();
      renderTaskDetail("task-1", onClose, { fetchError: true });

      expect(await screen.findByTestId("task-detail-error")).toBeInTheDocument();
      expect(screen.getByText("Error loading task")).toBeInTheDocument();
    });

    it("renders close button on error state", async () => {
      const onClose = vi.fn();
      renderTaskDetail("task-1", onClose, { fetchError: true });

      expect(await screen.findByTestId("task-detail-close-error")).toBeInTheDocument();
    });

    it("renders task title", async () => {
      const onClose = vi.fn();
      renderTaskDetail("task-1", onClose);

      await screen.findByTestId("task-detail-title");
      expect(screen.getByTestId("task-detail-title")).toHaveTextContent("Design API schema");
    });

    it("renders task description", async () => {
      const onClose = vi.fn();
      renderTaskDetail("task-1", onClose);

      await screen.findByTestId("task-detail-description");
      expect(screen.getByTestId("task-detail-description")).toHaveTextContent(
        "Create the initial API schema for the project including all endpoints and validation."
      );
    });

    it("renders 'No description provided' when description is null", async () => {
      const onClose = vi.fn();
      renderTaskDetail("task-1", onClose, {
        taskOverrides: { description: null },
      });

      await screen.findByTestId("task-detail-description");
      expect(screen.getByTestId("task-detail-description")).toHaveTextContent(
        "No description provided"
      );
    });

    it("renders status badge", async () => {
      const onClose = vi.fn();
      renderTaskDetail("task-1", onClose);

      await screen.findByTestId("task-detail-status");
      expect(screen.getByTestId("task-detail-status")).toHaveTextContent("In Progress");
    });

    it("renders task type badge", async () => {
      const onClose = vi.fn();
      renderTaskDetail("task-1", onClose);

      await screen.findByTestId("task-detail-type");
      expect(screen.getByTestId("task-detail-type")).toHaveTextContent("implementation");
    });

    it("renders approval required badge when requiresApproval is true", async () => {
      const onClose = vi.fn();
      renderTaskDetail("task-1", onClose, {
        taskOverrides: { requiresApproval: true },
      });

      await screen.findByTestId("task-detail-approval-required");
      expect(screen.getByTestId("task-detail-approval-required")).toHaveTextContent(
        "Approval Required"
      );
    });

    it("does not render approval badge when requiresApproval is false", async () => {
      const onClose = vi.fn();
      renderTaskDetail("task-1", onClose, {
        taskOverrides: { requiresApproval: false },
      });

      await screen.findByTestId("task-detail-title");
      expect(screen.queryByTestId("task-detail-approval-required")).not.toBeInTheDocument();
    });

    it("renders project name", async () => {
      const onClose = vi.fn();
      renderTaskDetail("task-1", onClose);

      await screen.findByTestId("task-detail-project");
      expect(screen.getByTestId("task-detail-project")).toHaveTextContent("Mission Control");
    });

    it("renders agent name for assigned task", async () => {
      const onClose = vi.fn();
      renderTaskDetail("task-1", onClose);

      await screen.findByTestId("task-detail-agent");
      expect(screen.getByTestId("task-detail-agent")).toHaveTextContent("Agent Alpha");
    });

    it("renders 'Unclaimed' for tasks without agent", async () => {
      const onClose = vi.fn();
      renderTaskDetail("task-1", onClose, {
        taskOverrides: { agentId: null },
      });

      await screen.findByTestId("task-detail-agent");
      expect(screen.getByTestId("task-detail-agent")).toHaveTextContent("Unclaimed");
    });

    it("renders timestamps", async () => {
      const onClose = vi.fn();
      renderTaskDetail("task-1", onClose);

      await screen.findByTestId("task-detail-created");
      expect(screen.getByTestId("task-detail-created")).toBeInTheDocument();

      expect(screen.getByTestId("task-detail-updated")).toBeInTheDocument();
      expect(screen.getByTestId("task-detail-claimed")).toBeInTheDocument();
    });

    it("renders '—' for null claimedAt", async () => {
      const onClose = vi.fn();
      renderTaskDetail("task-1", onClose, {
        taskOverrides: { claimedAt: null },
      });

      await screen.findByTestId("task-detail-claimed");
      expect(screen.getByTestId("task-detail-claimed")).toHaveTextContent("—");
    });

    it("renders task ID", async () => {
      const onClose = vi.fn();
      renderTaskDetail("task-1", onClose, {
        taskOverrides: { id: "custom-id-123" },
      });

      await screen.findByTestId("task-detail-id");
      expect(screen.getByTestId("task-detail-id")).toHaveTextContent("custom-id-123");
    });
  });

  describe("Activity History", () => {
    it("renders activity log entries", async () => {
      const logs = [
        createMockLog({
          id: "log-1",
          action: "created",
          createdAt: "2026-03-13T10:00:00.000Z",
        }),
        createMockLog({
          id: "log-2",
          action: "claimed",
          createdAt: "2026-03-13T11:00:00.000Z",
        }),
        createMockLog({
          id: "log-3",
          action: "updated",
          details: {
            field_changes: [
              { field: "status", old_value: "backlog", new_value: "in_progress" },
            ],
          },
          createdAt: "2026-03-13T12:00:00.000Z",
        }),
      ];
      const onClose = vi.fn();
      renderTaskDetail("task-1", onClose, { logs });

      await screen.findByTestId("activity-history-list");
      expect(screen.getByText("Created")).toBeInTheDocument();
      expect(screen.getByText("Claimed")).toBeInTheDocument();
      expect(screen.getByText("Updated")).toBeInTheDocument();
    });

    it("renders log entries with reasoning", async () => {
      const logs = [
        createMockLog({
          id: "log-1",
          action: "claimed",
          reason: "Matched my specialization",
          transcript: [
            { step: 1, thought: "Analyzed requirements" },
            { step: 2, thought: "Decided to claim" },
          ],
          createdAt: "2026-03-13T11:00:00.000Z",
        }),
      ];
      const onClose = vi.fn();
      renderTaskDetail("task-1", onClose, { logs });

      // Wait for the component to render (the timeline fetches logs via useLogs)
      await vi.waitFor(() => {
        // Reason is rendered wrapped in curly quotes: &quot;...&quot;
        expect(screen.queryByText(/Matched my specialization/)).toBeTruthy();
      }, { timeout: 3000 });
      expect(screen.queryByText("No agent reasoning available")).toBeFalsy();
    });

    it("renders empty state when no logs", async () => {
      const onClose = vi.fn();
      renderTaskDetail("task-1", onClose, { logs: [] });

      await screen.findByTestId("activity-history-empty");
      expect(screen.getByTestId("activity-history-empty")).toHaveTextContent(
        "No activity recorded"
      );
    });

    it("renders entries without reasoning", async () => {
      const logs = [
        createMockLog({
          id: "log-1",
          action: "created",
          createdAt: "2026-03-13T10:00:00.000Z",
        }),
      ];
      const onClose = vi.fn();
      renderTaskDetail("task-1", onClose, { logs });

      await screen.findByText("No agent reasoning available");
    });
  });

  describe("Edit Mode", () => {
    it("renders Edit and Delete buttons", async () => {
      const onClose = vi.fn();
      renderTaskDetail("task-1", onClose);

      await screen.findByTestId("edit-button");
      expect(screen.getByTestId("edit-button")).toBeInTheDocument();
      expect(screen.getByTestId("delete-button")).toBeInTheDocument();
    });

    it("enters edit mode when Edit button is clicked", async () => {
      const onClose = vi.fn();
      const user = userEvent.setup();
      renderTaskDetail("task-1", onClose);

      await screen.findByTestId("edit-button");
      await user.click(screen.getByTestId("edit-button"));

      expect(screen.getByTestId("edit-title-input")).toBeInTheDocument();
      expect(screen.getByTestId("edit-description-input")).toBeInTheDocument();
      expect(screen.getByTestId("edit-cancel")).toBeInTheDocument();
      expect(screen.getByTestId("edit-save")).toBeInTheDocument();
    });

    it("pre-fills edit fields with current values", async () => {
      const onClose = vi.fn();
      const user = userEvent.setup();
      renderTaskDetail("task-1", onClose, {
        taskOverrides: {
          title: "My Task",
          description: "My Description",
        },
      });

      await screen.findByTestId("edit-button");
      await user.click(screen.getByTestId("edit-button"));

      const titleInput = screen.getByTestId("edit-title-input") as HTMLInputElement;
      expect(titleInput.value).toBe("My Task");

      const descInput = screen.getByTestId("edit-description-input") as HTMLTextAreaElement;
      expect(descInput.value).toBe("My Description");
    });

    it("cancels edit mode when Cancel is clicked", async () => {
      const onClose = vi.fn();
      const user = userEvent.setup();
      renderTaskDetail("task-1", onClose);

      await screen.findByTestId("edit-button");
      await user.click(screen.getByTestId("edit-button"));

      await user.click(screen.getByTestId("edit-cancel"));
      expect(screen.queryByTestId("edit-title-input")).not.toBeInTheDocument();
    });

    it("renders Save Changes button in edit mode", async () => {
      const onClose = vi.fn();
      const user = userEvent.setup();
      renderTaskDetail("task-1", onClose);

      await screen.findByTestId("edit-button");
      await user.click(screen.getByTestId("edit-button"));

      expect(screen.getByTestId("edit-save")).toHaveTextContent("Save Changes");
    });
  });

  describe("Delete", () => {
    it("shows delete confirmation when Delete button is clicked", async () => {
      const onClose = vi.fn();
      const user = userEvent.setup();
      renderTaskDetail("task-1", onClose);

      await screen.findByTestId("delete-button");
      await user.click(screen.getByTestId("delete-button"));

      expect(screen.getByTestId("delete-confirmation")).toBeInTheDocument();
      expect(screen.getByText(/Are you sure you want to delete/)).toBeInTheDocument();
    });

    it("hides delete confirmation when Cancel is clicked", async () => {
      const onClose = vi.fn();
      const user = userEvent.setup();
      renderTaskDetail("task-1", onClose);

      await screen.findByTestId("delete-button");
      await user.click(screen.getByTestId("delete-button"));

      await user.click(screen.getByTestId("delete-cancel"));
      expect(screen.queryByTestId("delete-confirmation")).not.toBeInTheDocument();
    });

    it("renders Delete Task button in confirmation", async () => {
      const onClose = vi.fn();
      const user = userEvent.setup();
      renderTaskDetail("task-1", onClose);

      await screen.findByTestId("delete-button");
      await user.click(screen.getByTestId("delete-button"));

      expect(screen.getByTestId("delete-confirm")).toHaveTextContent("Delete Task");
    });
  });

  describe("Close Behavior", () => {
    it("calls onClose when close button is clicked", async () => {
      const onClose = vi.fn();
      const user = userEvent.setup();
      renderTaskDetail("task-1", onClose);

      await screen.findByTestId("task-detail-close");
      await user.click(screen.getByTestId("task-detail-close"));

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("calls onClose when close button on error state is clicked", async () => {
      const onClose = vi.fn();
      const user = userEvent.setup();
      renderTaskDetail("task-1", onClose, { fetchError: true });

      await screen.findByTestId("task-detail-close-error");
      await user.click(screen.getByTestId("task-detail-close-error"));

      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe("Accessibility", () => {
    it("has role=dialog on modal", async () => {
      const onClose = vi.fn();
      renderTaskDetail("task-1", onClose);

      await screen.findByTestId("task-detail-modal");
      expect(screen.getByTestId("task-detail-modal")).toHaveAttribute("role", "dialog");
    });

    it("has aria-modal=true on modal", async () => {
      const onClose = vi.fn();
      renderTaskDetail("task-1", onClose);

      await screen.findByTestId("task-detail-modal");
      expect(screen.getByTestId("task-detail-modal")).toHaveAttribute(
        "aria-modal",
        "true"
      );
    });

    it("close button has aria-label", async () => {
      const onClose = vi.fn();
      renderTaskDetail("task-1", onClose);

      await screen.findByTestId("task-detail-close");
      expect(screen.getByTestId("task-detail-close")).toHaveAttribute(
        "aria-label",
        "Close"
      );
    });
  });

  describe("Various Status Display", () => {
    const statuses = [
      { status: "backlog", label: "Backlog" },
      { status: "ready", label: "Ready" },
      { status: "in_progress", label: "In Progress" },
      { status: "review", label: "Review" },
      { status: "done", label: "Done" },
      { status: "blocked", label: "Blocked" },
    ];

    for (const { status, label } of statuses) {
      it(`renders ${label} status badge correctly`, async () => {
        const onClose = vi.fn();
        renderTaskDetail("task-1", onClose, {
          taskOverrides: { status: status as Task["status"] },
        });

        await screen.findByTestId("task-detail-status");
        expect(screen.getByTestId("task-detail-status")).toHaveTextContent(label);
      });
    }
  });
});
