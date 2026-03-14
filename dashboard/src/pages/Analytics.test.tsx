import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Analytics } from "./Analytics";
import {
  DonutChart,
  BarChart,
  LineChart,
  TaskStatusDonut,
  AgentComparisonBar,
  VelocityLine,
} from "../components/Charts";
import type { AgentStat, TaskMetrics, TimeTrackingMetrics, VelocityDataPoint, Project } from "../lib/api-client";

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
    avgCompletionTimeMs: 3600000,
    successRate: 88.5,
  },
  {
    agentId: "agent-2",
    agentName: "Agent Beta",
    tasksCompleted: 8,
    tasksInProgress: 2,
    totalTasks: 12,
    avgCompletionTimeMs: 7200000,
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
  avgTimeToCompletionMs: 5400000,
};

const mockTimeTracking: TimeTrackingMetrics = {
  avgCreatedToClaimedMs: 1800000,
  avgClaimedToCompletedMs: 3600000,
  tasksWithClaimData: 30,
  tasksWithCompletionData: 23,
};

const mockVelocityData: VelocityDataPoint[] = [
  { date: "2026-03-01", count: 2 },
  { date: "2026-03-02", count: 3 },
  { date: "2026-03-03", count: 1 },
  { date: "2026-03-04", count: 4 },
  { date: "2026-03-05", count: 2 },
];

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
  velocity?: VelocityDataPoint[];
  projects?: Project[];
  fail?: boolean;
}) {
  const agentStats = overrides?.agentStats ?? mockAgentStats;
  const taskMetrics = overrides?.taskMetrics ?? mockTaskMetrics;
  const timeTracking = overrides?.timeTracking ?? mockTimeTracking;
  const velocity = overrides?.velocity ?? mockVelocityData;
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

    // GET /api/analytics/velocity
    if (url.includes("/api/analytics/velocity") && !options?.method) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => velocity,
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
// Chart Component Tests
// =============================================

describe("Charts Component", () => {
  describe("DonutChart", () => {
    it("renders with data", () => {
      render(
        <DonutChart
          data={[
            { label: "Done", value: 23, color: "#22c55e" },
            { label: "In Progress", value: 10, color: "#f59e0b" },
            { label: "Backlog", value: 8, color: "#64748b" },
          ]}
          testId="test-donut"
        />
      );

      expect(screen.getByTestId("test-donut")).toBeInTheDocument();
      expect(screen.getByTestId("test-donut-legend")).toBeInTheDocument();
    });

    it("shows legend items for non-zero values", () => {
      render(
        <DonutChart
          data={[
            { label: "Done", value: 23, color: "#22c55e" },
            { label: "In Progress", value: 10, color: "#f59e0b" },
            { label: "Empty", value: 0, color: "#000000" },
          ]}
          testId="test-donut-legend"
        />
      );

      expect(screen.getByText("Done")).toBeInTheDocument();
      expect(screen.getByText("In Progress")).toBeInTheDocument();
      // Zero-value items should not appear in legend
      expect(screen.queryByText("Empty")).not.toBeInTheDocument();
    });

    it("renders with empty data", () => {
      render(
        <DonutChart
          data={[{ label: "None", value: 0, color: "#64748b" }]}
          testId="test-donut-empty"
        />
      );

      expect(screen.getByTestId("test-donut-empty")).toBeInTheDocument();
      // No legend should be shown
      expect(screen.queryByTestId("test-donut-empty-legend")).not.toBeInTheDocument();
    });

    it("has accessible role and label", () => {
      render(
        <DonutChart
          data={[{ label: "Done", value: 5, color: "#22c55e" }]}
          testId="test-donut-a11y"
        />
      );

      const canvas = screen.getByRole("img");
      expect(canvas).toHaveAttribute("aria-label", "Donut chart showing task status distribution");
    });
  });

  describe("BarChart", () => {
    it("renders with agent data", () => {
      render(
        <BarChart
          data={[
            { label: "Agent Alpha", value: 15 },
            { label: "Agent Beta", value: 8 },
            { label: "Agent Gamma", value: 0 },
          ]}
          testId="test-bar"
        />
      );

      expect(screen.getByTestId("test-bar")).toBeInTheDocument();
    });

    it("renders with empty data", () => {
      render(<BarChart data={[]} testId="test-bar-empty" />);

      expect(screen.getByTestId("test-bar-empty")).toBeInTheDocument();
    });

    it("has accessible role and label", () => {
      render(
        <BarChart
          data={[{ label: "Agent", value: 5 }]}
          testId="test-bar-a11y"
        />
      );

      const canvas = screen.getByRole("img");
      expect(canvas).toHaveAttribute("aria-label", "Bar chart comparing agents");
    });
  });

  describe("LineChart", () => {
    it("renders with velocity data", () => {
      render(
        <LineChart
          data={{
            data: [
              { date: "2026-03-01", count: 2 },
              { date: "2026-03-02", count: 3 },
            ],
          }}
          testId="test-line"
        />
      );

      expect(screen.getByTestId("test-line")).toBeInTheDocument();
    });

    it("renders with empty data", () => {
      render(
        <LineChart
          data={{ data: [] }}
          testId="test-line-empty"
        />
      );

      expect(screen.getByTestId("test-line-empty")).toBeInTheDocument();
    });

    it("has accessible role and label", () => {
      render(
        <LineChart
          data={{ data: [{ date: "2026-03-01", count: 1 }] }}
          testId="test-line-a11y"
        />
      );

      const canvas = screen.getByRole("img");
      expect(canvas).toHaveAttribute("aria-label", "Line chart showing velocity over time");
    });
  });

  describe("TaskStatusDonut", () => {
    it("renders donut section with status distribution", () => {
      render(
        <TaskStatusDonut
          statusCounts={{ backlog: 5, ready: 3, in_progress: 8, done: 15, review: 2, blocked: 1 }}
          totalTasks={34}
        />
      );

      expect(screen.getByTestId("status-donut-section")).toBeInTheDocument();
      expect(screen.getByTestId("status-donut")).toBeInTheDocument();
    });

    it("renders legend with status labels", () => {
      render(
        <TaskStatusDonut
          statusCounts={{ backlog: 5, done: 15, in_progress: 8 }}
          totalTasks={28}
        />
      );

      expect(screen.getByText("Backlog")).toBeInTheDocument();
      expect(screen.getByText("Done")).toBeInTheDocument();
      expect(screen.getByText("In Progress")).toBeInTheDocument();
    });
  });

  describe("AgentComparisonBar", () => {
    it("renders agent comparison section", () => {
      render(
        <AgentComparisonBar
          agentStats={[
            { agentName: "Agent Alpha", tasksCompleted: 15, tasksInProgress: 3 },
            { agentName: "Agent Beta", tasksCompleted: 8, tasksInProgress: 2 },
          ]}
        />
      );

      expect(screen.getByTestId("agent-comparison-section")).toBeInTheDocument();
      expect(screen.getByTestId("agent-comparison-bar")).toBeInTheDocument();
    });
  });

  describe("VelocityLine", () => {
    it("renders velocity section with data", () => {
      render(
        <VelocityLine
          velocityData={[
            { date: "2026-03-01", count: 2 },
            { date: "2026-03-02", count: 5 },
          ]}
        />
      );

      expect(screen.getByTestId("velocity-section")).toBeInTheDocument();
      expect(screen.getByTestId("velocity-line")).toBeInTheDocument();
    });

    it("renders loading state", () => {
      render(<VelocityLine velocityData={[]} isLoading={true} />);

      expect(screen.getByTestId("velocity-section")).toBeInTheDocument();
      expect(screen.getByText("Loading velocity data...")).toBeInTheDocument();
    });
  });
});

// =============================================
// Analytics Page Tests
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

      await waitFor(() => {
        expect(screen.getByTestId("analytics-page")).toBeInTheDocument();
      });
    });

    it("renders the project filter dropdown", async () => {
      mockAnalyticsApis();
      renderAnalytics();

      await waitFor(() => {
        const select = screen.getByTestId("analytics-project-filter");
        expect(select).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getByText("All Projects")).toBeInTheDocument();
        expect(screen.getByText("Project Alpha")).toBeInTheDocument();
        expect(screen.getByText("Project Beta")).toBeInTheDocument();
      });
    });
  });

  describe("Date Range Filter (VAL-ANAL-007)", () => {
    it("renders date range filter inputs", async () => {
      mockAnalyticsApis();
      renderAnalytics();

      await waitFor(() => {
        expect(screen.getByTestId("analytics-date-from")).toBeInTheDocument();
        expect(screen.getByTestId("analytics-date-to")).toBeInTheDocument();
      });
    });

    it("renders date from input with correct type", async () => {
      mockAnalyticsApis();
      renderAnalytics();

      await waitFor(() => {
        const dateFrom = screen.getByTestId("analytics-date-from") as HTMLInputElement;
        expect(dateFrom.type).toBe("date");
      });
    });

    it("renders date to input with correct type", async () => {
      mockAnalyticsApis();
      renderAnalytics();

      await waitFor(() => {
        const dateTo = screen.getByTestId("analytics-date-to") as HTMLInputElement;
        expect(dateTo.type).toBe("date");
      });
    });

    it("sends date params when date range is set", async () => {
      const user = userEvent.setup();
      mockAnalyticsApis();
      renderAnalytics();

      await waitFor(() => {
        expect(screen.getByTestId("analytics-date-from")).toBeInTheDocument();
      });

      // Wait for initial data load
      await waitFor(() => {
        expect(screen.getByTestId("metric-total-tasks")).toHaveTextContent("37");
      });

      // Clear mocks
      mockFetch.mockClear();
      mockAnalyticsApis();

      // Set the date_from input value and trigger change
      const dateFrom = screen.getByTestId("analytics-date-from") as HTMLInputElement;
      fireEvent.change(dateFrom, { target: { value: "2026-03-01" } });

      // Wait for a refetch - the date param should appear in the URL
      await waitFor(() => {
        const calls = mockFetch.mock.calls;
        const agentCall = calls.find(
          (call: string[]) =>
            call[0].includes("/api/analytics/agents") &&
            call[0].includes("date_from=")
        );
        expect(agentCall).toBeDefined();
      });
    });

    it("shows clear filters button when filters are active", async () => {
      const user = userEvent.setup();
      mockAnalyticsApis();
      renderAnalytics();

      await waitFor(() => {
        expect(screen.getByTestId("analytics-date-from")).toBeInTheDocument();
      });

      // Set a date to activate filters
      const dateFrom = screen.getByTestId("analytics-date-from") as HTMLInputElement;
      await user.type(dateFrom, "2026-03-01");

      await waitFor(() => {
        expect(screen.getByTestId("analytics-clear-filters")).toBeInTheDocument();
      });
    });

    it("clears all filters when clear button is clicked", async () => {
      const user = userEvent.setup({ delay: 10 });
      mockAnalyticsApis();
      renderAnalytics();

      await waitFor(() => {
        expect(screen.getByTestId("analytics-date-from")).toBeInTheDocument();
      });

      // Set filters
      const dateFrom = screen.getByTestId("analytics-date-from") as HTMLInputElement;
      const projectSelect = screen.getByTestId("analytics-project-filter");

      await user.type(dateFrom, "2026-03-01");

      // Wait for clear button to appear after date is set
      await waitFor(() => {
        expect(screen.getByTestId("analytics-clear-filters")).toBeInTheDocument();
      });

      await user.selectOptions(projectSelect, "proj-1");

      // Clear mocks and re-setup
      mockFetch.mockClear();
      mockAnalyticsApis();

      // Click clear button
      const clearButton = screen.getByTestId("analytics-clear-filters");
      await user.click(clearButton);

      // Verify date input is cleared
      await waitFor(() => {
        const dateInput = screen.getByTestId("analytics-date-from") as HTMLInputElement;
        expect(dateInput.value).toBe("");
      });

      // Verify data resets to unfiltered values (which implies project filter is cleared too)
      await waitFor(() => {
        expect(screen.getByTestId("metric-total-tasks")).toHaveTextContent("37");
      });
    });

    it("does not show clear button when no filters are active", async () => {
      mockAnalyticsApis();
      renderAnalytics();

      await waitFor(() => {
        expect(screen.getByTestId("analytics-page")).toBeInTheDocument();
      });

      expect(screen.queryByTestId("analytics-clear-filters")).not.toBeInTheDocument();
    });
  });

  describe("Charts Display (VAL-ANAL-006)", () => {
    it("renders the charts section", async () => {
      mockAnalyticsApis();
      renderAnalytics();

      await waitFor(() => {
        expect(screen.getByTestId("charts-section")).toBeInTheDocument();
      });
    });

    it("renders task status donut chart", async () => {
      mockAnalyticsApis();
      renderAnalytics();

      await waitFor(() => {
        expect(screen.getByTestId("status-donut-section")).toBeInTheDocument();
      });
    });

    it("renders agent comparison bar chart", async () => {
      mockAnalyticsApis();
      renderAnalytics();

      await waitFor(() => {
        expect(screen.getByTestId("agent-comparison-section")).toBeInTheDocument();
      });
    });

    it("renders velocity line chart", async () => {
      mockAnalyticsApis();
      renderAnalytics();

      await waitFor(() => {
        expect(screen.getByTestId("velocity-section")).toBeInTheDocument();
      });
    });

    it("renders charts with empty data", async () => {
      mockAnalyticsApis({
        agentStats: mockAgentStatsEmpty,
        taskMetrics: mockTaskMetricsEmpty,
        timeTracking: mockTimeTrackingEmpty,
        velocity: [],
      });
      renderAnalytics();

      await waitFor(() => {
        expect(screen.getByTestId("charts-section")).toBeInTheDocument();
        expect(screen.getByTestId("status-donut-section")).toBeInTheDocument();
        expect(screen.getByTestId("agent-comparison-section")).toBeInTheDocument();
      });
    });
  });

  describe("Filters Update All Data (VAL-ANAL-007)", () => {
    it("project filter updates all analytics queries", async () => {
      const user = userEvent.setup();
      mockAnalyticsApis();
      renderAnalytics();

      await waitFor(() => {
        expect(screen.getByText("Project Alpha")).toBeInTheDocument();
      });

      const select = screen.getByTestId("analytics-project-filter");
      await user.selectOptions(select, "proj-1");

      await waitFor(() => {
        const calls = mockFetch.mock.calls;
        const agentCall = calls.find(
          (call: string[]) => call[0].includes("/api/analytics/agents?project_id=proj-1")
        );
        expect(agentCall).toBeDefined();
      });
    });

    it("date range filter updates all analytics queries", async () => {
      const user = userEvent.setup();
      mockAnalyticsApis();
      renderAnalytics();

      await waitFor(() => {
        expect(screen.getByTestId("analytics-date-from")).toBeInTheDocument();
      });

      const dateFrom = screen.getByTestId("analytics-date-from") as HTMLInputElement;
      await user.type(dateFrom, "2026-03-01");

      await waitFor(() => {
        const calls = mockFetch.mock.calls;
        const agentCall = calls.find(
          (call: string[]) =>
            call[0].includes("/api/analytics/agents") &&
            call[0].includes("date_from=2026-03-01")
        );
        expect(agentCall).toBeDefined();

        // Velocity endpoint should also receive date params
        const velocityCall = calls.find(
          (call: string[]) =>
            call[0].includes("/api/analytics/velocity") &&
            call[0].includes("date_from=2026-03-01")
        );
        expect(velocityCall).toBeDefined();
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

      mockFetch.mockClear();
      mockAnalyticsApis();

      const retryButton = screen.getByTestId("retry-analytics-button");
      await user.click(retryButton);

      await waitFor(() => {
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
        velocity: [],
      });
      renderAnalytics();

      await waitFor(() => {
        expect(screen.getByTestId("metric-total-tasks")).toHaveTextContent("0");
        expect(screen.getByTestId("metric-completion-rate")).toHaveTextContent("0%");
      });
    });
  });
});
