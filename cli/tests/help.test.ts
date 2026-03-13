import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { program } from "../src/index";

describe("CLI Help and Error Handling", () => {
  describe("VAL-CLI-001: CLI help and usage", () => {
    test("mission --help shows all commands", () => {
      const commands = program.commands.map((cmd) => cmd.name());

      // All expected commands should be present
      expect(commands).toContain("init");
      expect(commands).toContain("config");
      expect(commands).toContain("set-agent");
      expect(commands).toContain("create");
      expect(commands).toContain("list");
      expect(commands).toContain("projects");
      expect(commands).toContain("claim");
      expect(commands).toContain("update");
      expect(commands).toContain("release");
      expect(commands).toContain("show");
    });

    test("program has description", () => {
      expect(program.description()).toBeTruthy();
      expect(program.description().length).toBeGreaterThan(10);
    });

    test("create command has help description", () => {
      const createCmd = program.commands.find((c) => c.name() === "create");
      expect(createCmd).toBeDefined();
      expect(createCmd!.description()).toBeTruthy();
      expect(createCmd!.description().length).toBeGreaterThan(10);
    });

    test("create command shows required options in help", () => {
      const createCmd = program.commands.find((c) => c.name() === "create");
      expect(createCmd).toBeDefined();
      const options = createCmd!.options.map((o) => o.flags);
      expect(options).toContain("--project <project-id>");
      expect(options).toContain("--title <title>");
      expect(options).toContain("--type <type>");
      expect(options).toContain("--description <description>");
    });

    test("list command has help description", () => {
      const listCmd = program.commands.find((c) => c.name() === "list");
      expect(listCmd).toBeDefined();
      expect(listCmd!.description()).toBeTruthy();
    });

    test("list command shows filter options in help", () => {
      const listCmd = program.commands.find((c) => c.name() === "list");
      expect(listCmd).toBeDefined();
      const options = listCmd!.options.map((o) => o.flags);
      expect(options).toContain("--project <project-id>");
      expect(options).toContain("--status <status>");
    });

    test("claim command has help description", () => {
      const claimCmd = program.commands.find((c) => c.name() === "claim");
      expect(claimCmd).toBeDefined();
      expect(claimCmd!.description()).toBeTruthy();
    });

    test("update command has help description and options", () => {
      const updateCmd = program.commands.find((c) => c.name() === "update");
      expect(updateCmd).toBeDefined();
      expect(updateCmd!.description()).toBeTruthy();
      const options = updateCmd!.options.map((o) => o.flags);
      expect(options).toContain("--status <status>");
      expect(options).toContain("--title <title>");
      expect(options).toContain("--description <description>");
    });

    test("release command has help description", () => {
      const releaseCmd = program.commands.find((c) => c.name() === "release");
      expect(releaseCmd).toBeDefined();
      expect(releaseCmd!.description()).toBeTruthy();
    });

    test("show command has help description", () => {
      const showCmd = program.commands.find((c) => c.name() === "show");
      expect(showCmd).toBeDefined();
      expect(showCmd!.description()).toBeTruthy();
    });

    test("projects command has help description", () => {
      const projectsCmd = program.commands.find((c) => c.name() === "projects");
      expect(projectsCmd).toBeDefined();
      expect(projectsCmd!.description()).toBeTruthy();
    });
  });

  describe("VAL-CLI-008: CLI error handling", () => {
    test("shared error formatter handles network connectivity errors", async () => {
      const { formatError } = await import("../src/errors");
      const error = new TypeError("fetch failed");
      const message = formatError(error);
      expect(message).toContain("connect");
      expect(message).toBeTruthy();
    });

    test("shared error formatter handles ECONNREFUSED", async () => {
      const { formatError } = await import("../src/errors");
      const error = new Error("connect ECONNREFUSED 127.0.0.1:3200");
      const message = formatError(error);
      expect(message).toBeTruthy();
      expect(message.toLowerCase()).toContain("unable to connect");
    });

    test("shared error formatter handles API 400 errors", async () => {
      const { formatError } = await import("../src/errors");
      const error = new Error("Validation failed") as Error & {
        response?: { status: number; data: { error: string; details?: unknown } };
      };
      error.response = {
        status: 400,
        data: { error: "Invalid request" },
      };
      const message = formatError(error);
      expect(message).toBeTruthy();
      expect(message).toContain("400");
    });

    test("shared error formatter handles API 404 errors", async () => {
      const { formatError } = await import("../src/errors");
      const error = new Error("Not found") as Error & {
        response?: { status: number; data: { error: string } };
      };
      error.response = {
        status: 404,
        data: { error: "Task not found" },
      };
      const message = formatError(error);
      expect(message).toBeTruthy();
      expect(message).toContain("404");
    });

    test("shared error formatter handles API 500 errors", async () => {
      const { formatError } = await import("../src/errors");
      const error = new Error("Server error") as Error & {
        response?: { status: number; data: { error: string } };
      };
      error.response = {
        status: 500,
        data: { error: "Internal server error" },
      };
      const message = formatError(error);
      expect(message).toBeTruthy();
      expect(message).toContain("500");
    });

    test("shared error formatter handles timeout errors", async () => {
      const { formatError } = await import("../src/errors");
      const error = new Error("The operation timed out");
      const message = formatError(error);
      expect(message).toBeTruthy();
      // "timed out" is present in the formatted output
      expect(message.toLowerCase()).toContain("timed out");
    });

    test("shared error formatter handles unexpected errors", async () => {
      const { formatError } = await import("../src/errors");
      const message = formatError("something went wrong");
      expect(message).toBeTruthy();
      expect(message).toContain("unexpected");
    });

    test("shared error formatter handles error with no message", async () => {
      const { formatError } = await import("../src/errors");
      const message = formatError(new Error());
      expect(message).toBeTruthy();
    });
  });
});
