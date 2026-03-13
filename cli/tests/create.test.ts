import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";

describe("CLI Create Command", () => {
  const testHome = join(process.cwd(), "test-cli-home-create");

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
    test("should have create command registered", async () => {
      const { program } = await import("../src/index");

      const commands = program.commands.map(cmd => cmd.name());
      expect(commands).toContain("create");
    });

    test("create command should have required options", async () => {
      const { program } = await import("../src/index");

      const createCmd = program.commands.find(cmd => cmd.name() === "create");
      expect(createCmd).toBeDefined();

      const options = createCmd?.options.map(opt => opt.long);
      expect(options).toContain("--project");
      expect(options).toContain("--title");
      expect(options).toContain("--type");
    });

    test("create command should have optional description option", async () => {
      const { program } = await import("../src/index");

      const createCmd = program.commands.find(cmd => cmd.name() === "create");
      expect(createCmd).toBeDefined();

      const options = createCmd?.options.map(opt => opt.long);
      expect(options).toContain("--description");
    });
  });

  describe("API Client", () => {
    test("should export createTask function", async () => {
      const { createTask } = await import("../src/client");
      expect(typeof createTask).toBe("function");
    });

    test("createTask should accept projectId, title, taskType, and optional description", async () => {
      const { createTask } = await import("../src/client");

      // Verify function signature by checking it doesn't throw on valid args
      // (actual API call will fail since server isn't running)
      expect(() => {
        createTask({
          projectId: "550e8400-e29b-41d4-a716-446655440000",
          title: "Test Task",
          taskType: "implementation",
          description: "Test description",
        });
      }).not.toThrow();
    });
  });

  describe("Success output", () => {
    test("should format success message with task ID", async () => {
      const { formatCreateSuccess } = await import("../src/commands/create");

      const result = formatCreateSuccess("task-123-456");
      expect(result).toContain("task-123-456");
      expect(result).toContain("created");
    });
  });

  describe("Error handling", () => {
    test("should format API errors with clear messages", async () => {
      const { formatApiError } = await import("../src/commands/create");

      const error = new Error("Connection refused");
      const result = formatApiError(error);

      expect(result).toContain("Error");
    });

    test("should handle validation errors from API", async () => {
      const { formatApiError } = await import("../src/commands/create");

      const error = { response: { status: 400, data: { error: "Validation failed", details: [{ message: "Title is required" }] } } };
      const result = formatApiError(error);

      expect(result).toContain("Validation failed");
    });

    test("should handle project not found error", async () => {
      const { formatApiError } = await import("../src/commands/create");

      const error = { response: { status: 404, data: { error: "Project not found" } } };
      const result = formatApiError(error);

      expect(result).toContain("Project not found");
    });
  });
});
