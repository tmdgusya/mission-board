import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";

describe("CLI Claim Command", () => {
  const testHome = join(process.cwd(), "test-cli-home-claim");

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
    test("should have claim command registered", async () => {
      const { program } = await import("../src/index");

      const commands = program.commands.map(cmd => cmd.name());
      expect(commands).toContain("claim");
    });

    test("claim command should require task_id argument", async () => {
      const { program } = await import("../src/index");

      const claimCmd = program.commands.find(cmd => cmd.name() === "claim");
      expect(claimCmd).toBeDefined();

      // Check that the command has arguments registered
      const args = claimCmd?.registeredArguments || [];
      expect(args.length).toBeGreaterThan(0);
    });
  });

  describe("API Client", () => {
    test("should export claimTask function", async () => {
      const { claimTask } = await import("../src/client");
      expect(typeof claimTask).toBe("function");
    });

    test("claimTask should accept taskId", async () => {
      const { claimTask } = await import("../src/client");

      // Verify function signature by checking it doesn't throw on valid args
      // (actual API call will fail since server isn't running)
      expect(() => {
        claimTask("550e8400-e29b-41d4-a716-446655440000");
      }).not.toThrow();
    });
  });

  describe("Success output", () => {
    test("should format success message with task ID", async () => {
      const { formatClaimSuccess } = await import("../src/commands/claim");

      const result = formatClaimSuccess("task-123-456");
      expect(result).toContain("task-123-456");
      expect(result).toContain("claimed");
    });
  });

  describe("Error handling", () => {
    test("should format API errors with clear messages", async () => {
      const { formatClaimError } = await import("../src/commands/claim");

      const error = new Error("Connection refused");
      const result = formatClaimError(error);

      expect(result).toContain("Error");
    });

    test("should handle 409 conflict error when task already claimed", async () => {
      const { formatClaimError } = await import("../src/commands/claim");

      const error = {
        response: {
          status: 409,
          data: {
            error: "Task is already claimed by another agent",
            currentOwner: { agentId: "agent-456", claimedAt: "2026-03-13T12:00:00Z" }
          }
        }
      };
      const result = formatClaimError(error);

      expect(result).toContain("already claimed");
      expect(result).toContain("agent-456");
    });

    test("should handle 404 error when task not found", async () => {
      const { formatClaimError } = await import("../src/commands/claim");

      const error = { response: { status: 404, data: { error: "Task not found" } } };
      const result = formatClaimError(error);

      expect(result).toContain("Task not found");
    });

    test("should handle invalid UUID format", async () => {
      const { executeClaim } = await import("../src/commands/claim");

      const exitCode = await executeClaim("invalid-uuid");
      expect(exitCode).toBe(1);
    });
  });
});

describe("CLI Update Command", () => {
  const testHome = join(process.cwd(), "test-cli-home-update");

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
    test("should have update command registered", async () => {
      const { program } = await import("../src/index");

      const commands = program.commands.map(cmd => cmd.name());
      expect(commands).toContain("update");
    });

    test("update command should have --status option", async () => {
      const { program } = await import("../src/index");

      const updateCmd = program.commands.find(cmd => cmd.name() === "update");
      expect(updateCmd).toBeDefined();

      const options = updateCmd?.options.map(opt => opt.long);
      expect(options).toContain("--status");
    });

    test("update command should require task_id argument", async () => {
      const { program } = await import("../src/index");

      const updateCmd = program.commands.find(cmd => cmd.name() === "update");
      expect(updateCmd).toBeDefined();

      // Check that the command has arguments registered
      const args = updateCmd?.registeredArguments || [];
      expect(args.length).toBeGreaterThan(0);
    });
  });

  describe("API Client", () => {
    test("should export updateTask function", async () => {
      const { updateTask } = await import("../src/client");
      expect(typeof updateTask).toBe("function");
    });

    test("updateTask should accept taskId and updates object", async () => {
      const { updateTask } = await import("../src/client");

      // Verify function signature by checking it doesn't throw on valid args
      expect(() => {
        updateTask("550e8400-e29b-41d4-a716-446655440000", { status: "ready" });
      }).not.toThrow();
    });
  });

  describe("Success output", () => {
    test("should format success message with task ID and status", async () => {
      const { formatUpdateSuccess } = await import("../src/commands/update");

      const result = formatUpdateSuccess("task-123-456", "ready");
      expect(result).toContain("task-123-456");
      expect(result).toContain("ready");
    });
  });

  describe("Error handling", () => {
    test("should format API errors with clear messages", async () => {
      const { formatUpdateError } = await import("../src/commands/update");

      const error = new Error("Connection refused");
      const result = formatUpdateError(error);

      expect(result).toContain("Error");
    });

    test("should handle 400 error for invalid status transition", async () => {
      const { formatUpdateError } = await import("../src/commands/update");

      const error = {
        response: {
          status: 400,
          data: { error: 'Invalid status transition from "backlog" to "done"' }
        }
      };
      const result = formatUpdateError(error);

      expect(result).toContain("Invalid status transition");
    });

    test("should handle invalid status value", async () => {
      const { executeUpdate } = await import("../src/commands/update");

      const exitCode = await executeUpdate("550e8400-e29b-41d4-a716-446655440000", { status: "invalid_status" });
      expect(exitCode).toBe(1);
    });

    test("should handle invalid UUID format", async () => {
      const { executeUpdate } = await import("../src/commands/update");

      const exitCode = await executeUpdate("invalid-uuid", { status: "ready" });
      expect(exitCode).toBe(1);
    });
  });
});

describe("CLI Release Command", () => {
  const testHome = join(process.cwd(), "test-cli-home-release");

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
    test("should have release command registered", async () => {
      const { program } = await import("../src/index");

      const commands = program.commands.map(cmd => cmd.name());
      expect(commands).toContain("release");
    });

    test("release command should require task_id argument", async () => {
      const { program } = await import("../src/index");

      const releaseCmd = program.commands.find(cmd => cmd.name() === "release");
      expect(releaseCmd).toBeDefined();

      // Check that the command has arguments registered
      const args = releaseCmd?.registeredArguments || [];
      expect(args.length).toBeGreaterThan(0);
    });
  });

  describe("API Client", () => {
    test("should export releaseTask function", async () => {
      const { releaseTask } = await import("../src/client");
      expect(typeof releaseTask).toBe("function");
    });

    test("releaseTask should accept taskId", async () => {
      const { releaseTask } = await import("../src/client");

      // Verify function signature by checking it doesn't throw on valid args
      expect(() => {
        releaseTask("550e8400-e29b-41d4-a716-446655440000");
      }).not.toThrow();
    });
  });

  describe("Success output", () => {
    test("should format success message with task ID", async () => {
      const { formatReleaseSuccess } = await import("../src/commands/release");

      const result = formatReleaseSuccess("task-123-456");
      expect(result).toContain("task-123-456");
      expect(result).toContain("released");
    });
  });

  describe("Error handling", () => {
    test("should format API errors with clear messages", async () => {
      const { formatReleaseError } = await import("../src/commands/release");

      const error = new Error("Connection refused");
      const result = formatReleaseError(error);

      expect(result).toContain("Error");
    });

    test("should handle 404 error when task not found", async () => {
      const { formatReleaseError } = await import("../src/commands/release");

      const error = { response: { status: 404, data: { error: "Task not found" } } };
      const result = formatReleaseError(error);

      expect(result).toContain("Task not found");
    });

    test("should handle invalid UUID format", async () => {
      const { executeRelease } = await import("../src/commands/release");

      const exitCode = await executeRelease("invalid-uuid");
      expect(exitCode).toBe(1);
    });
  });
});
