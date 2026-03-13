import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";

describe("CLI List Command", () => {
  const testHome = join(process.cwd(), "test-cli-home-list");

  beforeEach(async () => {
    process.env.HOME = testHome;
    process.env.USERPROFILE = testHome;

    try {
      await rm(testHome, { recursive: true, force: true });
    } catch {
      // Ignore
    }
    await mkdir(testHome, { recursive: true });
  });

  afterEach(async () => {
    delete process.env.HOME;
    delete process.env.USERPROFILE;

    try {
      await rm(testHome, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  });

  describe("Command parsing", () => {
    test("should have list command registered", async () => {
      const { program } = await import("../src/index");

      const commands = program.commands.map(cmd => cmd.name());
      expect(commands).toContain("list");
    });

    test("list command should have --project option", async () => {
      const { program } = await import("../src/index");

      const listCmd = program.commands.find(cmd => cmd.name() === "list");
      expect(listCmd).toBeDefined();

      const options = listCmd?.options.map(opt => opt.long);
      expect(options).toContain("--project");
    });

    test("list command should have --status option", async () => {
      const { program } = await import("../src/index");

      const listCmd = program.commands.find(cmd => cmd.name() === "list");
      expect(listCmd).toBeDefined();

      const options = listCmd?.options.map(opt => opt.long);
      expect(options).toContain("--status");
    });
  });

  describe("API Client", () => {
    test("should export listTasks function", async () => {
      const { listTasks } = await import("../src/client");
      expect(typeof listTasks).toBe("function");
    });

    test("listTasks should accept optional filters", async () => {
      const { listTasks } = await import("../src/client");

      // Verify function signature by checking it doesn't throw on valid args
      expect(() => {
        listTasks({});
      }).not.toThrow();

      expect(() => {
        listTasks({ projectId: "550e8400-e29b-41d4-a716-446655440000" });
      }).not.toThrow();

      expect(() => {
        listTasks({ status: "in_progress" });
      }).not.toThrow();

      expect(() => {
        listTasks({ projectId: "550e8400-e29b-41d4-a716-446655440000", status: "backlog" });
      }).not.toThrow();
    });
  });

  describe("Output formatting", () => {
    test("should format task list as table", async () => {
      const { formatTaskList } = await import("../src/commands/list");

      const tasks = [
        {
          id: "task-1",
          title: "Task One",
          status: "in_progress" as const,
          taskType: "implementation" as const,
          projectId: "proj-1",
          agentId: "agent-1",
          description: null,
          requiresApproval: false,
          createdAt: "2026-03-13T12:00:00.000Z",
          updatedAt: "2026-03-13T12:00:00.000Z",
          claimedAt: null,
        },
        {
          id: "task-2",
          title: "Task Two",
          status: "backlog" as const,
          taskType: "bugfix" as const,
          projectId: "proj-1",
          agentId: null,
          description: null,
          requiresApproval: false,
          createdAt: "2026-03-13T12:00:00.000Z",
          updatedAt: "2026-03-13T12:00:00.000Z",
          claimedAt: null,
        },
      ];

      const result = formatTaskList(tasks);
      expect(result).toContain("Task One");
      expect(result).toContain("Task Two");
      expect(result).toContain("in_progress");
      expect(result).toContain("backlog");
    });

    test("should handle empty task list", async () => {
      const { formatTaskList } = await import("../src/commands/list");

      const result = formatTaskList([]);
      expect(result).toContain("No tasks found");
    });
  });

  describe("Error handling", () => {
    test("should format API errors with clear messages", async () => {
      const { formatListError } = await import("../src/commands/list");

      const error = new Error("Connection refused");
      const result = formatListError(error);

      expect(result).toContain("Error");
    });

    test("should handle invalid status filter", async () => {
      const { executeList } = await import("../src/commands/list");

      const exitCode = await executeList({ status: "invalid_status" });
      expect(exitCode).toBe(1);
    });

    test("should handle invalid project ID format", async () => {
      const { executeList } = await import("../src/commands/list");

      const exitCode = await executeList({ project: "invalid-uuid" });
      expect(exitCode).toBe(1);
    });
  });
});

describe("CLI Projects Command", () => {
  const testHome = join(process.cwd(), "test-cli-home-projects");

  beforeEach(async () => {
    process.env.HOME = testHome;
    process.env.USERPROFILE = testHome;

    try {
      await rm(testHome, { recursive: true, force: true });
    } catch {
      // Ignore
    }
    await mkdir(testHome, { recursive: true });
  });

  afterEach(async () => {
    delete process.env.HOME;
    delete process.env.USERPROFILE;

    try {
      await rm(testHome, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  });

  describe("Command parsing", () => {
    test("should have projects command registered", async () => {
      const { program } = await import("../src/index");

      const commands = program.commands.map(cmd => cmd.name());
      expect(commands).toContain("projects");
    });
  });

  describe("API Client", () => {
    test("should export listProjects function", async () => {
      const { listProjects } = await import("../src/client");
      expect(typeof listProjects).toBe("function");
    });
  });

  describe("Output formatting", () => {
    test("should format project list as table", async () => {
      const { formatProjectList } = await import("../src/commands/list");

      const projects = [
        {
          id: "550e8400-e29b-41d4-a716-446655440001",
          name: "Project Alpha",
          description: "First project",
          createdAt: "2026-03-13T12:00:00.000Z",
          updatedAt: "2026-03-13T12:00:00.000Z",
        },
        {
          id: "550e8400-e29b-41d4-a716-446655440002",
          name: "Project Beta",
          description: null,
          createdAt: "2026-03-13T12:00:00.000Z",
          updatedAt: "2026-03-13T12:00:00.000Z",
        },
      ];

      const result = formatProjectList(projects);
      expect(result).toContain("Project Alpha");
      expect(result).toContain("Project Beta");
      expect(result).toContain("550e8400-e29b-41d4-a716-446655440001");
    });

    test("should handle empty project list", async () => {
      const { formatProjectList } = await import("../src/commands/list");

      const result = formatProjectList([]);
      expect(result).toContain("No projects found");
    });
  });

  describe("Error handling", () => {
    test("should format API errors with clear messages", async () => {
      const { formatProjectsError } = await import("../src/commands/list");

      const error = new Error("Connection refused");
      const result = formatProjectsError(error);

      expect(result).toContain("Error");
    });
  });
});
