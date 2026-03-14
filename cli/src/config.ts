import { renameSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

export interface Config {
  api_url: string;
  agents: Record<string, string>; // name -> UUID
  default_agent: string;
}

/** Shape of the old config format (pre-migration). */
interface OldConfig {
  agent_id: string;
  api_url: string;
}

const DEFAULT_API_URL = "http://localhost:3200";

/**
 * Get the path to the config directory (~/.mission-board)
 */
export function getConfigDir(): string {
  const home = process.env.HOME || process.env.USERPROFILE || homedir();
  return join(home, ".mission-board");
}

/**
 * Get the path to the config file (~/.mission-board/config.json)
 */
export function getConfigPath(): string {
  return join(getConfigDir(), "config.json");
}

/**
 * Ensure the config directory exists
 */
export async function ensureConfigDir(): Promise<void> {
  const configDir = getConfigDir();
  await mkdir(configDir, { recursive: true });
}

/**
 * Check if config file exists
 */
export async function configExists(): Promise<boolean> {
  const configPath = getConfigPath();
  const file = Bun.file(configPath);
  return file.exists();
}

/**
 * Generate a default agent ID (UUID format)
 */
export function generateAgentId(): string {
  return crypto.randomUUID();
}

/**
 * Validate agent ID format
 * Allows: alphanumeric, hyphens, underscores, dots
 * Disallows: empty, whitespace, special chars
 */
export function validateAgentId(agentId: string): boolean {
  if (!agentId || agentId.trim() === "") {
    return false;
  }
  // Allow alphanumeric, hyphens, underscores, and dots
  const validPattern = /^[a-zA-Z0-9._-]+$/;
  return validPattern.test(agentId);
}

/**
 * Detect whether parsed JSON is the old config format.
 */
function isOldConfig(obj: unknown): obj is OldConfig {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "agent_id" in obj &&
    !("agents" in obj)
  );
}

/**
 * Migrate an old-format config to the new multi-agent format.
 */
function migrateOldConfig(old: OldConfig): Config {
  const agentName = `agent-${old.agent_id.slice(0, 8)}`;
  return {
    api_url: old.api_url || DEFAULT_API_URL,
    agents: { [agentName]: old.agent_id },
    default_agent: agentName,
  };
}

/**
 * Write config atomically: write to a temp file then rename into place.
 */
export async function atomicWriteConfig(
  configPath: string,
  data: string
): Promise<void> {
  const tmpPath = configPath + ".tmp." + process.pid;
  await Bun.write(tmpPath, data);
  renameSync(tmpPath, configPath);
}

/**
 * Load config from file, creating default if it doesn't exist.
 * Auto-migrates old format (has agent_id, no agents) to multi-agent format.
 */
export async function loadConfig(): Promise<Config> {
  // Ensure directory exists
  await ensureConfigDir();

  // Check if config exists
  if (await configExists()) {
    const configPath = getConfigPath();
    const file = Bun.file(configPath);
    const content = await file.text();
    const parsed = JSON.parse(content);

    // Auto-migrate old format
    if (isOldConfig(parsed)) {
      const migrated = migrateOldConfig(parsed);
      await saveConfig(migrated);
      return migrated;
    }

    const config = parsed as Config;

    // Ensure required fields exist
    if (!config.agents) {
      config.agents = {};
    }
    if (!config.api_url) {
      config.api_url = DEFAULT_API_URL;
    }
    if (!config.default_agent) {
      config.default_agent = "";
    }

    return config;
  }

  // Create default config with a generated agent
  const id = generateAgentId();
  const name = `agent-${id.slice(0, 8)}`;
  const defaultConfig: Config = {
    api_url: DEFAULT_API_URL,
    agents: { [name]: id },
    default_agent: name,
  };

  await saveConfig(defaultConfig);
  return defaultConfig;
}

/**
 * Save config to file atomically.
 */
export async function saveConfig(config: Config): Promise<void> {
  const configPath = getConfigPath();
  await ensureConfigDir();
  await atomicWriteConfig(configPath, JSON.stringify(config, null, 2));
}

/**
 * Update specific config values (shallow merge).
 */
export async function updateConfig(updates: Partial<Config>): Promise<Config> {
  const config = await loadConfig();
  const updated = { ...config, ...updates };
  await saveConfig(updated);
  return updated;
}

/**
 * Resolve an agent name to its UUID.
 * Throws if the name is not found in the agents map.
 */
export function getAgentId(config: Config, name: string): string {
  const id = config.agents[name];
  if (!id) {
    throw new Error(
      `Unknown agent "${name}". Known agents: ${Object.keys(config.agents).join(", ") || "(none)"}`
    );
  }
  return id;
}

/**
 * Register a new agent: generate a UUID, add to agents map, and save.
 * Returns the generated UUID.
 */
export async function registerAgent(name: string): Promise<string> {
  const config = await loadConfig();
  if (config.agents[name]) {
    return config.agents[name];
  }
  const id = generateAgentId();
  config.agents[name] = id;
  if (!config.default_agent) {
    config.default_agent = name;
  }
  await saveConfig(config);
  return id;
}
