import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";

describe("CLI Show Command", () => {
  const testHome = join(process.cwd(), "test-cli-home-show");

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
    test("should have show command registered", async () => {
      const { program } = await import("../src/index");

      const commands = program.commands.map(cmd => cmd.name());
      expect(commands).toContain("show");
    });

    test("show command should require task_id argument", async () => {
      const { program } = await import("../src/index");

      const showCmd = program.commands.find(cmd => cmd.name() === "show");
      expect(showCmd).toBeDefined();

      // Check that the command has an argument registered via Commander.js _args
      const cmdArgs = (showCmd as unknown as { _args: Array<{ required: boolean; name: string }> })._args;
      expect(cmdArgs.length).toBeGreaterThan(0);
      expect(cmdArgs[0]!.required).toBe(true);
    });
  });

  describe("API Client", () => {
    test("should export getTask function", async () => {
      const { getTask } = await import("../src/client");
      expect(typeof getTask).toBe("function");
    });

    test("getTask should accept taskId parameter", async () => {
      const { getTask } = await import("../src/client");

      // Verify function signature by checking it doesn't throw on valid args
      expect(() => {
        getTask("550e8400-e29b-41d4-a716-446655440000");
      }).not.toThrow();
    });

    test("should export getAgent function", async () => {
      const { getAgent } = await import("../src/client");
      expect(typeof getAgent).toBe("function");
    });

    test("should export getProject function", async () => {
      const { getProject } = await import("../src/client");
      expect(typeof getProject).toBe("function");
    });
  });

  describe("Output formatting", () => {
    test("should format task details with all fields", async () => {
      const { formatTaskDetails } = await import("../src/commands/show");

      const task = {
        id: "550e8400-e29b-41d4-a716-446655440001",
        title: "Test Task",
        description: "This is a test task description",
        status: "in_progress" as const,
        taskType: "implementation" as const,
        projectId: "550e8400-e29b-41d4-a716-446655440002",
        agentId: "550e8400-e29b-41d4-a716-446655440003",
        requiresApproval: false,
        createdAt: "2026-03-13T12:00:00.000Z",
        updatedAt: "2026-03-13T14:00:00.000Z",
        claimedAt: "2026-03-13T13:00:00.000Z",
      };

      const agentName = "Test Agent";
      const projectName = "Test Project";

      const result = formatTaskDetails(task, agentName, projectName);
      expect(result).toContain("Test Task");
      expect(result).toContain("in_progress");
      expect(result).toContain("Test Agent");
      expect(result).toContain("Test Project");
      expect(result).toContain("implementation");
    });

    test("should show 'Unclaimed' when task has no agent", async () => {
      const { formatTaskDetails } = await import("../src/commands/show");

      const task = {
        id: "550e8400-e29b-41d4-a716-446655440001",
        title: "Test Task",
        description: null,
        status: "backlog" as const,
        taskType: "bugfix" as const,
        projectId: "550e8400-e29b-41d4-a716-446655440002",
        agentId: null,
        requiresApproval: false,
        createdAt: "2026-03-13T12:00:00.000Z",
        updatedAt: "2026-03-13T12:00:00.000Z",
        claimedAt: null,
      };

      const result = formatTaskDetails(task, null, "Test Project");
      expect(result).toContain("Unclaimed");
      expect(result).not.toContain("null");
    });

    test("should format dates in readable format", async () => {
      const { formatTaskDetails } = await import("../src/commands/show");

      const task = {
        id: "550e8400-e29b-41d4-a716-446655440001",
        title: "Test Task",
        description: null,
        status: "backlog" as const,
        taskType: "feature" as const,
        projectId: "550e8400-e29b-41d4-a716-446655440002",
        agentId: null,
        requiresApproval: false,
        createdAt: "2026-03-13T12:00:00.000Z",
        updatedAt: "2026-03-13T14:30:00.000Z",
        claimedAt: null,
      };

      const result = formatTaskDetails(task, null, "Test Project");
      // Should contain formatted date like "Mar 13, 2026"
      expect(result).toContain("Mar");
      expect(result).toContain("2026");
    });

    test("should show description when present", async () => {
      const { formatTaskDetails } = await import("../src/commands/show");

      const task = {
        id: "550e8400-e29b-41d4-a716-446655440001",
        title: "Test Task",
        description: "This is the task description",
        status: "backlog" as const,
        taskType: "feature" as const,
        projectId: "550e8400-e29b-41d4-a716-446655440002",
        agentId: null,
        requiresApproval: false,
        createdAt: "2026-03-13T12:00:00.000Z",
        updatedAt: "2026-03-13T12:00:00.000Z",
        claimedAt: null,
      };

      const result = formatTaskDetails(task, null, "Test Project");
      expect(result).toContain("This is the task description");
    });

    test("should show 'No description' when description is null", async () => {
      const { formatTaskDetails } = await import("../src/commands/show");

      const task = {
        id: "550e8400-e29b-41d4-a716-446655440001",
        title: "Test Task",
        description: null,
        status: "backlog" as const,
        taskType: "feature" as const,
        projectId: "550e8400-e29b-41d4-a716-446655440002",
        agentId: null,
        requiresApproval: false,
        createdAt: "2026-03-13T12:00:00.000Z",
        updatedAt: "2026-03-13T12:00:00.000Z",
        claimedAt: null,
      };

      const result = formatTaskDetails(task, null, "Test Project");
      expect(result).toContain("No description");
    });
  });

  describe("Error handling", () => {
    test("should format API errors with clear messages", async () => {
      const { formatShowError } = await import("../src/commands/show");

      const error = new Error("Connection refused");
      const result = formatShowError(error);

      expect(result).toContain("Error");
    });

    test("should handle 404 error when task not found", async () => {
      const { formatShowError } = await import("../src/commands/show");

      const error = {
        response: {
          status: 404,
          data: { error: "Task not found" },
        },
      };

      const result = formatShowError(error);
      expect(result).toContain("not found");
    });

    test("should handle invalid UUID format", async () => {
      const { executeShow } = await import("../src/commands/show");

      const exitCode = await executeShow("invalid-uuid");
      expect(exitCode).toBe(1);
    });
  });
});
