import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdir, rm, readFile, access } from "node:fs/promises";
import { join } from "node:path";

describe("CLI Config (multi-agent)", () => {
  const originalHome = process.env.HOME;
  const testHome = join(process.cwd(), "test-home");
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
    process.env.HOME = originalHome;
    delete process.env.USERPROFILE;

    try {
      await rm(testHome, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  });

  describe("New config format load/save", () => {
    test("should create config directory if it doesn't exist", async () => {
      const { ensureConfigDir } = await import("../src/config");

      await ensureConfigDir();

      const result = await access(testConfigDir)
        .then(() => "exists")
        .catch(() => "not-found");
      expect(result).toBe("exists");
    });

    test("should return correct config file path", async () => {
      const { getConfigPath } = await import("../src/config");
      expect(getConfigPath()).toBe(testConfigFile);
    });

    test("should create default config with agents map when no config exists", async () => {
      const { loadConfig } = await import("../src/config");

      const config = await loadConfig();

      expect(config).toHaveProperty("api_url");
      expect(config).toHaveProperty("agents");
      expect(config).toHaveProperty("default_agent");
      expect(config.api_url).toBe("http://localhost:3200");
      expect(typeof config.agents).toBe("object");
      expect(Object.keys(config.agents).length).toBe(1);
      // default agent name should be set
      expect(config.default_agent).toBeTruthy();
      // the default agent should exist in the agents map
      expect(config.agents[config.default_agent]).toBeTruthy();
    });

    test("should load existing new-format config", async () => {
      await mkdir(testConfigDir, { recursive: true });
      const existingConfig = {
        api_url: "http://custom:8080",
        agents: { alice: "550e8400-e29b-41d4-a716-446655440000" },
        default_agent: "alice",
      };
      await Bun.write(testConfigFile, JSON.stringify(existingConfig, null, 2));

      const { loadConfig } = await import("../src/config");
      const config = await loadConfig();

      expect(config.api_url).toBe("http://custom:8080");
      expect(config.agents.alice).toBe("550e8400-e29b-41d4-a716-446655440000");
      expect(config.default_agent).toBe("alice");
    });

    test("should save config correctly in new format", async () => {
      const { saveConfig } = await import("../src/config");

      const newConfig = {
        api_url: "http://example.com:3200",
        agents: { bob: "6ba7b810-9dad-11d1-80b4-00c04fd430c8" },
        default_agent: "bob",
      };

      await saveConfig(newConfig);

      const content = await readFile(testConfigFile, "utf-8");
      const parsed = JSON.parse(content);

      expect(parsed.api_url).toBe("http://example.com:3200");
      expect(parsed.agents.bob).toBe("6ba7b810-9dad-11d1-80b4-00c04fd430c8");
      expect(parsed.default_agent).toBe("bob");
    });
  });

  describe("Old format auto-migration", () => {
    test("should migrate old format (agent_id) to new multi-agent format", async () => {
      await mkdir(testConfigDir, { recursive: true });
      const oldConfig = {
        agent_id: "550e8400-e29b-41d4-a716-446655440000",
        api_url: "http://localhost:3200",
      };
      await Bun.write(testConfigFile, JSON.stringify(oldConfig, null, 2));

      const { loadConfig } = await import("../src/config");
      const config = await loadConfig();

      // Should have new format
      expect(config.agents).toBeDefined();
      expect(config.default_agent).toBeDefined();
      // Old agent_id should NOT be present as a top-level key
      expect((config as Record<string, unknown>).agent_id).toBeUndefined();

      // Agent name should be derived from first 8 chars of UUID
      const expectedName = "agent-550e8400";
      expect(config.agents[expectedName]).toBe("550e8400-e29b-41d4-a716-446655440000");
      expect(config.default_agent).toBe(expectedName);
    });

    test("should persist migrated config to disk", async () => {
      await mkdir(testConfigDir, { recursive: true });
      const oldConfig = {
        agent_id: "abcdef01-0000-0000-0000-000000000000",
        api_url: "http://myserver:9000",
      };
      await Bun.write(testConfigFile, JSON.stringify(oldConfig, null, 2));

      const { loadConfig } = await import("../src/config");
      await loadConfig();

      // Re-read from disk directly
      const content = await readFile(testConfigFile, "utf-8");
      const parsed = JSON.parse(content);

      expect(parsed.agents).toBeDefined();
      expect(parsed.agent_id).toBeUndefined();
      expect(parsed.default_agent).toBe("agent-abcdef01");
      expect(parsed.agents["agent-abcdef01"]).toBe(
        "abcdef01-0000-0000-0000-000000000000"
      );
      expect(parsed.api_url).toBe("http://myserver:9000");
    });
  });

  describe("Atomic write", () => {
    test("should write atomically via temp file", async () => {
      const { saveConfig } = await import("../src/config");

      const config = {
        api_url: "http://localhost:3200",
        agents: { test: "00000000-0000-0000-0000-000000000001" },
        default_agent: "test",
      };

      await saveConfig(config);

      // File should exist and be valid JSON
      const content = await readFile(testConfigFile, "utf-8");
      const parsed = JSON.parse(content);
      expect(parsed.default_agent).toBe("test");

      // No temp files should remain
      const { readdir } = await import("node:fs/promises");
      const files = await readdir(testConfigDir);
      const tmpFiles = files.filter((f: string) => f.includes(".tmp."));
      expect(tmpFiles.length).toBe(0);
    });
  });

  describe("getAgentId resolution", () => {
    test("should resolve agent name to UUID", async () => {
      const { getAgentId } = await import("../src/config");

      const config = {
        api_url: "http://localhost:3200",
        agents: {
          alice: "550e8400-e29b-41d4-a716-446655440000",
          bob: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
        },
        default_agent: "alice",
      };

      expect(getAgentId(config, "alice")).toBe(
        "550e8400-e29b-41d4-a716-446655440000"
      );
      expect(getAgentId(config, "bob")).toBe(
        "6ba7b810-9dad-11d1-80b4-00c04fd430c8"
      );
    });

    test("should throw for unknown agent name", async () => {
      const { getAgentId } = await import("../src/config");

      const config = {
        api_url: "http://localhost:3200",
        agents: { alice: "550e8400-e29b-41d4-a716-446655440000" },
        default_agent: "alice",
      };

      expect(() => getAgentId(config, "unknown")).toThrow(
        /Unknown agent "unknown"/
      );
    });

    test("should list known agents in error message", async () => {
      const { getAgentId } = await import("../src/config");

      const config = {
        api_url: "http://localhost:3200",
        agents: {
          alice: "aaa",
          bob: "bbb",
        },
        default_agent: "alice",
      };

      expect(() => getAgentId(config, "charlie")).toThrow(/alice, bob/);
    });

    test("should throw with (none) for empty agents map", async () => {
      const { getAgentId } = await import("../src/config");

      const config = {
        api_url: "http://localhost:3200",
        agents: {},
        default_agent: "",
      };

      expect(() => getAgentId(config, "anyone")).toThrow(/\(none\)/);
    });
  });

  describe("registerAgent", () => {
    test("should register a new agent and save", async () => {
      // First create a config so loadConfig doesn't auto-generate
      await mkdir(testConfigDir, { recursive: true });
      const initialConfig = {
        api_url: "http://localhost:3200",
        agents: {},
        default_agent: "",
      };
      await Bun.write(
        testConfigFile,
        JSON.stringify(initialConfig, null, 2)
      );

      const { registerAgent, loadConfig } = await import("../src/config");

      const uuid = await registerAgent("charlie");

      // Should return a UUID
      expect(uuid).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );

      // Should be persisted
      const config = await loadConfig();
      expect(config.agents.charlie).toBe(uuid);
      // Should set default_agent when empty
      expect(config.default_agent).toBe("charlie");
    });

    test("should return existing UUID if agent already registered", async () => {
      await mkdir(testConfigDir, { recursive: true });
      const existingUuid = "11111111-2222-3333-4444-555555555555";
      const initialConfig = {
        api_url: "http://localhost:3200",
        agents: { alice: existingUuid },
        default_agent: "alice",
      };
      await Bun.write(
        testConfigFile,
        JSON.stringify(initialConfig, null, 2)
      );

      const { registerAgent } = await import("../src/config");

      const uuid = await registerAgent("alice");
      expect(uuid).toBe(existingUuid);
    });

    test("should not override default_agent if already set", async () => {
      await mkdir(testConfigDir, { recursive: true });
      const initialConfig = {
        api_url: "http://localhost:3200",
        agents: { alice: "11111111-2222-3333-4444-555555555555" },
        default_agent: "alice",
      };
      await Bun.write(
        testConfigFile,
        JSON.stringify(initialConfig, null, 2)
      );

      const { registerAgent, loadConfig } = await import("../src/config");

      await registerAgent("bob");

      const config = await loadConfig();
      // default_agent should still be alice
      expect(config.default_agent).toBe("alice");
    });
  });

  describe("Edge cases", () => {
    test("should handle config with missing default_agent", async () => {
      await mkdir(testConfigDir, { recursive: true });
      const config = {
        api_url: "http://localhost:3200",
        agents: { alice: "aaa" },
        // no default_agent
      };
      await Bun.write(testConfigFile, JSON.stringify(config, null, 2));

      const { loadConfig } = await import("../src/config");
      const loaded = await loadConfig();

      expect(loaded.default_agent).toBe("");
    });

    test("should handle config with missing agents", async () => {
      await mkdir(testConfigDir, { recursive: true });
      const config = {
        api_url: "http://localhost:3200",
        default_agent: "test",
        // no agents field
      };
      await Bun.write(testConfigFile, JSON.stringify(config, null, 2));

      const { loadConfig } = await import("../src/config");
      const loaded = await loadConfig();

      expect(loaded.agents).toEqual({});
    });

    test("should handle config with missing api_url", async () => {
      await mkdir(testConfigDir, { recursive: true });
      const config = {
        agents: { alice: "aaa" },
        default_agent: "alice",
        // no api_url
      };
      await Bun.write(testConfigFile, JSON.stringify(config, null, 2));

      const { loadConfig } = await import("../src/config");
      const loaded = await loadConfig();

      expect(loaded.api_url).toBe("http://localhost:3200");
    });
  });

  describe("Agent ID validation", () => {
    test("should validate agent name format", async () => {
      const { validateAgentId } = await import("../src/config");

      // Valid names
      expect(validateAgentId("agent-123")).toBe(true);
      expect(validateAgentId("my_agent")).toBe(true);
      expect(validateAgentId("agent.name")).toBe(true);
      expect(validateAgentId("Agent-123_test")).toBe(true);

      // Invalid names
      expect(validateAgentId("")).toBe(false);
      expect(validateAgentId("   ")).toBe(false);
      expect(validateAgentId("agent@123")).toBe(false);
      expect(validateAgentId("agent 123")).toBe(false);
    });
  });
});
