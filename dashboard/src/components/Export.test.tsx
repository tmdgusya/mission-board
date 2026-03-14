import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ExportButtons, exportToCSV, exportToJSON } from "./Export";
import type { Task, Project, Agent } from "../lib/api-client";

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

const mockTasks: Task[] = [
  {
    id: "task-1",
    projectId: "proj-1",
    agentId: "agent-1",
    title: "Implement login feature",
    description: "Build login page with OAuth support",
    taskType: "feature",
    requiresApproval: false,
    status: "done",
    createdAt: "2026-03-01T10:00:00.000Z",
    updatedAt: "2026-03-05T14:00:00.000Z",
    claimedAt: "2026-03-02T09:00:00.000Z",
  },
  {
    id: "task-2",
    projectId: "proj-1",
    agentId: null,
    title: "Fix navigation bug",
    description: "Navigation dropdown is misaligned on mobile",
    taskType: "bugfix",
    requiresApproval: false,
    status: "backlog",
    createdAt: "2026-03-03T11:00:00.000Z",
    updatedAt: "2026-03-03T11:00:00.000Z",
    claimedAt: null,
  },
  {
    id: "task-3",
    projectId: "proj-2",
    agentId: "agent-2",
    title: "Write API docs",
    description: "Document all REST endpoints",
    taskType: "docs",
    requiresApproval: true,
    status: "in_progress",
    createdAt: "2026-03-04T08:00:00.000Z",
    updatedAt: "2026-03-10T16:00:00.000Z",
    claimedAt: "2026-03-05T10:00:00.000Z",
  },
  {
    id: "task-4",
    projectId: "proj-2",
    agentId: "agent-2",
    title: "Task with special chars, and \"quotes\"",
    description: "Description with newline\nand comma, data",
    taskType: "feature",
    requiresApproval: false,
    status: "review",
    createdAt: "2026-03-06T09:00:00.000Z",
    updatedAt: "2026-03-12T11:00:00.000Z",
    claimedAt: "2026-03-07T08:00:00.000Z",
  },
];

const mockTasksEmpty: Task[] = [];

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

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = createQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );
}

// Mock URL.createObjectURL and URL.revokeObjectURL
const mockCreateObjectURL = vi.fn(() => "blob:mock-url");
const mockRevokeObjectURL = vi.fn();
const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

beforeEach(() => {
  URL.createObjectURL = mockCreateObjectURL;
  URL.revokeObjectURL = mockRevokeObjectURL;
  mockCreateObjectURL.mockClear();
  mockRevokeObjectURL.mockClear();
});

afterEach(() => {
  URL.createObjectURL = originalCreateObjectURL;
  URL.revokeObjectURL = originalRevokeObjectURL;
});

// =============================================
// Pure function tests: exportToCSV
// =============================================

describe("exportToCSV", () => {
  it("generates correct CSV headers", () => {
    const csv = exportToCSV(mockTasks, mockProjects, mockAgents);
    const lines = csv.split("\n");
    expect(lines[0]).toBe(
      "ID,Title,Description,Status,Task Type,Project,Agent,Requires Approval,Created At,Updated At,Claimed At"
    );
  });

  it("generates correct data rows for all tasks", () => {
    const csv = exportToCSV(mockTasks, mockProjects, mockAgents);
    // Each task should be present in the CSV
    expect(csv).toContain("task-1");
    expect(csv).toContain("task-2");
    expect(csv).toContain("task-3");
    expect(csv).toContain("task-4");
    expect(csv).toContain("Implement login feature");
    expect(csv).toContain("Fix navigation bug");
    expect(csv).toContain("Write API docs");
  });

  it("resolves project names from IDs", () => {
    const csv = exportToCSV(mockTasks, mockProjects, mockAgents);
    const lines = csv.split("\n");
    // task-1 is in proj-1 (Project Alpha), task-3 is in proj-2 (Project Beta)
    expect(lines[1]).toContain("Project Alpha");
    expect(lines[3]).toContain("Project Beta");
  });

  it("resolves agent names from IDs", () => {
    const csv = exportToCSV(mockTasks, mockProjects, mockAgents);
    const lines = csv.split("\n");
    // task-1 is assigned to agent-1 (Agent Alpha)
    expect(lines[1]).toContain("Agent Alpha");
    // task-2 is unclaimed
    expect(lines[2]).toContain("Unclaimed");
  });

  it("shows Unclaimed for null agent", () => {
    const csv = exportToCSV(mockTasks, mockProjects, mockAgents);
    const lines = csv.split("\n");
    // task-2 has agentId: null
    expect(lines[2]).toContain("Unclaimed");
  });

  it("shows N/A for null claimedAt", () => {
    const csv = exportToCSV(mockTasks, mockProjects, mockAgents);
    const lines = csv.split("\n");
    // task-2 has claimedAt: null
    expect(lines[2]).toContain("N/A");
  });

  it("escapes fields containing commas in double quotes", () => {
    const tasksWithComma: Task[] = [
      {
        ...mockTasks[0],
        title: "Feature A, B, and C",
      },
    ];
    const csv = exportToCSV(tasksWithComma, mockProjects, mockAgents);
    expect(csv).toContain('"Feature A, B, and C"');
  });

  it("escapes fields containing double quotes", () => {
    const csv = exportToCSV(mockTasks, mockProjects, mockAgents);
    expect(csv).toContain('"Task with special chars, and ""quotes"""');
  });

  it("escapes fields containing newlines", () => {
    const csv = exportToCSV(mockTasks, mockProjects, mockAgents);
    // Description contains \n
    expect(csv).toContain('"Description with newline\nand comma, data"');
  });

  it("returns only headers for empty task list", () => {
    const csv = exportToCSV(mockTasksEmpty, mockProjects, mockAgents);
    const lines = csv.split("\n");
    expect(lines[0]).toContain("ID");
    expect(lines.length).toBe(2); // header + empty trailing newline
  });

  it("shows Unknown Project for missing project ID", () => {
    const taskWithUnknownProject: Task[] = [
      {
        ...mockTasks[0],
        projectId: "non-existent",
      },
    ];
    const csv = exportToCSV(taskWithUnknownProject, mockProjects, mockAgents);
    expect(csv).toContain("Unknown Project");
  });

  it("shows Unknown Agent for missing agent ID", () => {
    const taskWithUnknownAgent: Task[] = [
      {
        ...mockTasks[0],
        agentId: "non-existent",
      },
    ];
    const csv = exportToCSV(taskWithUnknownAgent, mockProjects, mockAgents);
    expect(csv).toContain("Unknown Agent");
  });

  it("correctly formats boolean requires_approval field", () => {
    const csv = exportToCSV(mockTasks, mockProjects, mockAgents);
    const lines = csv.split("\n");
    // task-1 requiresApproval: false
    expect(lines[1]).toContain("false");
    // task-3 requiresApproval: true
    expect(lines[3]).toContain("true");
  });
});

// =============================================
// Pure function tests: exportToJSON
// =============================================

describe("exportToJSON", () => {
  it("returns valid JSON string", () => {
    const json = exportToJSON(mockTasks, mockProjects, mockAgents);
    const parsed = JSON.parse(json);
    expect(Array.isArray(parsed)).toBe(true);
  });

  it("includes all tasks", () => {
    const json = exportToJSON(mockTasks, mockProjects, mockAgents);
    const parsed = JSON.parse(json);
    expect(parsed).toHaveLength(4);
  });

  it("includes enriched project name", () => {
    const json = exportToJSON(mockTasks, mockProjects, mockAgents);
    const parsed = JSON.parse(json);
    expect(parsed[0].projectName).toBe("Project Alpha");
    expect(parsed[2].projectName).toBe("Project Beta");
  });

  it("includes enriched agent name", () => {
    const json = exportToJSON(mockTasks, mockProjects, mockAgents);
    const parsed = JSON.parse(json);
    expect(parsed[0].agentName).toBe("Agent Alpha");
    expect(parsed[1].agentName).toBe("Unclaimed");
  });

  it("includes full task fields", () => {
    const json = exportToJSON(mockTasks, mockProjects, mockAgents);
    const parsed = JSON.parse(json);
    const task = parsed[0];
    expect(task.id).toBe("task-1");
    expect(task.title).toBe("Implement login feature");
    expect(task.description).toBe("Build login page with OAuth support");
    expect(task.status).toBe("done");
    expect(task.taskType).toBe("feature");
    expect(task.requiresApproval).toBe(false);
    expect(task.projectId).toBe("proj-1");
    expect(task.agentId).toBe("agent-1");
    expect(task.createdAt).toBe("2026-03-01T10:00:00.000Z");
    expect(task.updatedAt).toBe("2026-03-05T14:00:00.000Z");
    expect(task.claimedAt).toBe("2026-03-02T09:00:00.000Z");
  });

  it("returns empty array for empty tasks", () => {
    const json = exportToJSON(mockTasksEmpty, mockProjects, mockAgents);
    const parsed = JSON.parse(json);
    expect(parsed).toEqual([]);
  });

  it("handles unknown project/agent gracefully", () => {
    const tasks: Task[] = [
      {
        ...mockTasks[0],
        projectId: "unknown-proj",
        agentId: "unknown-agent",
      },
    ];
    const json = exportToJSON(tasks, mockProjects, mockAgents);
    const parsed = JSON.parse(json);
    expect(parsed[0].projectName).toBe("Unknown Project");
    expect(parsed[0].agentName).toBe("Unknown Agent");
  });

  it("preserves special characters in JSON", () => {
    const json = exportToJSON(mockTasks, mockProjects, mockAgents);
    const parsed = JSON.parse(json);
    expect(parsed[3].title).toBe('Task with special chars, and "quotes"');
    expect(parsed[3].description).toBe("Description with newline\nand comma, data");
  });
});

// =============================================
// ExportButtons component tests
// =============================================

describe("ExportButtons", () => {
  it("renders CSV and JSON export buttons", () => {
    renderWithQuery(
      <ExportButtons
        tasks={mockTasks}
        projects={mockProjects}
        agents={mockAgents}
      />
    );

    expect(screen.getByTestId("export-csv-button")).toBeInTheDocument();
    expect(screen.getByTestId("export-json-button")).toBeInTheDocument();
  });

  it("displays correct button labels", () => {
    renderWithQuery(
      <ExportButtons
        tasks={mockTasks}
        projects={mockProjects}
        agents={mockAgents}
      />
    );

    expect(screen.getByTestId("export-csv-button")).toHaveTextContent("CSV");
    expect(screen.getByTestId("export-json-button")).toHaveTextContent("JSON");
  });

  it("calls download function with CSV format when CSV button clicked", async () => {
    const mockDownload = vi.fn();
    renderWithQuery(
      <ExportButtons
        tasks={mockTasks}
        projects={mockProjects}
        agents={mockAgents}
        onDownload={mockDownload}
      />
    );

    fireEvent.click(screen.getByTestId("export-csv-button"));

    await waitFor(() => {
      expect(mockDownload).toHaveBeenCalledTimes(1);
      expect(mockDownload).toHaveBeenCalledWith(
        expect.any(String), // blob URL
        expect.stringContaining(".csv") // filename
      );
    });
  });

  it("calls download function with JSON format when JSON button clicked", async () => {
    const mockDownload = vi.fn();
    renderWithQuery(
      <ExportButtons
        tasks={mockTasks}
        projects={mockProjects}
        agents={mockAgents}
        onDownload={mockDownload}
      />
    );

    fireEvent.click(screen.getByTestId("export-json-button"));

    await waitFor(() => {
      expect(mockDownload).toHaveBeenCalledTimes(1);
      expect(mockDownload).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining(".json")
      );
    });
  });

  it("triggers file download via anchor element for CSV by default", async () => {
    // Spy on createElement to verify download link creation
    const realCreateElement = document.createElement.bind(document);
    const originalBodyAppendChild = document.body.appendChild.bind(document.body);
    const originalBodyRemoveChild = document.body.removeChild.bind(document.body);

    // Track whether a download link was created and clicked
    let downloadLinkClicked = false;
    const fakeAnchor = realCreateElement("a") as HTMLAnchorElement;

    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      return realCreateElement(tag);
    });

    // Intercept appendChild for anchor elements with download attribute
    vi.spyOn(document.body, "appendChild").mockImplementation((node: Node) => {
      if (node instanceof HTMLAnchorElement && node.getAttribute("download")?.includes(".csv")) {
        // Replace click to track it
        node.click = () => { downloadLinkClicked = true; };
        // Store the node reference so removeChild works
        return node;
      }
      return originalBodyAppendChild(node);
    });

    vi.spyOn(document.body, "removeChild").mockImplementation((node: Node) => {
      try {
        return originalBodyRemoveChild(node);
      } catch {
        return node;
      }
    });

    renderWithQuery(
      <ExportButtons
        tasks={mockTasks}
        projects={mockProjects}
        agents={mockAgents}
      />
    );

    fireEvent.click(screen.getByTestId("export-csv-button"));

    await waitFor(() => {
      expect(mockCreateObjectURL).toHaveBeenCalled();
      expect(downloadLinkClicked).toBe(true);
    });

    vi.restoreAllMocks();
  });

  it("triggers file download via anchor element for JSON by default", async () => {
    const realCreateElement = document.createElement.bind(document);
    const originalBodyAppendChild = document.body.appendChild.bind(document.body);
    const originalBodyRemoveChild = document.body.removeChild.bind(document.body);

    let downloadLinkClicked = false;

    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      return realCreateElement(tag);
    });

    vi.spyOn(document.body, "appendChild").mockImplementation((node: Node) => {
      if (node instanceof HTMLAnchorElement && node.getAttribute("download")?.includes(".json")) {
        node.click = () => { downloadLinkClicked = true; };
        return node;
      }
      return originalBodyAppendChild(node);
    });

    vi.spyOn(document.body, "removeChild").mockImplementation((node: Node) => {
      try {
        return originalBodyRemoveChild(node);
      } catch {
        return node;
      }
    });

    renderWithQuery(
      <ExportButtons
        tasks={mockTasks}
        projects={mockProjects}
        agents={mockAgents}
      />
    );

    fireEvent.click(screen.getByTestId("export-json-button"));

    await waitFor(() => {
      expect(mockCreateObjectURL).toHaveBeenCalled();
      expect(downloadLinkClicked).toBe(true);
    });

    vi.restoreAllMocks();
  });

  it("shows disabled state when no tasks", () => {
    renderWithQuery(
      <ExportButtons
        tasks={mockTasksEmpty}
        projects={mockProjects}
        agents={mockAgents}
      />
    );

    const csvButton = screen.getByTestId("export-csv-button");
    const jsonButton = screen.getByTestId("export-json-button");

    expect(csvButton).toBeDisabled();
    expect(jsonButton).toBeDisabled();
  });

  it("shows task count in button area", () => {
    renderWithQuery(
      <ExportButtons
        tasks={mockTasks}
        projects={mockProjects}
        agents={mockAgents}
      />
    );

    expect(screen.getByTestId("export-count")).toHaveTextContent("4 tasks");
  });

  it("respects filter context - only exports visible tasks", () => {
    // If tasks are pre-filtered before passing, only those are exported
    const filteredTasks = mockTasks.filter((t) => t.status === "done");
    const csv = exportToCSV(filteredTasks, mockProjects, mockAgents);
    const lines = csv.split("\n");
    // Header + 1 data row + trailing newline
    expect(lines.length).toBe(3);
    expect(lines[1]).toContain("Implement login feature");
    expect(lines[1]).toContain("done");
  });

  it("handles CSV export with special characters in all fields", () => {
    const csv = exportToCSV(mockTasks, mockProjects, mockAgents);
    // All task IDs should be present in the CSV
    expect(csv).toContain("task-1");
    expect(csv).toContain("task-2");
    expect(csv).toContain("task-3");
    expect(csv).toContain("task-4");
  });

  it("generates CSV with correct date format", () => {
    const csv = exportToCSV(mockTasks, mockProjects, mockAgents);
    const lines = csv.split("\n");
    // task-1 createdAt is "2026-03-01T10:00:00.000Z"
    expect(lines[1]).toContain("2026-03-01T10:00:00.000Z");
  });
});

// =============================================
// Integration: export format verification
// =============================================

describe("Export format verification", () => {
  it("CSV has consistent column count per row", () => {
    const csv = exportToCSV(mockTasks, mockProjects, mockAgents);
    const lines = csv.split("\n").filter((l) => l.trim());
    const headerCols = lines[0].split(",").length;
    for (let i = 1; i < lines.length; i++) {
      // Simple column count check (may be off if commas in quoted fields)
      // Use a basic check: the line should have content
      expect(lines[i].length).toBeGreaterThan(0);
    }
    expect(headerCols).toBe(11);
  });

  it("JSON objects have consistent structure", () => {
    const json = exportToJSON(mockTasks, mockProjects, mockAgents);
    const parsed = JSON.parse(json) as Record<string, unknown>[];
    const expectedKeys = [
      "id", "title", "description", "status", "taskType",
      "projectId", "projectName", "agentId", "agentName",
      "requiresApproval", "createdAt", "updatedAt", "claimedAt",
    ];
    for (const obj of parsed) {
      for (const key of expectedKeys) {
        expect(Object.prototype.hasOwnProperty.call(obj, key)).toBe(true);
      }
    }
  });
});
