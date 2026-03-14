import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Analytics } from "./Analytics";
import type { AgentStat, TaskMetrics, TimeTrackingMetrics, Agent, Project } from "../lib/api-client";

// =============================================
// Mock data
// =============================================

const mockProjects: Project[] = [
  {
    id: "proj-1",
    name: "Project Alpha",
    description: "Alpha project",
    createdAt: "2026-03-01T00:00:00.000Z",
    updatedAt: "2026-03-14T00:00:00.000Z",
  },
  {
    id: "proj-2",
    name: "Project Beta",
    description: "Beta project",
    createdAt: "2026-03-02T00:00:00.000Z",
    updatedAt: "2026-03-14T00:00:00.000Z",
  },
];

const mockAgentStats: AgentStat[] = [
  {
    agentId: "agent-1",
    agentName: "Agent Alpha",
    tasksCompleted: 15,
    tasksInProgress: 3,
    totalTasks: 20,
    avgCompletionTimeMs: 3600000, // 1 hour
    successRate: 88.5,
  },
  {
    agentId: "agent-2",
    agentName: "Agent Beta",
    tasksCompleted: 8,
    tasksInProgress: 2,
    totalTasks: 12,
    avgCompletionTimeMs: 7200000, // 2 hours
    successRate: 72.0,
  },
  {
    agentId: "agent-3",
    agentName: "Agent Gamma",
    tasksCompleted: 0,
    tasksInProgress: 5,
    totalTasks: 5,
    avgCompletionTimeMs: null,
    successRate: null,
  },
];

const mockTaskMetrics: TaskMetrics = {
  totalTasks: 37,
  statusCounts: {
    backlog: 8,
    ready: 5,
    in_progress: 10,
    review: 4,
    done: 23,
    blocked: 2,
  },
  completionRate: 62.2,
  avgTimeToCompletionMs: 5400000, // 1.5 hours
};

const mockTimeTracking: TimeTrackingMetrics = {
  avgCreatedToClaimedMs: 1800000, // 30 minutes
  avgClaimedToCompletedMs: 3600000, // 1 hour
  tasksWithClaimData: 30,
  tasksWithCompletionData: 23,
};

const mockAgentStatsEmpty: AgentStat[] = [];

const mockTaskMetricsEmpty: TaskMetrics = {
  totalTasks: 0,
  statusCounts: {
    backlog: 0,
    ready: 0,
    in_progress: 0,
    review: 0,
    done: 0,
    blocked: 0,
  },
  completionRate: 0,
  avgTimeToCompletionMs: null,
};

const mockTimeTrackingEmpty: TimeTrackingMetrics = {
  avgCreatedToClaimedMs: null,
  avgClaimedToCompletedMs: null,
  tasksWithClaimData: 0,
  tasksWithCompletionData: 0,
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

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function mockAnalyticsApis(overrides?: {
  agentStats?: AgentStat[];
  taskMetrics?: TaskMetrics;
  timeTracking?: TimeTrackingMetrics;
  projects?: Project[];
  fail?: boolean;
}) {
  const agentStats = overrides?.agentStats ?? mockAgentStats;
  const taskMetrics = overrides?.taskMetrics ?? mockTaskMetrics;
  const timeTracking = overrides?.timeTracking ?? mockTimeTracking;
  const projects = overrides?.projects ?? mockProjects;

  mockFetch.mockImplementation((url: string, options?: RequestInit) => {
    if (overrides?.fail) {
      return Promise.resolve({
        ok: false,
        status: 500,
        json: async () => ({ error: "Internal server error" }),
      });
    }

    // GET /api/analytics/agents
    if (url.includes("/api/analytics/agents") && !options?.method) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => agentStats,
      });
    }

    // GET /api/analytics/tasks
    if (url.includes("/api/analytics/tasks") && !options?.method) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => taskMetrics,
      });
    }

    // GET /api/analytics/time-tracking
    if (url.includes("/api/analytics/time-tracking") && !options?.method) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => timeTracking,
      });
    }

    // GET /api/projects
    if (url.includes("/api/projects") && !options?.method && !url.includes("/api/projects/")) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => projects,
      });
    }

    return Promise.resolve({
      ok: true,
      status: 200,
      json: async () => ({}),
    });
  });
}

function renderAnalytics() {
  const qc = createQueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <Analytics onBack={() => {}} />
    </QueryClientProvider>
  );
}

// =============================================
// Tests
// =============================================

describe("Analytics Page", () => {
  describe("Rendering", () => {
    it("renders the analytics page header", async () => {
      mockAnalyticsApis();
      renderAnalytics();

      expect(screen.getByTestId("analytics-page-header")).toHaveTextContent("Analytics");
      expect(screen.getByTestId("back-to-board-button")).toHaveTextContent("← Back");
    });

    it("renders the analytics page container", async () => {
      mockAnalyticsApis();
      renderAnalytics();

      // Initially may show loading, then shows main page
      await waitFor(() => {
        expect(screen.getByTestId("analytics-page")).toBeInTheDocument();
      });
    });

    it("renders the project filter dropdown", async () => {
      mockAnalyticsApis();
      renderAnalytics();

      // Wait for data to load and main page to render
      await waitFor(() => {
        const select = screen.getByTestId("analytics-project-filter");
        expect(select).toBeInTheDocument();
      });

      // Should have "All Projects" option and project options
      await waitFor(() => {
        expect(screen.getByText("All Projects")).toBeInTheDocument();
        expect(screen.getByText("Project Alpha")).toBeInTheDocument();
        expect(screen.getByText("Project Beta")).toBeInTheDocument();
      });
    });
  });

  describe("Task Completion Metrics (VAL-ANAL-002)", () => {
    it("shows total tasks count", async () => {
      mockAnalyticsApis();
      renderAnalytics();

      await waitFor(() => {
        const metric = screen.getByTestId("metric-total-tasks");
        expect(metric).toBeInTheDocument();
        expect(metric).toHaveTextContent("37");
      });
    });

    it("shows completion rate", async () => {
      mockAnalyticsApis();
      renderAnalytics();

      await waitFor(() => {
        const metric = screen.getByTestId("metric-completion-rate");
        expect(metric).toBeInTheDocument();
        expect(metric).toHaveTextContent("62.2%");
      });
    });

    it("shows average time to completion", async () => {
      mockAnalyticsApis();
      renderAnalytics();

      await waitFor(() => {
        const metric = screen.getByTestId("metric-avg-completion-time");
        expect(metric).toBeInTheDocument();
        expect(metric).toHaveTextContent("1h 30m");
      });
    });

    it("renders task status distribution section", async () => {
      mockAnalyticsApis();
      renderAnalytics();

      await waitFor(() => {
        expect(screen.getByTestId("task-status-distribution")).toBeInTheDocument();
      });
    });

    it("shows correct count for each status", async () => {
      mockAnalyticsApis();
      renderAnalytics();

      await waitFor(() => {
        expect(screen.getByTestId("status-count-backlog")).toHaveTextContent("8");
        expect(screen.getByTestId("status-count-ready")).toHaveTextContent("5");
        expect(screen.getByTestId("status-count-in_progress")).toHaveTextContent("10");
        expect(screen.getByTestId("status-count-review")).toHaveTextContent("4");
        expect(screen.getByTestId("status-count-done")).toHaveTextContent("23");
        expect(screen.getByTestId("status-count-blocked")).toHaveTextContent("2");
      });
    });

    it("renders task metrics section", async () => {
      mockAnalyticsApis();
      renderAnalytics();

      await waitFor(() => {
        expect(screen.getByTestId("task-metrics-section")).toBeInTheDocument();
      });
    });
  });

  describe("Agent Performance Stats (VAL-ANAL-001)", () => {
    it("renders agent performance section", async () => {
      mockAnalyticsApis();
      renderAnalytics();

      await waitFor(() => {
        expect(screen.getByTestId("agent-performance-section")).toBeInTheDocument();
      });
    });

    it("renders agent stats table", async () => {
      mockAnalyticsApis();
      renderAnalytics();

      await waitFor(() => {
        expect(screen.getByTestId("agent-stats-table")).toBeInTheDocument();
      });
    });

    it("shows correct agent completed counts", async () => {
      mockAnalyticsApis();
      renderAnalytics();

      await waitFor(() => {
        expect(screen.getByTestId("agent-completed-agent-1")).toHaveTextContent("15");
        expect(screen.getByTestId("agent-completed-agent-2")).toHaveTextContent("8");
        expect(screen.getByTestId("agent-completed-agent-3")).toHaveTextContent("0");
      });
    });

    it("shows correct agent in-progress counts", async () => {
      mockAnalyticsApis();
      renderAnalytics();

      await waitFor(() => {
        expect(screen.getByTestId("agent-in-progress-agent-1")).toHaveTextContent("3");
        expect(screen.getByTestId("agent-in-progress-agent-2")).toHaveTextContent("2");
        expect(screen.getByTestId("agent-in-progress-agent-3")).toHaveTextContent("5");
      });
    });

    it("shows correct avg completion time per agent", async () => {
      mockAnalyticsApis();
      renderAnalytics();

      await waitFor(() => {
        expect(screen.getByTestId("agent-avg-time-agent-1")).toHaveTextContent("1h 0m");
        expect(screen.getByTestId("agent-avg-time-agent-2")).toHaveTextContent("2h 0m");
        expect(screen.getByTestId("agent-avg-time-agent-3")).toHaveTextContent("N/A");
      });
    });

    it("shows correct success rate per agent", async () => {
      mockAnalyticsApis();
      renderAnalytics();

      await waitFor(() => {
        expect(screen.getByTestId("agent-success-rate-agent-1")).toHaveTextContent("88.5%");
        expect(screen.getByTestId("agent-success-rate-agent-2")).toHaveTextContent("72%");
        expect(screen.getByTestId("agent-success-rate-agent-3")).toHaveTextContent("N/A");
      });
    });

    it("shows no agents message when there are no agents", async () => {
      mockAnalyticsApis({ agentStats: mockAgentStatsEmpty });
      renderAnalytics();

      await waitFor(() => {
        expect(screen.getByTestId("no-agents-message")).toBeInTheDocument();
        expect(screen.getByTestId("no-agents-message")).toHaveTextContent(
          "No agent data available"
        );
      });
    });

    it("sorts agents by completed tasks descending", async () => {
      mockAnalyticsApis();
      renderAnalytics();

      await waitFor(() => {
        const rows = screen.getAllByTestId(/^agent-row-/);
        // Agent Alpha (15) should be first, then Beta (8), then Gamma (0)
        expect(rows[0]).toHaveAttribute("data-testid", "agent-row-agent-1");
        expect(rows[1]).toHaveAttribute("data-testid", "agent-row-agent-2");
        expect(rows[2]).toHaveAttribute("data-testid", "agent-row-agent-3");
      });
    });
  });

  describe("Time Tracking (VAL-ANAL-003)", () => {
    it("renders time tracking section", async () => {
      mockAnalyticsApis();
      renderAnalytics();

      await waitFor(() => {
        expect(screen.getByTestId("time-tracking-section")).toBeInTheDocument();
      });
    });

    it("shows average created-to-claimed time", async () => {
      mockAnalyticsApis();
      renderAnalytics();

      await waitFor(() => {
        const metric = screen.getByTestId("metric-created-to-claimed");
        expect(metric).toBeInTheDocument();
        expect(metric).toHaveTextContent("30m");
      });
    });

    it("shows average claimed-to-completed time", async () => {
      mockAnalyticsApis();
      renderAnalytics();

      await waitFor(() => {
        const metric = screen.getByTestId("metric-claimed-to-completed");
        expect(metric).toBeInTheDocument();
        expect(metric).toHaveTextContent("1h 0m");
      });
    });

    it("shows tasks measured count for created-to-claimed", async () => {
      mockAnalyticsApis();
      renderAnalytics();

      await waitFor(() => {
        const metric = screen.getByTestId("metric-created-to-claimed");
        expect(metric).toHaveTextContent("30 tasks measured");
      });
    });

    it("shows N/A when no time data is available", async () => {
      mockAnalyticsApis({ timeTracking: mockTimeTrackingEmpty });
      renderAnalytics();

      await waitFor(() => {
        expect(screen.getByTestId("metric-created-to-claimed")).toHaveTextContent("N/A");
        expect(screen.getByTestId("metric-claimed-to-completed")).toHaveTextContent("N/A");
      });
    });
  });

  describe("Project Filter", () => {
    it("filters analytics when a project is selected", async () => {
      const user = userEvent.setup();
      mockAnalyticsApis();
      renderAnalytics();

      await waitFor(() => {
        expect(screen.getByText("Project Alpha")).toBeInTheDocument();
      });

      const select = screen.getByTestId("analytics-project-filter");
      await user.selectOptions(select, "proj-1");

      // Should trigger a refetch with project_id parameter
      await waitFor(() => {
        const calls = mockFetch.mock.calls;
        const analyticsCall = calls.find(
          (call: string[]) => call[0].includes("/api/analytics/agents?project_id=proj-1")
        );
        expect(analyticsCall).toBeDefined();
      });
    });

    it("resets to all projects when All Projects is selected", async () => {
      const user = userEvent.setup();
      mockAnalyticsApis();
      renderAnalytics();

      await waitFor(() => {
        expect(screen.getByText("Project Alpha")).toBeInTheDocument();
      });

      const select = screen.getByTestId("analytics-project-filter");

      // Select a project first
      await user.selectOptions(select, "proj-1");
      await waitFor(() => {
        const calls = mockFetch.mock.calls;
        const analyticsCall = calls.find(
          (call: string[]) => call[0].includes("/api/analytics/agents?project_id=proj-1")
        );
        expect(analyticsCall).toBeDefined();
      });

      // Clear mock and set up new mock
      mockFetch.mockClear();
      mockAnalyticsApis();

      // Select "All Projects" (empty value)
      await user.selectOptions(select, "");

      // Verify that the data resets back to all-projects data
      // The metric values should return to unfiltered values
      await waitFor(() => {
        expect(screen.getByTestId("metric-total-tasks")).toHaveTextContent("37");
      });
    });
  });

  describe("Navigation", () => {
    it("calls onBack when back button is clicked", async () => {
      const user = userEvent.setup();
      const mockOnBack = vi.fn();
      mockAnalyticsApis();

      const qc = createQueryClient();
      render(
        <QueryClientProvider client={qc}>
          <Analytics onBack={mockOnBack} />
        </QueryClientProvider>
      );

      const backButton = screen.getByTestId("back-to-board-button");
      await user.click(backButton);

      expect(mockOnBack).toHaveBeenCalledTimes(1);
    });
  });

  describe("Loading State", () => {
    it("shows loading state initially", () => {
      // Don't resolve fetch - leave it hanging
      mockFetch.mockImplementation(() => new Promise(() => {}));

      renderAnalytics();

      expect(screen.getByTestId("analytics-loading")).toBeInTheDocument();
      expect(screen.getByText("Loading analytics...")).toBeInTheDocument();
    });
  });

  describe("Error State", () => {
    it("shows error state when API fails", async () => {
      mockAnalyticsApis({ fail: true });
      renderAnalytics();

      await waitFor(() => {
        expect(screen.getByTestId("analytics-error")).toBeInTheDocument();
      });
    });

    it("shows retry button in error state", async () => {
      mockAnalyticsApis({ fail: true });
      renderAnalytics();

      await waitFor(() => {
        expect(screen.getByTestId("retry-analytics-button")).toBeInTheDocument();
      });
    });

    it("retries when retry button is clicked", async () => {
      const user = userEvent.setup();
      mockAnalyticsApis({ fail: true });
      renderAnalytics();

      await waitFor(() => {
        expect(screen.getByTestId("retry-analytics-button")).toBeInTheDocument();
      });

      // Clear mock and set up success response
      mockFetch.mockClear();
      mockAnalyticsApis();

      const retryButton = screen.getByTestId("retry-analytics-button");
      await user.click(retryButton);

      await waitFor(() => {
        // Should have made new fetch calls
        expect(mockFetch).toHaveBeenCalled();
      });
    });
  });

  describe("Empty Data", () => {
    it("handles empty analytics gracefully", async () => {
      mockAnalyticsApis({
        agentStats: mockAgentStatsEmpty,
        taskMetrics: mockTaskMetricsEmpty,
        timeTracking: mockTimeTrackingEmpty,
      });
      renderAnalytics();

      await waitFor(() => {
        expect(screen.getByTestId("metric-total-tasks")).toHaveTextContent("0");
        expect(screen.getByTestId("metric-completion-rate")).toHaveTextContent("0%");
      });
    });
  });
});
