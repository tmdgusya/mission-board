import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

export interface Config {
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
  try {
    await access(getConfigPath());
    return true;
  } catch {
    return false;
  }
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
 * Load config from file, creating default if it doesn't exist
 */
export async function loadConfig(): Promise<Config> {
  const configPath = getConfigPath();
  
  // Ensure directory exists
  await ensureConfigDir();
  
  // Check if config exists
  if (await configExists()) {
    // Load existing config
    const content = await readFile(configPath, "utf-8");
    const config = JSON.parse(content) as Config;
    
    // Ensure required fields exist
    if (!config.agent_id) {
      config.agent_id = generateAgentId();
      await saveConfig(config);
    }
    if (!config.api_url) {
      config.api_url = DEFAULT_API_URL;
      await saveConfig(config);
    }
    
    return config;
  }
  
  // Create default config
  const defaultConfig: Config = {
    agent_id: generateAgentId(),
    api_url: DEFAULT_API_URL,
  };
  
  await saveConfig(defaultConfig);
  return defaultConfig;
}

/**
 * Save config to file
 */
export async function saveConfig(config: Config): Promise<void> {
  const configPath = getConfigPath();
  await ensureConfigDir();
  await writeFile(configPath, JSON.stringify(config, null, 2), "utf-8");
}

/**
 * Update specific config values
 */
export async function updateConfig(updates: Partial<Config>): Promise<Config> {
  const config = await loadConfig();
  const updated = { ...config, ...updates };
  await saveConfig(updated);
  return updated;
}
