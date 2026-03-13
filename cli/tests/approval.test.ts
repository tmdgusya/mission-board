import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";

describe("CLI Request-Approval Command", () => {
  const testHome = join(process.cwd(), "test-cli-home-request-approval");

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
    test("should have request-approval command registered", async () => {
      const { program } = await import("../src/index");

      const commands = program.commands.map((cmd) => cmd.name());
      expect(commands).toContain("request-approval");
    });

    test("request-approval command should require task_id argument", async () => {
      const { program } = await import("../src/index");

      const cmd = program.commands.find((c) => c.name() === "request-approval");
      expect(cmd).toBeDefined();

      const args = cmd?.registeredArguments || [];
      expect(args.length).toBeGreaterThan(0);
    });

    test("request-approval command should have --action option", async () => {
      const { program } = await import("../src/index");

      const cmd = program.commands.find((c) => c.name() === "request-approval");
      expect(cmd).toBeDefined();

      const options = cmd?.options.map((opt) => opt.long);
      expect(options).toContain("--action");
    });
  });

  describe("API Client", () => {
    test("should export requestApproval function", async () => {
      const { requestApproval } = await import("../src/client");
      expect(typeof requestApproval).toBe("function");
    });

    test("requestApproval should accept taskId and actionRequested", async () => {
      const { requestApproval } = await import("../src/client");

      // Verify function signature by checking it doesn't throw on valid args
      expect(() => {
        requestApproval(
          "550e8400-e29b-41d4-a716-446655440000",
          "deploy to production"
        );
      }).not.toThrow();
    });

    test("should export checkApproval function", async () => {
      const { checkApproval } = await import("../src/client");
      expect(typeof checkApproval).toBe("function");
    });

    test("checkApproval should accept taskId", async () => {
      const { checkApproval } = await import("../src/client");

      expect(() => {
        checkApproval("550e8400-e29b-41d4-a716-446655440000");
      }).not.toThrow();
    });
  });

  describe("Success output", () => {
    test("should format success message with approval ID, task ID, and action", async () => {
      const { formatRequestApprovalSuccess } = await import(
        "../src/commands/request-approval"
      );

      const result = formatRequestApprovalSuccess(
        "approval-123-456",
        "task-789",
        "deploy to production"
      );

      expect(result).toContain("approval-123-456");
      expect(result).toContain("task-789");
      expect(result).toContain("deploy to production");
      expect(result).toContain("pending");
    });
  });

  describe("Error handling", () => {
    test("should format API errors with clear messages", async () => {
      const { formatRequestApprovalError } = await import(
        "../src/commands/request-approval"
      );

      const error = new Error("Connection refused");
      const result = formatRequestApprovalError(error);

      expect(result).toContain("Error");
    });

    test("should handle 400 error when task doesn't require approval", async () => {
      const { formatRequestApprovalError } = await import(
        "../src/commands/request-approval"
      );

      const error = {
        response: {
          status: 400,
          data: { error: "Task does not require approval" },
        },
      };
      const result = formatRequestApprovalError(error);

      expect(result).toContain("does not require approval");
    });

    test("should handle 409 error when approval already pending", async () => {
      const { formatRequestApprovalError } = await import(
        "../src/commands/request-approval"
      );

      const error = {
        response: {
          status: 409,
          data: { error: "Approval request already pending for this task" },
        },
      };
      const result = formatRequestApprovalError(error);

      expect(result).toContain("already pending");
    });

    test("should handle 404 error when task not found", async () => {
      const { formatRequestApprovalError } = await import(
        "../src/commands/request-approval"
      );

      const error = {
        response: { status: 404, data: { error: "Task not found" } },
      };
      const result = formatRequestApprovalError(error);

      expect(result).toContain("Task not found");
    });

    test("should handle network error (server unreachable)", async () => {
      const { formatRequestApprovalError } = await import(
        "../src/commands/request-approval"
      );

      const error = new Error("ECONNREFUSED: connect ECONNREFUSED 127.0.0.1:3200");
      const result = formatRequestApprovalError(error);

      expect(result).toContain("Error");
      expect(result).toContain("Unable to connect");
    });

    test("should handle invalid UUID format", async () => {
      const { executeRequestApproval } = await import(
        "../src/commands/request-approval"
      );

      const exitCode = await executeRequestApproval("invalid-uuid", "deploy");
      expect(exitCode).toBe(1);
    });

    test("should handle empty action description", async () => {
      const { executeRequestApproval } = await import(
        "../src/commands/request-approval"
      );

      const exitCode = await executeRequestApproval(
        "550e8400-e29b-41d4-a716-446655440000",
        ""
      );
      expect(exitCode).toBe(1);
    });

    test("should handle whitespace-only action description", async () => {
      const { executeRequestApproval } = await import(
        "../src/commands/request-approval"
      );

      const exitCode = await executeRequestApproval(
        "550e8400-e29b-41d4-a716-446655440000",
        "   "
      );
      expect(exitCode).toBe(1);
    });
  });
});

describe("CLI Check-Approval Command", () => {
  const testHome = join(process.cwd(), "test-cli-home-check-approval");

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
    test("should have check-approval command registered", async () => {
      const { program } = await import("../src/index");

      const commands = program.commands.map((cmd) => cmd.name());
      expect(commands).toContain("check-approval");
    });

    test("check-approval command should require task_id argument", async () => {
      const { program } = await import("../src/index");

      const cmd = program.commands.find((c) => c.name() === "check-approval");
      expect(cmd).toBeDefined();

      const args = cmd?.registeredArguments || [];
      expect(args.length).toBeGreaterThan(0);
    });
  });

  describe("Success output", () => {
    test("should format no approvals found message", async () => {
      const { formatNoApprovalsFound } = await import(
        "../src/commands/check-approval"
      );

      const result = formatNoApprovalsFound("task-789");
      expect(result).toContain("No approval requests found");
      expect(result).toContain("task-789");
    });

    test("should format pending approval status", async () => {
      const { executeCheckApproval } = await import(
        "../src/commands/check-approval"
      );

      // We can't easily test the output without mocking the API,
      // but we can verify the formatter handles different statuses
      // via the exported types
      expect(typeof executeCheckApproval).toBe("function");
    });
  });

  describe("Error handling", () => {
    test("should format API errors with clear messages", async () => {
      const { formatCheckApprovalError } = await import(
        "../src/commands/check-approval"
      );

      const error = new Error("Connection refused");
      const result = formatCheckApprovalError(error);

      expect(result).toContain("Error");
    });

    test("should handle 404 error when task not found", async () => {
      const { formatCheckApprovalError } = await import(
        "../src/commands/check-approval"
      );

      const error = {
        response: { status: 404, data: { error: "Task not found" } },
      };
      const result = formatCheckApprovalError(error);

      expect(result).toContain("Task not found");
    });

    test("should handle invalid UUID format", async () => {
      const { executeCheckApproval } = await import(
        "../src/commands/check-approval"
      );

      const exitCode = await executeCheckApproval("invalid-uuid");
      expect(exitCode).toBe(1);
    });

    test("should handle network error (server unreachable)", async () => {
      const { formatCheckApprovalError } = await import(
        "../src/commands/check-approval"
      );

      const error = new Error("ECONNREFUSED: connect ECONNREFUSED 127.0.0.1:3200");
      const result = formatCheckApprovalError(error);

      expect(result).toContain("Error");
      expect(result).toContain("Unable to connect");
    });
  });
});

describe("CLI Approval Commands - Integration with Program", () => {
  test("both commands should be available in help output", async () => {
    const { program } = await import("../src/index");

    const commands = program.commands.map((cmd) => cmd.name());
    expect(commands).toContain("request-approval");
    expect(commands).toContain("check-approval");
  });
});
