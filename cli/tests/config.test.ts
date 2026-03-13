import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdir, rm, readFile, access } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

// Module under test (will be imported after we create it)
const CONFIG_DIR = join(homedir(), ".mission-board");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");

describe("CLI Config", () => {
  // Store original home for restoration
  const originalHome = process.env.HOME;
  const testHome = join(process.cwd(), "test-home");
  const testConfigDir = join(testHome, ".mission-board");
  const testConfigFile = join(testConfigDir, "config.json");

  beforeEach(async () => {
    // Set up test home directory
    process.env.HOME = testHome;
    process.env.USERPROFILE = testHome; // Windows
    
    // Clean up any existing test home
    try {
      await rm(testHome, { recursive: true, force: true });
    } catch {
      // Ignore if doesn't exist
    }
    
    // Create test home directory
    await mkdir(testHome, { recursive: true });
  });

  afterEach(async () => {
    // Restore original home
    process.env.HOME = originalHome;
    delete process.env.USERPROFILE;
    
    // Clean up test home
    try {
      await rm(testHome, { recursive: true, force: true });
    } catch {
      // Ignore if doesn't exist
    }
  });

  describe("Config file handling", () => {
    test("should create config directory if it doesn't exist", async () => {
      // Import the config module dynamically to get fresh state
      const { getConfigPath, ensureConfigDir } = await import("../src/config");
      
      await ensureConfigDir();
      
      // Verify directory was created (access returns undefined on success, but Bun's expect needs explicit handling)
      const result = await access(testConfigDir).then(() => "exists").catch(() => "not-found");
      expect(result).toBe("exists");
    });

    test("should return correct config file path", async () => {
      const { getConfigPath } = await import("../src/config");
      
      const configPath = getConfigPath();
      expect(configPath).toBe(testConfigFile);
    });

    test("should create default config if file doesn't exist", async () => {
      const { loadConfig } = await import("../src/config");
      
      const config = await loadConfig();
      
      // Verify config was created with default values
      expect(config).toHaveProperty("agent_id");
      expect(config).toHaveProperty("api_url");
      expect(config.api_url).toBe("http://localhost:3200");
      expect(typeof config.agent_id).toBe("string");
      expect(config.agent_id.length).toBeGreaterThan(0);
    });

    test("should load existing config if file exists", async () => {
      // Create config file manually first
      await mkdir(testConfigDir, { recursive: true });
      const existingConfig = {
        agent_id: "test-agent-123",
        api_url: "http://custom:8080"
      };
      await Bun.write(testConfigFile, JSON.stringify(existingConfig, null, 2));
      
      const { loadConfig } = await import("../src/config");
      const config = await loadConfig();
      
      expect(config.agent_id).toBe("test-agent-123");
      expect(config.api_url).toBe("http://custom:8080");
    });

    test("should save config correctly", async () => {
      const { saveConfig, loadConfig } = await import("../src/config");
      
      const newConfig = {
        agent_id: "my-agent",
        api_url: "http://example.com:3200"
      };
      
      await saveConfig(newConfig);
      
      // Read file directly to verify
      const content = await readFile(testConfigFile, "utf-8");
      const parsed = JSON.parse(content);
      
      expect(parsed.agent_id).toBe("my-agent");
      expect(parsed.api_url).toBe("http://example.com:3200");
    });
  });

  describe("Agent ID validation", () => {
    test("should validate agent_id format", async () => {
      const { validateAgentId } = await import("../src/config");
      
      // Valid agent IDs
      expect(validateAgentId("agent-123")).toBe(true);
      expect(validateAgentId("my_agent")).toBe(true);
      expect(validateAgentId("agent.name")).toBe(true);
      expect(validateAgentId("Agent-123_test")).toBe(true);
      
      // Invalid agent IDs
      expect(validateAgentId("")).toBe(false);
      expect(validateAgentId("   ")).toBe(false);
      expect(validateAgentId("agent@123")).toBe(false); // special chars
      expect(validateAgentId("agent 123")).toBe(false); // space
    });
  });
});
