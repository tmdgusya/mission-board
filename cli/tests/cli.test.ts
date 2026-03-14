import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdir, rm, readFile } from "node:fs/promises";
import { join } from "node:path";

describe("CLI Framework", () => {
  const testHome = join(process.cwd(), "test-cli-home");
  const testConfigDir = join(testHome, ".mission-board");
  const testConfigFile = join(testConfigDir, "config.json");

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

  describe("Program setup", () => {
    test("should export program with correct name", async () => {
      const { program } = await import("../src/index");
      
      expect(program.name()).toBe("mission");
    });

    test("should have init command", async () => {
      const { program } = await import("../src/index");
      
      const commands = program.commands.map(cmd => cmd.name());
      expect(commands).toContain("init");
    });

    test("should have config command", async () => {
      const { program } = await import("../src/index");
      
      const commands = program.commands.map(cmd => cmd.name());
      expect(commands).toContain("config");
    });

    test("should have set-agent command", async () => {
      const { program } = await import("../src/index");
      
      const commands = program.commands.map(cmd => cmd.name());
      expect(commands).toContain("set-agent");
    });
  });

  describe("Config command", () => {
    test("should display config after initialization", async () => {
      const { loadConfig } = await import("../src/config");
      
      // Initialize config
      const config = await loadConfig();
      
      expect(config).toHaveProperty("agents");
      expect(config).toHaveProperty("default_agent");
      expect(config).toHaveProperty("api_url");
      expect(config.api_url).toBe("http://localhost:3200");
    });
  });
});

describe("Binary compilation", () => {
  test("build:cli script should exist in package.json", async () => {
    const packageJson = await import("../../package.json");
    
    expect(packageJson.scripts).toHaveProperty("build:cli");
    expect(packageJson.scripts["build:cli"]).toContain("bun build");
    expect(packageJson.scripts["build:cli"]).toContain("--compile");
    expect(packageJson.scripts["build:cli"]).toContain("dist/mission");
  });
});
