import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Filters,
  DEFAULT_FILTERS,
  applyClientFilters,
  buildApiParams,
  type FilterState,
} from "./Filters";
import type { Task, Project, Agent } from "../lib/api-client";

// =============================================
// Test helpers
// =============================================

const mockProjects: Project[] = [
  {
    id: "proj-1",
    name: "Frontend App",
    description: "Frontend application",
    createdAt: "2026-03-13T00:00:00.000Z",
    updatedAt: "2026-03-13T00:00:00.000Z",
  },
  {
    id: "proj-2",
    name: "Backend API",
    description: "Backend API server",
    createdAt: "2026-03-13T00:00:00.000Z",
    updatedAt: "2026-03-13T00:00:00.000Z",
  },
];

const mockAgents: Agent[] = [
  {
    id: "agent-1",
    name: "Alice",
    createdAt: "2026-03-13T00:00:00.000Z",
    lastSeenAt: "2026-03-13T00:00:00.000Z",
  },
  {
    id: "agent-2",
    name: "Bob",
    createdAt: "2026-03-13T00:00:00.000Z",
    lastSeenAt: "2026-03-13T00:00:00.000Z",
  },
];

const mockTasks: Task[] = [
  {
    id: "task-1",
    projectId: "proj-1",
    agentId: "agent-1",
    title: "Implement login page",
    description: "Create the login form with email and password fields",
    taskType: "implementation",
    requiresApproval: false,
    status: "backlog",
    createdAt: "2026-03-13T00:00:00.000Z",
    updatedAt: "2026-03-13T00:00:00.000Z",
    claimedAt: null,
  },
  {
    id: "task-2",
    projectId: "proj-2",
    agentId: "agent-2",
    title: "Build REST API",
    description: "Set up Hono server with CRUD endpoints",
    taskType: "implementation",
    requiresApproval: false,
    status: "in_progress",
    createdAt: "2026-03-13T00:00:00.000Z",
    updatedAt: "2026-03-13T00:00:00.000Z",
    claimedAt: "2026-03-13T00:00:00.000Z",
  },
  {
    id: "task-3",
    projectId: "proj-1",
    agentId: null,
    title: "Write unit tests",
    description: "Add tests for the auth module",
    taskType: "testing",
    requiresApproval: false,
    status: "ready",
    createdAt: "2026-03-13T00:00:00.000Z",
    updatedAt: "2026-03-13T00:00:00.000Z",
    claimedAt: null,
  },
  {
    id: "task-4",
    projectId: "proj-2",
    agentId: "agent-1",
    title: "Deploy to staging",
    description: null,
    taskType: "deployment",
    requiresApproval: true,
    status: "review",
    createdAt: "2026-03-13T00:00:00.000Z",
    updatedAt: "2026-03-13T00:00:00.000Z",
    claimedAt: "2026-03-13T00:00:00.000Z",
  },
];

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

// Mock the API hooks
vi.mock("../hooks/use-projects", () => ({
  useProjects: () => ({ data: mockProjects, isLoading: false }),
}));

vi.mock("../hooks/use-agents", () => ({
  useAgents: () => ({ data: mockAgents, isLoading: false }),
}));

function renderFilters(
  filters: FilterState = DEFAULT_FILTERS,
  onFiltersChange = vi.fn(),
  tasks: Task[] = mockTasks
) {
  const qc = createQueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <Filters
        filters={filters}
        onFiltersChange={onFiltersChange}
        tasks={tasks}
      />
    </QueryClientProvider>
  );
}

// =============================================
// DEFAULT_FILTERS tests
// =============================================

describe("DEFAULT_FILTERS", () => {
  it("has all fields as empty strings", () => {
    expect(DEFAULT_FILTERS.projectId).toBe("");
    expect(DEFAULT_FILTERS.status).toBe("");
    expect(DEFAULT_FILTERS.agentId).toBe("");
    expect(DEFAULT_FILTERS.search).toBe("");
  });
});

// =============================================
// buildApiParams tests
// =============================================

describe("buildApiParams", () => {
  it("returns empty object when no filters are set", () => {
    expect(buildApiParams(DEFAULT_FILTERS)).toEqual({});
  });

  it("includes project_id when projectId is set", () => {
    const params = buildApiParams({ ...DEFAULT_FILTERS, projectId: "proj-1" });
    expect(params.project_id).toBe("proj-1");
  });

  it("includes status when status is set", () => {
    const params = buildApiParams({ ...DEFAULT_FILTERS, status: "backlog" });
    expect(params.status).toBe("backlog");
  });

  it("includes agent_id when agentId is set", () => {
    const params = buildApiParams({ ...DEFAULT_FILTERS, agentId: "agent-1" });
    expect(params.agent_id).toBe("agent-1");
  });

  it("does not include search param (client-side only)", () => {
    const params = buildApiParams({ ...DEFAULT_FILTERS, search: "login" });
    expect(params).toEqual({});
  });

  it("combines multiple server-side filters", () => {
    const params = buildApiParams({
      ...DEFAULT_FILTERS,
      projectId: "proj-1",
      status: "backlog",
      agentId: "agent-1",
    });
    expect(params).toEqual({
      project_id: "proj-1",
      status: "backlog",
      agent_id: "agent-1",
    });
  });
});

// =============================================
// applyClientFilters tests
// =============================================

describe("applyClientFilters", () => {
  it("returns all tasks when search is empty", () => {
    const result = applyClientFilters(mockTasks, DEFAULT_FILTERS);
    expect(result).toHaveLength(mockTasks.length);
  });

  it("filters tasks by title (case-insensitive)", () => {
    const result = applyClientFilters(mockTasks, {
      ...DEFAULT_FILTERS,
      search: "login",
    });
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("task-1");
  });

  it("filters tasks by description (case-insensitive)", () => {
    const result = applyClientFilters(mockTasks, {
      ...DEFAULT_FILTERS,
      search: "Hono",
    });
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("task-2");
  });

  it("matches search across title and description", () => {
    const result = applyClientFilters(mockTasks, {
      ...DEFAULT_FILTERS,
      search: "the",
    });
    expect(result).toHaveLength(2); // "Create the login form" and "Add tests for the auth module"
  });

  it("returns empty when no tasks match search", () => {
    const result = applyClientFilters(mockTasks, {
      ...DEFAULT_FILTERS,
      search: "nonexistent",
    });
    expect(result).toHaveLength(0);
  });

  it("handles tasks with null description", () => {
    const result = applyClientFilters(mockTasks, {
      ...DEFAULT_FILTERS,
      search: "staging",
    });
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("task-4");
  });

  it("trims whitespace from search query", () => {
    const result = applyClientFilters(mockTasks, {
      ...DEFAULT_FILTERS,
      search: "  login  ",
    });
    expect(result).toHaveLength(1);
  });
});

// =============================================
// Filters component rendering tests
// =============================================

describe("Filters component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the filters bar", () => {
    renderFilters();
    expect(screen.getByTestId("filters-bar")).toBeInTheDocument();
  });

  it("renders project filter with all options", () => {
    renderFilters();
    const select = screen.getByTestId("filter-project") as HTMLSelectElement;
    expect(select).toBeInTheDocument();
    // "All Projects" + 2 projects = 3 options
    expect(select.options).toHaveLength(3);
    expect(select.options[0]!.text).toBe("All Projects");
    expect(select.options[1]!.text).toBe("Frontend App");
    expect(select.options[2]!.text).toBe("Backend API");
  });

  it("renders status filter with all statuses", () => {
    renderFilters();
    const select = screen.getByTestId("filter-status") as HTMLSelectElement;
    expect(select).toBeInTheDocument();
    // "All Statuses" + 6 statuses = 7 options
    expect(select.options).toHaveLength(7);
    expect(select.options[0]!.text).toBe("All Statuses");
  });

  it("renders agent filter with all agents", () => {
    renderFilters();
    const select = screen.getByTestId("filter-agent") as HTMLSelectElement;
    expect(select).toBeInTheDocument();
    // "All Agents" + 2 agents = 3 options
    expect(select.options).toHaveLength(3);
    expect(select.options[0]!.text).toBe("All Agents");
    expect(select.options[1]!.text).toBe("Alice");
    expect(select.options[2]!.text).toBe("Bob");
  });

  it("renders search input", () => {
    renderFilters();
    const input = screen.getByTestId("filter-search") as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.placeholder).toBe("Search tasks...");
  });

  it("does not show clear filters button when no filters are active", () => {
    renderFilters();
    expect(screen.queryByTestId("clear-filters")).not.toBeInTheDocument();
  });

  it("does not show filter count info when no filters are active", () => {
    renderFilters();
    expect(screen.queryByTestId("filter-count-info")).not.toBeInTheDocument();
  });

  it("shows clear filters button when any filter is active", () => {
    renderFilters({ ...DEFAULT_FILTERS, projectId: "proj-1" });
    expect(screen.getByTestId("clear-filters")).toBeInTheDocument();
  });

  it("shows clear filters button when search is active", () => {
    renderFilters({ ...DEFAULT_FILTERS, search: "test" });
    expect(screen.getByTestId("clear-filters")).toBeInTheDocument();
  });

  it("shows filter count info when filters are active", () => {
    renderFilters(
      { ...DEFAULT_FILTERS, status: "backlog" },
      vi.fn(),
      [mockTasks[0]!] // only 1 task matches
    );
    expect(screen.getByTestId("filter-count-info")).toBeInTheDocument();
    expect(screen.getByTestId("filter-count-info")).toHaveTextContent("1 task shown");
  });

  it("shows plural task count info", () => {
    renderFilters(
      { ...DEFAULT_FILTERS, search: "the" },
      vi.fn(),
      mockTasks.slice(0, 2)
    );
    expect(screen.getByTestId("filter-count-info")).toHaveTextContent("2 tasks shown");
  });

  it("has proper labels for accessibility", () => {
    renderFilters();
    expect(screen.getByLabelText("Filter by project")).toBeInTheDocument();
    expect(screen.getByLabelText("Filter by status")).toBeInTheDocument();
    expect(screen.getByLabelText("Filter by agent")).toBeInTheDocument();
    expect(screen.getByLabelText("Search tasks by title or description")).toBeInTheDocument();
  });
});

// =============================================
// Filter interaction tests
// =============================================

describe("Filter interactions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls onFiltersChange when project filter changes", async () => {
    const user = userEvent.setup();
    const onFiltersChange = vi.fn();
    renderFilters(DEFAULT_FILTERS, onFiltersChange);

    await user.selectOptions(screen.getByTestId("filter-project"), "proj-1");
    expect(onFiltersChange).toHaveBeenCalledWith({
      ...DEFAULT_FILTERS,
      projectId: "proj-1",
    });
  });

  it("calls onFiltersChange when status filter changes", async () => {
    const user = userEvent.setup();
    const onFiltersChange = vi.fn();
    renderFilters(DEFAULT_FILTERS, onFiltersChange);

    await user.selectOptions(screen.getByTestId("filter-status"), "backlog");
    expect(onFiltersChange).toHaveBeenCalledWith({
      ...DEFAULT_FILTERS,
      status: "backlog",
    });
  });

  it("calls onFiltersChange when agent filter changes", async () => {
    const user = userEvent.setup();
    const onFiltersChange = vi.fn();
    renderFilters(DEFAULT_FILTERS, onFiltersChange);

    await user.selectOptions(screen.getByTestId("filter-agent"), "agent-1");
    expect(onFiltersChange).toHaveBeenCalledWith({
      ...DEFAULT_FILTERS,
      agentId: "agent-1",
    });
  });

  it("calls onFiltersChange when search input changes", async () => {
    const onFiltersChange = vi.fn();
    renderFilters(DEFAULT_FILTERS, onFiltersChange);

    const input = screen.getByTestId("filter-search");
    // Use fireEvent to simulate controlled input behavior
    await userEvent.type(input, "l");
    // Since it's a controlled component with empty initial value,
    // each keystroke triggers onChange with the current DOM value
    expect(onFiltersChange).toHaveBeenCalled();
    const lastCall = onFiltersChange.mock.calls.at(-1)![0] as FilterState;
    expect(lastCall.search).toBeTruthy();
    expect(lastCall.projectId).toBe("");
    expect(lastCall.status).toBe("");
    expect(lastCall.agentId).toBe("");
  });

  it("calls onFiltersChange with DEFAULT_FILTERS when clear button is clicked", async () => {
    const user = userEvent.setup();
    const onFiltersChange = vi.fn();
    const activeFilters: FilterState = {
      projectId: "proj-1",
      status: "backlog",
      agentId: "agent-1",
      search: "login",
    };
    renderFilters(activeFilters, onFiltersChange);

    await user.click(screen.getByTestId("clear-filters"));
    expect(onFiltersChange).toHaveBeenCalledWith(DEFAULT_FILTERS);
  });

  it("clear filters button resets all filters to defaults", async () => {
    const user = userEvent.setup();
    const onFiltersChange = vi.fn();
    const activeFilters: FilterState = {
      projectId: "proj-2",
      status: "review",
      agentId: "agent-2",
      search: "deploy",
    };
    renderFilters(activeFilters, onFiltersChange);

    const clearBtn = screen.getByTestId("clear-filters");
    await user.click(clearBtn);

    expect(onFiltersChange).toHaveBeenCalledTimes(1);
    expect(onFiltersChange).toHaveBeenCalledWith({
      projectId: "",
      status: "",
      agentId: "",
      search: "",
    });
  });

  it("clear filters button has correct aria-label", () => {
    renderFilters({ ...DEFAULT_FILTERS, search: "test" });
    expect(screen.getByLabelText("Clear all filters")).toBeInTheDocument();
  });
});

// =============================================
// Filter combination tests
// =============================================

describe("Filter combinations", () => {
  it("project + status filters work together via buildApiParams", () => {
    const filters: FilterState = {
      projectId: "proj-1",
      status: "backlog",
      agentId: "",
      search: "",
    };
    const params = buildApiParams(filters);
    expect(params).toEqual({
      project_id: "proj-1",
      status: "backlog",
    });
  });

  it("all server-side filters work together", () => {
    const filters: FilterState = {
      projectId: "proj-2",
      status: "review",
      agentId: "agent-1",
      search: "",
    };
    const params = buildApiParams(filters);
    expect(params).toEqual({
      project_id: "proj-2",
      status: "review",
      agent_id: "agent-1",
    });
  });

  it("search + server filters work together (search is client-side)", () => {
    // Server-side: projectId + status filter at API level
    const serverParams = buildApiParams({
      projectId: "proj-1",
      status: "backlog",
      agentId: "",
      search: "login",
    });
    expect(serverParams).toEqual({
      project_id: "proj-1",
      status: "backlog",
    });
    // Client-side: search further narrows results
    const clientFiltered = applyClientFilters([mockTasks[0]!], {
      ...DEFAULT_FILTERS,
      search: "login",
    });
    expect(clientFiltered).toHaveLength(1);
    expect(clientFiltered[0]!.title).toBe("Implement login page");
  });

  it("empty search string does not filter anything", () => {
    const result = applyClientFilters(mockTasks, {
      ...DEFAULT_FILTERS,
      search: "   ",
    });
    // Empty after trim should not filter
    expect(result).toHaveLength(mockTasks.length);
  });
});
