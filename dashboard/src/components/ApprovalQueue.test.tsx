import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApprovalQueue } from "./ApprovalQueue";
import type { ApprovalRequest, Agent, Task } from "../lib/api-client";

// =============================================
// Mock data
// =============================================

const mockAgents: Agent[] = [
  {
    id: "agent-1",
    name: "Agent Alpha",
    createdAt: "2026-03-01T00:00:00.000Z",
    lastSeenAt: "2026-03-14T00:00:00.000Z",
  },
  {
    id: "agent-2",
    name: "Agent Beta",
    createdAt: "2026-03-02T00:00:00.000Z",
    lastSeenAt: "2026-03-14T00:00:00.000Z",
  },
];

const mockPendingApprovals: ApprovalRequest[] = [
  {
    id: "appr-1",
    taskId: "task-1",
    agentId: "agent-1",
    actionRequested: "Deploy to production",
    status: "pending",
    reviewedBy: null,
    reviewedAt: null,
    notes: null,
    createdAt: "2026-03-14T10:00:00.000Z",
  },
  {
    id: "appr-2",
    taskId: "task-2",
    agentId: "agent-2",
    actionRequested: "Approve database migration",
    status: "pending",
    reviewedBy: null,
    reviewedAt: null,
    notes: null,
    createdAt: "2026-03-14T11:30:00.000Z",
  },
];

const mockSinglePending: ApprovalRequest[] = [
  {
    id: "appr-1",
    taskId: "task-1",
    agentId: "agent-1",
    actionRequested: "Deploy to production",
    status: "pending",
    reviewedBy: null,
    reviewedAt: null,
    notes: null,
    createdAt: "2026-03-14T10:00:00.000Z",
  },
];

const mockTasks: Task[] = [
  {
    id: "task-1",
    projectId: "proj-1",
    agentId: "agent-1",
    title: "Deploy API service",
    description: "Deploy the API service to production",
    taskType: "deployment",
    requiresApproval: true,
    status: "review",
    createdAt: "2026-03-14T09:00:00.000Z",
    updatedAt: "2026-03-14T10:00:00.000Z",
    claimedAt: "2026-03-14T09:30:00.000Z",
  },
  {
    id: "task-2",
    projectId: "proj-1",
    agentId: "agent-2",
    title: "Run database migration",
    description: "Apply schema migration to production DB",
    taskType: "maintenance",
    requiresApproval: true,
    status: "review",
    createdAt: "2026-03-14T11:00:00.000Z",
    updatedAt: "2026-03-14T11:30:00.000Z",
    claimedAt: "2026-03-14T11:15:00.000Z",
  },
];

const mockApprovedApproval: ApprovalRequest = {
  ...mockPendingApprovals[0],
  status: "approved",
  reviewedBy: "reviewer-1",
  reviewedAt: "2026-03-14T12:00:00.000Z",
};

const mockDeniedApproval: ApprovalRequest = {
  ...mockPendingApprovals[0],
  status: "denied",
  reviewedBy: "reviewer-1",
  reviewedAt: "2026-03-14T12:00:00.000Z",
  notes: "Security review not passed",
};

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

const mockFetch = vi.fn();
const originalFetch = globalThis.fetch;

beforeEach(() => {
  mockFetch.mockReset();
  globalThis.fetch = mockFetch;
});

function mockApis(overrides?: {
  approvals?: ApprovalRequest[];
  agents?: Agent[];
  tasks?: Task[];
  approveResult?: ApprovalRequest;
  denyResult?: ApprovalRequest;
}) {
  const approvals = overrides?.approvals ?? mockPendingApprovals;
  const agents = overrides?.agents ?? mockAgents;
  const tasks = overrides?.tasks ?? mockTasks;

  mockFetch.mockImplementation((url: string, options?: RequestInit) => {
    // GET /api/approvals?status=pending
    if (url.includes("/api/approvals") && !options?.method) {
      const parsedUrl = new URL(url);
      const status = parsedUrl.searchParams.get("status");
      let filtered = approvals;
      if (status) {
        filtered = approvals.filter((a) => a.status === status);
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => filtered,
      });
    }

    // GET /api/agents
    if (url === "http://localhost:3200/api/agents" && !options?.method) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => agents,
      });
    }

    // GET /api/tasks
    if (url === "http://localhost:3200/api/tasks" && !options?.method) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => tasks,
      });
    }

    // POST /api/approvals/:id/approve
    if (url.includes("/approve") && options?.method === "POST") {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => overrides?.approveResult ?? mockApprovedApproval,
      });
    }

    // POST /api/approvals/:id/deny
    if (url.includes("/deny") && options?.method === "POST") {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => overrides?.denyResult ?? mockDeniedApproval,
      });
    }

    return Promise.resolve({
      ok: true,
      status: 200,
      json: async () => ({}),
    });
  });
}

function renderApprovalQueue() {
  const qc = createQueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <ApprovalQueue onBack={() => {}} />
    </QueryClientProvider>
  );
}

// =============================================
// Tests
// =============================================

describe("ApprovalQueue", () => {
  describe("Rendering", () => {
    it("renders the approval queue header", async () => {
      mockApis();
      renderApprovalQueue();
      expect(
        await screen.findByTestId("approval-queue-header")
      ).toBeInTheDocument();
    });

    it("renders the back button", async () => {
      mockApis();
      renderApprovalQueue();
      expect(
        await screen.findByTestId("back-to-board-button")
      ).toBeInTheDocument();
    });

    it("renders all pending approval requests", async () => {
      mockApis();
      renderApprovalQueue();
      expect(
        await screen.findByTestId("approval-item-appr-1")
      ).toBeInTheDocument();
      expect(
        await screen.findByTestId("approval-item-appr-2")
      ).toBeInTheDocument();
    });

    it("shows task title for each approval request", async () => {
      mockApis();
      renderApprovalQueue();
      expect(
        await screen.findByText("Deploy API service")
      ).toBeInTheDocument();
      expect(
        await screen.findByText("Run database migration")
      ).toBeInTheDocument();
    });

    it("shows agent name for each approval request", async () => {
      mockApis();
      renderApprovalQueue();
      expect(
        await screen.findByText("Agent Alpha")
      ).toBeInTheDocument();
      expect(
        await screen.findByText("Agent Beta")
      ).toBeInTheDocument();
    });

    it("shows action requested for each approval", async () => {
      mockApis();
      renderApprovalQueue();
      expect(
        await screen.findByText("Deploy to production")
      ).toBeInTheDocument();
      expect(
        await screen.findByText("Approve database migration")
      ).toBeInTheDocument();
    });

    it("shows timestamp for each approval request", async () => {
      mockApis();
      renderApprovalQueue();
      const timestamps = await screen.findAllByTestId("approval-timestamp");
      expect(timestamps.length).toBe(2);
    });

    it("shows pending count in header", async () => {
      mockApis();
      renderApprovalQueue();
      expect(
        await screen.findByTestId("pending-count")
      ).toHaveTextContent("2");
    });

    it("shows empty state when no pending approvals", async () => {
      mockApis({ approvals: [] });
      renderApprovalQueue();
      expect(
        await screen.findByTestId("empty-approvals-message")
      ).toBeInTheDocument();
    });

    it("shows loading state while fetching", () => {
      mockFetch.mockImplementation(() => new Promise(() => {}));
      renderApprovalQueue();
      expect(
        screen.getByTestId("approvals-loading")
      ).toBeInTheDocument();
    });

    it("shows error state when API fails", async () => {
      mockFetch.mockImplementation(() =>
        Promise.resolve({
          ok: false,
          status: 500,
          json: async () => ({ error: "Server error" }),
        })
      );
      renderApprovalQueue();
      expect(
        await screen.findByTestId("approvals-error")
      ).toBeInTheDocument();
    });
  });

  describe("Approve action", () => {
    it("renders approve button for each pending request", async () => {
      mockApis();
      renderApprovalQueue();
      const buttons = await screen.findAllByTestId(/approve-button/);
      expect(buttons.length).toBe(2);
    });

    it("calls approve API when approve button is clicked", async () => {
      mockApis();
      const user = userEvent.setup();
      renderApprovalQueue();

      const approveBtn = await screen.findByTestId("approve-button-appr-1");
      await user.click(approveBtn);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("/api/approvals/appr-1/approve"),
          expect.objectContaining({ method: "POST" })
        );
      });
    });

    it("shows success toast after approving", async () => {
      mockApis();
      const user = userEvent.setup();
      renderApprovalQueue();

      const approveBtn = await screen.findByTestId("approve-button-appr-1");
      await user.click(approveBtn);

      await waitFor(() => {
        expect(screen.getByText("Approval approved successfully")).toBeInTheDocument();
      });
    });

    it("removes approved item from the queue", async () => {
      let callCount = 0;
      mockFetch.mockImplementation((url: string, options?: RequestInit) => {
        // GET /api/approvals?status=pending - return empty after approve
        if (url.includes("/api/approvals") && !options?.method) {
          callCount++;
          if (callCount > 1) return Promise.resolve({ ok: true, status: 200, json: async () => [] });
          return Promise.resolve({ ok: true, status: 200, json: async () => mockSinglePending });
        }
        if (url.includes("/approve")) {
          return Promise.resolve({ ok: true, status: 200, json: async () => mockApprovedApproval });
        }
        if (url.includes("/api/agents")) {
          return Promise.resolve({ ok: true, status: 200, json: async () => mockAgents });
        }
        if (url.includes("/api/tasks")) {
          return Promise.resolve({ ok: true, status: 200, json: async () => mockTasks });
        }
        return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
      });
      const user = userEvent.setup();
      renderApprovalQueue();

      const approveBtn = await screen.findByTestId("approve-button-appr-1");
      await user.click(approveBtn);

      await waitFor(() => {
        expect(
          screen.queryByTestId("approval-item-appr-1")
        ).not.toBeInTheDocument();
      });
    });

    it("shows error toast when approve API fails", async () => {
      mockApis();
      mockFetch.mockImplementation((url: string, options?: RequestInit) => {
        if (url.includes("/approve")) {
          return Promise.resolve({
            ok: false,
            status: 409,
            json: async () => ({ error: "Already processed" }),
          });
        }
        // Default responses
        if (url.includes("/api/approvals") && !options?.method) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => mockPendingApprovals,
          });
        }
        if (url.includes("/api/agents")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => mockAgents,
          });
        }
        if (url.includes("/api/tasks")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => mockTasks,
          });
        }
        return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
      });

      const user = userEvent.setup();
      renderApprovalQueue();

      const approveBtn = await screen.findByTestId("approve-button-appr-1");
      await user.click(approveBtn);

      await waitFor(() => {
        expect(screen.getByText("Already processed")).toBeInTheDocument();
      });
    });
  });

  describe("Deny action", () => {
    it("renders deny button for each pending request", async () => {
      mockApis();
      renderApprovalQueue();
      const buttons = await screen.findAllByTestId(/deny-button/);
      expect(buttons.length).toBe(2);
    });

    it("shows notes textarea when deny button is clicked", async () => {
      mockApis();
      const user = userEvent.setup();
      renderApprovalQueue();

      const denyBtn = await screen.findByTestId("deny-button-appr-1");
      await user.click(denyBtn);

      expect(
        await screen.findByTestId("deny-notes-appr-1")
      ).toBeInTheDocument();
    });

    it("shows confirm deny button after clicking deny", async () => {
      mockApis();
      const user = userEvent.setup();
      renderApprovalQueue();

      const denyBtn = await screen.findByTestId("deny-button-appr-1");
      await user.click(denyBtn);

      expect(
        await screen.findByTestId("confirm-deny-button-appr-1")
      ).toBeInTheDocument();
    });

    it("calls deny API with notes when confirm deny is clicked", async () => {
      mockApis();
      const user = userEvent.setup();
      renderApprovalQueue();

      const denyBtn = await screen.findByTestId("deny-button-appr-1");
      await user.click(denyBtn);

      const notesInput = await screen.findByTestId("deny-notes-appr-1");
      await user.type(notesInput, "Needs more testing");

      const confirmBtn = await screen.findByTestId("confirm-deny-button-appr-1");
      await user.click(confirmBtn);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("/api/approvals/appr-1/deny"),
          expect.objectContaining({
            method: "POST",
          })
        );
      });

      // Verify notes were included in the request
      const callArgs = mockFetch.mock.calls.find(
        (call: [string, RequestInit]) => call[0].includes("/deny")
      );
      const body = JSON.parse(callArgs[1].body as string);
      expect(body.notes).toBe("Needs more testing");
    });

    it("shows validation error when denying without notes", async () => {
      mockApis();
      const user = userEvent.setup();
      renderApprovalQueue();

      const denyBtn = await screen.findByTestId("deny-button-appr-1");
      await user.click(denyBtn);

      const confirmBtn = await screen.findByTestId("confirm-deny-button-appr-1");
      await user.click(confirmBtn);

      expect(
        await screen.findByText("Notes are required when denying a request")
      ).toBeInTheDocument();
    });

    it("shows success toast after denying with notes", async () => {
      mockApis();
      const user = userEvent.setup();
      renderApprovalQueue();

      const denyBtn = await screen.findByTestId("deny-button-appr-1");
      await user.click(denyBtn);

      const notesInput = await screen.findByTestId("deny-notes-appr-1");
      await user.type(notesInput, "Security concerns");

      const confirmBtn = await screen.findByTestId("confirm-deny-button-appr-1");
      await user.click(confirmBtn);

      await waitFor(() => {
        expect(screen.getByText("Approval denied successfully")).toBeInTheDocument();
      });
    });

    it("removes denied item from the queue", async () => {
      let callCount = 0;
      mockFetch.mockImplementation((url: string, options?: RequestInit) => {
        // GET /api/approvals?status=pending - return empty after deny
        if (url.includes("/api/approvals") && !options?.method) {
          callCount++;
          if (callCount > 1) return Promise.resolve({ ok: true, status: 200, json: async () => [] });
          return Promise.resolve({ ok: true, status: 200, json: async () => mockSinglePending });
        }
        if (url.includes("/deny")) {
          return Promise.resolve({ ok: true, status: 200, json: async () => mockDeniedApproval });
        }
        if (url.includes("/api/agents")) {
          return Promise.resolve({ ok: true, status: 200, json: async () => mockAgents });
        }
        if (url.includes("/api/tasks")) {
          return Promise.resolve({ ok: true, status: 200, json: async () => mockTasks });
        }
        return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
      });
      const user = userEvent.setup();
      renderApprovalQueue();

      const denyBtn = await screen.findByTestId("deny-button-appr-1");
      await user.click(denyBtn);

      const notesInput = await screen.findByTestId("deny-notes-appr-1");
      await user.type(notesInput, "Needs work");

      const confirmBtn = await screen.findByTestId("confirm-deny-button-appr-1");
      await user.click(confirmBtn);

      await waitFor(() => {
        expect(
          screen.queryByTestId("approval-item-appr-1")
        ).not.toBeInTheDocument();
      });
    });

    it("shows cancel button to dismiss deny form", async () => {
      mockApis();
      const user = userEvent.setup();
      renderApprovalQueue();

      const denyBtn = await screen.findByTestId("deny-button-appr-1");
      await user.click(denyBtn);

      const cancelBtn = await screen.findByTestId("cancel-deny-button-appr-1");
      expect(cancelBtn).toBeInTheDocument();
    });

    it("hides notes textarea when cancel is clicked", async () => {
      mockApis();
      const user = userEvent.setup();
      renderApprovalQueue();

      const denyBtn = await screen.findByTestId("deny-button-appr-1");
      await user.click(denyBtn);

      const cancelBtn = await screen.findByTestId("cancel-deny-button-appr-1");
      await user.click(cancelBtn);

      await waitFor(() => {
        expect(
          screen.queryByTestId("deny-notes-appr-1")
        ).not.toBeInTheDocument();
      });
    });

    it("shows error toast when deny API fails", async () => {
      mockFetch.mockImplementation((url: string, options?: RequestInit) => {
        if (url.includes("/deny")) {
          return Promise.resolve({
            ok: false,
            status: 409,
            json: async () => ({ error: "Already processed" }),
          });
        }
        if (url.includes("/api/approvals") && !options?.method) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => mockPendingApprovals,
          });
        }
        if (url.includes("/api/agents")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => mockAgents,
          });
        }
        if (url.includes("/api/tasks")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => mockTasks,
          });
        }
        return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
      });

      const user = userEvent.setup();
      renderApprovalQueue();

      const denyBtn = await screen.findByTestId("deny-button-appr-1");
      await user.click(denyBtn);

      const notesInput = await screen.findByTestId("deny-notes-appr-1");
      await user.type(notesInput, "Test notes");

      const confirmBtn = await screen.findByTestId("confirm-deny-button-appr-1");
      await user.click(confirmBtn);

      await waitFor(() => {
        expect(screen.getByText("Already processed")).toBeInTheDocument();
      });
    });
  });

  describe("Back navigation", () => {
    it("calls onBack when back button is clicked", async () => {
      mockApis();
      const onBack = vi.fn();
      const qc = createQueryClient();
      render(
        <QueryClientProvider client={qc}>
          <ApprovalQueue onBack={onBack} />
        </QueryClientProvider>
      );

      const backBtn = await screen.findByTestId("back-to-board-button");
      fireEvent.click(backBtn);

      expect(onBack).toHaveBeenCalledTimes(1);
    });
  });

  describe("Accessibility", () => {
    it("has role='list' on the approval list container", async () => {
      mockApis();
      renderApprovalQueue();
      expect(
        await screen.findByRole("list")
      ).toBeInTheDocument();
    });

    it("has role='listitem' on each approval item", async () => {
      mockApis();
      renderApprovalQueue();
      const items = await screen.findAllByRole("listitem");
      expect(items.length).toBe(2);
    });

    it("approve button has aria-label", async () => {
      mockApis();
      renderApprovalQueue();
      const btn = await screen.findByTestId("approve-button-appr-1");
      expect(btn).toHaveAttribute("aria-label", "Approve request from Agent Alpha");
    });

    it("deny button has aria-label", async () => {
      mockApis();
      renderApprovalQueue();
      const btn = await screen.findByTestId("deny-button-appr-1");
      expect(btn).toHaveAttribute("aria-label", "Deny request from Agent Alpha");
    });

    it("back button has aria-label", async () => {
      mockApis();
      renderApprovalQueue();
      const btn = await screen.findByTestId("back-to-board-button");
      expect(btn).toHaveAttribute("aria-label", "Back to board");
    });
  });

  describe("Status updates reflected", () => {
    it("shows pending status badge", async () => {
      mockApis();
      renderApprovalQueue();
      const badges = await screen.findAllByText("Pending");
      expect(badges.length).toBe(2);
    });
  });
});
