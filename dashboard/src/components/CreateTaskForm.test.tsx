import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CreateTaskForm } from "./CreateTaskForm";
import type { Project } from "../lib/api-client";

// =============================================
// Mock data
// =============================================

const mockProjects: Project[] = [
  {
    id: "proj-1",
    name: "Mission Control",
    description: "Main mission control system",
    createdAt: "2026-03-01T00:00:00.000Z",
    updatedAt: "2026-03-13T00:00:00.000Z",
  },
  {
    id: "proj-2",
    name: "Backend API",
    description: "API server project",
    createdAt: "2026-03-02T00:00:00.000Z",
    updatedAt: "2026-03-13T00:00:00.000Z",
  },
];

const mockCreatedTask = {
  id: "task-new-1",
  projectId: "proj-1",
  agentId: null,
  title: "Build auth system",
  description: "Implement OAuth2 authentication",
  taskType: "implementation",
  requiresApproval: false,
  status: "backlog" as const,
  createdAt: "2026-03-14T00:00:00.000Z",
  updatedAt: "2026-03-14T00:00:00.000Z",
  claimedAt: null,
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

function renderCreateTaskForm(
  isOpen: boolean,
  onClose: () => void,
  options?: {
    fetchError?: boolean;
    createTaskError?: boolean;
  }
) {
  const qc = createQueryClient();

  mockFetch.mockImplementation((url: string, init?: RequestInit) => {
    // GET projects
    if (url.includes("/api/projects") && (!init || init.method !== "POST")) {
      if (options?.fetchError) {
        return Promise.resolve({
          ok: false,
          status: 500,
          json: () => Promise.resolve({ error: "Server error" }),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockProjects),
      });
    }

    // POST create task
    if (url.includes("/api/tasks") && init?.method === "POST") {
      if (options?.createTaskError) {
        return Promise.resolve({
          ok: false,
          status: 400,
          json: () => Promise.resolve({ error: "Validation failed" }),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 201,
        json: () => Promise.resolve(mockCreatedTask),
      });
    }

    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve([]),
    });
  });

  const result = render(
    <QueryClientProvider client={qc}>
      <CreateTaskForm isOpen={isOpen} onClose={onClose} />
    </QueryClientProvider>
  );

  return result;
}

// =============================================
// Tests
// =============================================

describe("CreateTaskForm", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    vi.stubGlobal("crypto", { randomUUID: () => "test-uuid" });
    mockFetch.mockClear();
  });

  describe("Rendering", () => {
    it("renders nothing when isOpen is false", () => {
      const onClose = vi.fn();
      const { container } = renderCreateTaskForm(false, onClose);
      expect(container.innerHTML).toBe("");
    });

    it("renders modal when isOpen is true", async () => {
      const onClose = vi.fn();
      renderCreateTaskForm(true, onClose);

      expect(await screen.findByTestId("create-task-modal")).toBeInTheDocument();
    });

    it("renders form title 'Create New Task'", async () => {
      const onClose = vi.fn();
      renderCreateTaskForm(true, onClose);

      await screen.findByTestId("create-task-title");
      expect(screen.getByTestId("create-task-title")).toHaveTextContent(
        "Create New Task"
      );
    });

    it("renders close button", async () => {
      const onClose = vi.fn();
      renderCreateTaskForm(true, onClose);

      await screen.findByTestId("create-task-close");
      expect(screen.getByTestId("create-task-close")).toBeInTheDocument();
    });

    it("renders project selector field", async () => {
      const onClose = vi.fn();
      renderCreateTaskForm(true, onClose);

      await screen.findByTestId("create-task-project");
      expect(screen.getByTestId("create-task-project")).toBeInTheDocument();
    });

    it("renders title input field", async () => {
      const onClose = vi.fn();
      renderCreateTaskForm(true, onClose);

      await screen.findByTestId("create-task-title-input");
      expect(screen.getByTestId("create-task-title-input")).toBeInTheDocument();
    });

    it("renders description textarea", async () => {
      const onClose = vi.fn();
      renderCreateTaskForm(true, onClose);

      await screen.findByTestId("create-task-description");
      expect(screen.getByTestId("create-task-description")).toBeInTheDocument();
    });

    it("renders task type selector", async () => {
      const onClose = vi.fn();
      renderCreateTaskForm(true, onClose);

      await screen.findByTestId("create-task-type");
      expect(screen.getByTestId("create-task-type")).toBeInTheDocument();
    });

    it("renders requires approval checkbox", async () => {
      const onClose = vi.fn();
      renderCreateTaskForm(true, onClose);

      await screen.findByTestId("create-task-approval");
      expect(screen.getByTestId("create-task-approval")).toBeInTheDocument();
    });

    it("renders Cancel and Create Task buttons", async () => {
      const onClose = vi.fn();
      renderCreateTaskForm(true, onClose);

      await screen.findByTestId("create-task-cancel");
      await screen.findByTestId("create-task-submit");
      expect(screen.getByTestId("create-task-cancel")).toHaveTextContent("Cancel");
      expect(screen.getByTestId("create-task-submit")).toHaveTextContent("Create Task");
    });

    it("populates project selector with projects from API", async () => {
      const onClose = vi.fn();
      renderCreateTaskForm(true, onClose);

      // Wait for the project option to appear after API fetch
      const projectOption = await screen.findByRole("option", { name: "Mission Control" });
      expect(projectOption).toBeInTheDocument();

      const backendOption = screen.getByRole("option", { name: "Backend API" });
      expect(backendOption).toBeInTheDocument();
    });

    it("populates task type selector with all task types", async () => {
      const onClose = vi.fn();
      renderCreateTaskForm(true, onClose);

      await screen.findByTestId("create-task-type");
      const select = screen.getByTestId("create-task-type") as HTMLSelectElement;
      const options = Array.from(select.options);
      const typeNames = options.map((o) => o.textContent);
      expect(typeNames).toContain("Implementation");
      expect(typeNames).toContain("Bug Fix");
      expect(typeNames).toContain("Feature");
      expect(typeNames).toContain("Deployment");
      expect(typeNames).toContain("Documentation");
      expect(typeNames).toContain("Testing");
      expect(typeNames).toContain("Research");
      expect(typeNames).toContain("Other");
    });
  });

  describe("Form Validation", () => {
    it("shows error when submitting without a title", async () => {
      const onClose = vi.fn();
      const user = userEvent.setup();
      renderCreateTaskForm(true, onClose);

      // Wait for projects to load
      await screen.findByText("Mission Control");

      // Select project and task type
      await user.selectOptions(screen.getByTestId("create-task-project"), "proj-1");
      await user.selectOptions(screen.getByTestId("create-task-type"), "implementation");

      // Submit without title
      await user.click(screen.getByTestId("create-task-submit"));

      expect(screen.getByTestId("error-title")).toHaveTextContent("Title is required");
    });

    it("shows error when submitting without a project", async () => {
      const onClose = vi.fn();
      const user = userEvent.setup();
      renderCreateTaskForm(true, onClose);

      await screen.findByText("Mission Control");

      // Fill title and type but not project
      await user.type(screen.getByTestId("create-task-title-input"), "Test Task");
      await user.selectOptions(screen.getByTestId("create-task-type"), "implementation");

      await user.click(screen.getByTestId("create-task-submit"));

      expect(screen.getByTestId("error-project")).toHaveTextContent("Project is required");
    });

    it("shows error when submitting without a task type", async () => {
      const onClose = vi.fn();
      const user = userEvent.setup();
      renderCreateTaskForm(true, onClose);

      await screen.findByText("Mission Control");

      // Fill title and project but not type
      await user.type(screen.getByTestId("create-task-title-input"), "Test Task");
      await user.selectOptions(screen.getByTestId("create-task-project"), "proj-1");

      await user.click(screen.getByTestId("create-task-submit"));

      expect(screen.getByTestId("error-task-type")).toHaveTextContent(
        "Task type is required"
      );
    });

    it("shows multiple validation errors when all required fields are empty", async () => {
      const onClose = vi.fn();
      const user = userEvent.setup();
      renderCreateTaskForm(true, onClose);

      await screen.findByText("Mission Control");
      await user.click(screen.getByTestId("create-task-submit"));

      expect(screen.getByTestId("error-title")).toBeInTheDocument();
      expect(screen.getByTestId("error-project")).toBeInTheDocument();
      expect(screen.getByTestId("error-task-type")).toBeInTheDocument();
    });

    it("clears validation error when user fills in the field", async () => {
      const onClose = vi.fn();
      const user = userEvent.setup();
      renderCreateTaskForm(true, onClose);

      await screen.findByText("Mission Control");

      // Submit without filling any fields
      await user.click(screen.getByTestId("create-task-submit"));
      expect(screen.getByTestId("error-title")).toBeInTheDocument();

      // Type a title
      await user.type(screen.getByTestId("create-task-title-input"), "New Title");
      expect(screen.queryByTestId("error-title")).not.toBeInTheDocument();
    });
  });

  describe("Form Submission", () => {
    it("calls createTask API with correct data on valid submit", async () => {
      const onClose = vi.fn();
      const user = userEvent.setup();
      renderCreateTaskForm(true, onClose);

      await screen.findByText("Mission Control");

      // Fill form
      await user.selectOptions(screen.getByTestId("create-task-project"), "proj-1");
      await user.type(screen.getByTestId("create-task-title-input"), "Build auth system");
      await user.type(
        screen.getByTestId("create-task-description"),
        "Implement OAuth2 authentication"
      );
      await user.selectOptions(screen.getByTestId("create-task-type"), "implementation");

      // Submit
      await user.click(screen.getByTestId("create-task-submit"));

      // Wait for the API call
      await vi.waitFor(() => {
        const postCalls = mockFetch.mock.calls.filter(
          (call: unknown[]) => call[1]?.method === "POST"
        );
        expect(postCalls.length).toBeGreaterThan(0);
      });

      // Verify the request body from the POST call
      const postCalls = mockFetch.mock.calls.filter(
        (call: unknown[]) => call[1]?.method === "POST"
      );
      const lastPostCall = postCalls[postCalls.length - 1];
      const body = JSON.parse(lastPostCall[1].body);
      expect(body.title).toBe("Build auth system");
      expect(body.projectId).toBe("proj-1");
      expect(body.description).toBe("Implement OAuth2 authentication");
      expect(body.taskType).toBe("implementation");
      expect(body.requiresApproval).toBe(false);
    });

    it("calls onClose after successful task creation", async () => {
      const onClose = vi.fn();
      const user = userEvent.setup();
      renderCreateTaskForm(true, onClose);

      await screen.findByText("Mission Control");

      await user.selectOptions(screen.getByTestId("create-task-project"), "proj-1");
      await user.type(screen.getByTestId("create-task-title-input"), "Build auth system");
      await user.selectOptions(screen.getByTestId("create-task-type"), "implementation");

      await user.click(screen.getByTestId("create-task-submit"));

      // Wait for the mutation to complete and onClose to be called
      await vi.waitFor(() => {
        expect(onClose).toHaveBeenCalledTimes(1);
      });
    });

    it("shows error toast when API returns an error", async () => {
      const onClose = vi.fn();
      const user = userEvent.setup();
      renderCreateTaskForm(true, onClose, { createTaskError: true });

      await screen.findByText("Mission Control");

      await user.selectOptions(screen.getByTestId("create-task-project"), "proj-1");
      await user.type(screen.getByTestId("create-task-title-input"), "Build auth system");
      await user.selectOptions(screen.getByTestId("create-task-type"), "implementation");

      await user.click(screen.getByTestId("create-task-submit"));

      // Wait for error toast
      await vi.waitFor(() => {
        expect(screen.getByText("Validation failed")).toBeInTheDocument();
      });
    });

    it("shows 'Creating...' button text while submitting", async () => {
      const onClose = vi.fn();
      const user = userEvent.setup();

      // Set up a custom fetch that hangs on POST /api/tasks
      mockFetch.mockImplementation((url: string, init?: RequestInit) => {
        if (url.includes("/api/projects")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(mockProjects),
          });
        }
        // Make POST to tasks hang forever
        if (url.includes("/api/tasks") && init?.method === "POST") {
          return new Promise(() => {}); // never resolves
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve([]),
        });
      });

      const qc = createQueryClient();
      render(
        <QueryClientProvider client={qc}>
          <CreateTaskForm isOpen={true} onClose={onClose} />
        </QueryClientProvider>
      );

      await screen.findByText("Mission Control");

      await user.selectOptions(screen.getByTestId("create-task-project"), "proj-1");
      await user.type(screen.getByTestId("create-task-title-input"), "Build auth system");
      await user.selectOptions(screen.getByTestId("create-task-type"), "implementation");

      await user.click(screen.getByTestId("create-task-submit"));

      expect(screen.getByTestId("create-task-submit")).toHaveTextContent("Creating...");
    });

    it("includes requiresApproval when checkbox is checked", async () => {
      const onClose = vi.fn();
      const user = userEvent.setup();
      renderCreateTaskForm(true, onClose);

      await screen.findByText("Mission Control");

      await user.selectOptions(screen.getByTestId("create-task-project"), "proj-1");
      await user.type(screen.getByTestId("create-task-title-input"), "Deploy to prod");
      await user.selectOptions(screen.getByTestId("create-task-type"), "deployment");
      await user.click(screen.getByTestId("create-task-approval"));

      await user.click(screen.getByTestId("create-task-submit"));

      await vi.waitFor(() => {
        const postCalls = mockFetch.mock.calls.filter(
          (call: unknown[]) => call[1]?.method === "POST"
        );
        expect(postCalls.length).toBeGreaterThan(0);
        const body = JSON.parse(postCalls[postCalls.length - 1][1].body);
        expect(body.requiresApproval).toBe(true);
      });
    });
  });

  describe("Close Behavior", () => {
    it("calls onClose when close button is clicked", async () => {
      const onClose = vi.fn();
      const user = userEvent.setup();
      renderCreateTaskForm(true, onClose);

      await screen.findByTestId("create-task-close");
      await user.click(screen.getByTestId("create-task-close"));

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("calls onClose when Cancel button is clicked", async () => {
      const onClose = vi.fn();
      const user = userEvent.setup();
      renderCreateTaskForm(true, onClose);

      await screen.findByTestId("create-task-cancel");
      await user.click(screen.getByTestId("create-task-cancel"));

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("calls onClose when Escape key is pressed", async () => {
      const onClose = vi.fn();
      renderCreateTaskForm(true, onClose);

      await screen.findByTestId("create-task-modal");
      fireEvent.keyDown(screen.getByTestId("create-task-modal"), {
        key: "Escape",
      });

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("calls onClose when overlay is clicked", async () => {
      const onClose = vi.fn();
      renderCreateTaskForm(true, onClose);

      await screen.findByTestId("create-task-modal");
      fireEvent.click(screen.getByTestId("create-task-modal"));

      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe("Form Reset", () => {
    it("resets form fields when reopened", async () => {
      const onClose = vi.fn();
      const user = userEvent.setup();
      const qc = createQueryClient();

      mockFetch.mockImplementation((url: string, init?: RequestInit) => {
        if (url.includes("/api/projects") && (!init || init.method !== "POST")) {
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

      const { rerender } = render(
        <QueryClientProvider client={qc}>
          <CreateTaskForm isOpen={true} onClose={onClose} />
        </QueryClientProvider>
      );

      await screen.findByText("Mission Control");

      // Fill in the form
      await user.type(screen.getByTestId("create-task-title-input"), "Some title");
      await user.selectOptions(screen.getByTestId("create-task-project"), "proj-1");
      await user.selectOptions(screen.getByTestId("create-task-type"), "feature");

      // Re-render with isOpen=false then isOpen=true
      rerender(
        <QueryClientProvider client={qc}>
          <CreateTaskForm isOpen={false} onClose={onClose} />
        </QueryClientProvider>
      );

      // Wait for unmount
      expect(screen.queryByTestId("create-task-modal")).not.toBeInTheDocument();

      // Re-render with isOpen=true
      rerender(
        <QueryClientProvider client={qc}>
          <CreateTaskForm isOpen={true} onClose={onClose} />
        </QueryClientProvider>
      );

      await screen.findByTestId("create-task-title-input");
      const titleInput = screen.getByTestId("create-task-title-input") as HTMLInputElement;
      expect(titleInput.value).toBe("");
      const projectSelect = screen.getByTestId("create-task-project") as HTMLSelectElement;
      expect(projectSelect.value).toBe("");
      const typeSelect = screen.getByTestId("create-task-type") as HTMLSelectElement;
      expect(typeSelect.value).toBe("");
    });
  });

  describe("Accessibility", () => {
    it("has role=dialog on modal", async () => {
      const onClose = vi.fn();
      renderCreateTaskForm(true, onClose);

      await screen.findByTestId("create-task-modal");
      expect(screen.getByTestId("create-task-modal")).toHaveAttribute("role", "dialog");
    });

    it("has aria-modal=true on modal", async () => {
      const onClose = vi.fn();
      renderCreateTaskForm(true, onClose);

      await screen.findByTestId("create-task-modal");
      expect(screen.getByTestId("create-task-modal")).toHaveAttribute(
        "aria-modal",
        "true"
      );
    });

    it("has aria-label on modal", async () => {
      const onClose = vi.fn();
      renderCreateTaskForm(true, onClose);

      await screen.findByTestId("create-task-modal");
      expect(screen.getByTestId("create-task-modal")).toHaveAttribute(
        "aria-label",
        "Create new task"
      );
    });

    it("close button has aria-label", async () => {
      const onClose = vi.fn();
      renderCreateTaskForm(true, onClose);

      await screen.findByTestId("create-task-close");
      expect(screen.getByTestId("create-task-close")).toHaveAttribute(
        "aria-label",
        "Close"
      );
    });

    it("has aria-required on required fields", async () => {
      const onClose = vi.fn();
      renderCreateTaskForm(true, onClose);

      await screen.findByTestId("create-task-project");
      expect(screen.getByTestId("create-task-project")).toHaveAttribute("aria-required", "true");
      expect(screen.getByTestId("create-task-title-input")).toHaveAttribute("aria-required", "true");
      expect(screen.getByTestId("create-task-type")).toHaveAttribute("aria-required", "true");
    });
  });
});
