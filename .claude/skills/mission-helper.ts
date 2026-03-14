#!/usr/bin/env bun
/**
 * mission-helper.ts — Shared helper script for mission board Claude Code skills.
 * Run via: bun .claude/skills/mission-helper.ts <command> [args]
 *
 * All output is JSON to stdout. Errors are JSON to stderr with exit code 1.
 * No external dependencies.
 */

import { join } from "node:path";
import { homedir } from "node:os";
import { rename, mkdir } from "node:fs/promises";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Config {
  api_url: string;
  agents: Record<string, string>;
  default_agent: string;
}

interface OldConfig {
  agent_id?: string;
  api_url?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_API_URL = "http://localhost:3200";

// ---------------------------------------------------------------------------
// Helpers — output
// ---------------------------------------------------------------------------

function outputJSON(data: unknown): void {
  process.stdout.write(JSON.stringify(data, null, 2) + "\n");
}

function errorJSON(message: string, details?: unknown): never {
  const payload: Record<string, unknown> = { error: message };
  if (details !== undefined) payload.details = details;
  process.stderr.write(JSON.stringify(payload, null, 2) + "\n");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Helpers — arg parsing
// ---------------------------------------------------------------------------

function parseArgs(argv: string[]): { positional: string[]; flags: Record<string, string> } {
  const positional: string[] = [];
  const flags: Record<string, string> = {};
  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        flags[key] = next;
        i += 2;
      } else {
        flags[key] = "true";
        i += 1;
      }
    } else {
      positional.push(arg);
      i += 1;
    }
  }
  return { positional, flags };
}

// ---------------------------------------------------------------------------
// Config — read / write / migrate
// ---------------------------------------------------------------------------

function getConfigDir(): string {
  const home = process.env.HOME || process.env.USERPROFILE || homedir();
  return join(home, ".mission-board");
}

function getConfigPath(): string {
  return join(getConfigDir(), "config.json");
}

async function ensureConfigDir(): Promise<void> {
  await mkdir(getConfigDir(), { recursive: true });
}

async function loadConfig(): Promise<Config> {
  await ensureConfigDir();
  const configPath = getConfigPath();
  const file = Bun.file(configPath);

  if (await file.exists()) {
    const raw = await file.json() as Config | OldConfig;

    // Migrate old format
    if ("agent_id" in raw && typeof (raw as OldConfig).agent_id === "string") {
      const old = raw as OldConfig;
      const agentId = old.agent_id!;
      const name = `agent-${agentId.slice(0, 8)}`;
      const migrated: Config = {
        api_url: old.api_url || DEFAULT_API_URL,
        agents: { [name]: agentId },
        default_agent: name,
      };
      await saveConfig(migrated);
      return migrated;
    }

    const config = raw as Config;
    // Ensure required fields
    if (!config.api_url) config.api_url = DEFAULT_API_URL;
    if (!config.agents) config.agents = {};
    if (!config.default_agent) config.default_agent = "";
    return config;
  }

  // Create default (empty) config
  const defaultConfig: Config = {
    api_url: DEFAULT_API_URL,
    agents: {},
    default_agent: "",
  };
  await saveConfig(defaultConfig);
  return defaultConfig;
}

async function saveConfig(config: Config): Promise<void> {
  await ensureConfigDir();
  const configPath = getConfigPath();
  const tmpPath = configPath + ".tmp." + crypto.randomUUID();
  await Bun.write(tmpPath, JSON.stringify(config, null, 2));
  await rename(tmpPath, configPath);
}

function resolveAgentId(config: Config, name?: string): string {
  const agentName = name || config.default_agent;
  if (!agentName) {
    errorJSON("No agent configured. Run: bun mission-helper.ts whoami --name <name>");
  }
  const id = config.agents[agentName];
  if (!id) {
    errorJSON(`Agent "${agentName}" not found in config`, { available: Object.keys(config.agents) });
  }
  return id;
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

function apiUrl(config: Config, path: string): string {
  return `${config.api_url}${path}`;
}

async function apiFetch(url: string, options?: RequestInit): Promise<unknown> {
  const resp = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  const body = await resp.json().catch(() => null);
  if (!resp.ok) {
    const msg = (body as any)?.error || `HTTP ${resp.status}`;
    errorJSON(msg, body);
  }
  return body;
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

async function cmdWhoami(flags: Record<string, string>): Promise<void> {
  const config = await loadConfig();
  const name = flags.name;

  if (!name) {
    // Return current default agent
    if (!config.default_agent || !config.agents[config.default_agent]) {
      errorJSON("No agent configured. Run: bun mission-helper.ts whoami --name <name>");
    }
    outputJSON({ name: config.default_agent, id: config.agents[config.default_agent] });
    return;
  }

  // Check if agent already exists in config
  if (config.agents[name]) {
    config.default_agent = name;
    await saveConfig(config);
    outputJSON({ name, id: config.agents[name] });
    return;
  }

  // Register new agent
  const id = crypto.randomUUID();
  config.agents[name] = id;
  config.default_agent = name;
  await saveConfig(config);

  // Register with API (best-effort — endpoint may not exist yet)
  try {
    await fetch(apiUrl(config, "/api/agents"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name }),
    });
  } catch {
    // Config is already saved; API registration is best-effort
  }

  outputJSON({ name, id });
}

async function cmdList(flags: Record<string, string>): Promise<void> {
  const config = await loadConfig();
  const params = new URLSearchParams();
  if (flags.project) params.append("project_id", flags.project);
  if (flags.status) params.append("status", flags.status);
  const qs = params.toString();
  const url = apiUrl(config, `/api/tasks${qs ? `?${qs}` : ""}`);
  const data = await apiFetch(url);
  outputJSON(data);
}

async function cmdShow(positional: string[]): Promise<void> {
  const taskId = positional[0];
  if (!taskId) errorJSON("Usage: show <task-id>");
  const config = await loadConfig();
  const data = await apiFetch(apiUrl(config, `/api/tasks/${taskId}`));
  outputJSON(data);
}

async function cmdCreate(flags: Record<string, string>): Promise<void> {
  if (!flags.project) errorJSON("Missing required flag: --project <id>");
  if (!flags.title) errorJSON("Missing required flag: --title <title>");
  if (!flags.type) errorJSON("Missing required flag: --type <type>");
  const config = await loadConfig();
  const payload: Record<string, unknown> = {
    projectId: flags.project,
    title: flags.title,
    taskType: flags.type,
  };
  if (flags.description) payload.description = flags.description;
  const data = await apiFetch(apiUrl(config, "/api/tasks"), {
    method: "POST",
    body: JSON.stringify(payload),
  });
  outputJSON(data);
}

async function cmdClaim(positional: string[]): Promise<void> {
  const taskId = positional[0];
  if (!taskId) errorJSON("Usage: claim <task-id>");
  const config = await loadConfig();
  const agentId = resolveAgentId(config);
  const data = await apiFetch(apiUrl(config, "/api/approvals"), {
    method: "POST",
    body: JSON.stringify({ taskId, agentId, actionRequested: "claim" }),
  });
  outputJSON(data);
}

async function cmdRelease(positional: string[]): Promise<void> {
  const taskId = positional[0];
  if (!taskId) errorJSON("Usage: release <task-id>");
  const config = await loadConfig();
  const data = await apiFetch(apiUrl(config, `/api/tasks/${taskId}/release`), {
    method: "POST",
  });
  outputJSON(data);
}

async function cmdStatus(positional: string[], flags: Record<string, string>): Promise<void> {
  const taskId = positional[0];
  if (!taskId) errorJSON("Usage: status <task-id> --status <new-status>");
  if (!flags.status) errorJSON("Missing required flag: --status <new-status>");
  const config = await loadConfig();
  const data = await apiFetch(apiUrl(config, `/api/tasks/${taskId}`), {
    method: "PATCH",
    body: JSON.stringify({ status: flags.status }),
  });
  outputJSON(data);
}

async function cmdComplete(positional: string[]): Promise<void> {
  const taskId = positional[0];
  if (!taskId) errorJSON("Usage: complete <task-id>");
  const config = await loadConfig();

  // Get task to check requiresApproval
  const task = (await apiFetch(apiUrl(config, `/api/tasks/${taskId}`))) as {
    requiresApproval: boolean;
  };

  if (task.requiresApproval) {
    // Create approval request
    const agentId = resolveAgentId(config);
    const data = await apiFetch(apiUrl(config, "/api/approvals"), {
      method: "POST",
      body: JSON.stringify({ taskId, agentId, actionRequested: "complete" }),
    });
    outputJSON(data);
  } else {
    // Mark done directly
    const data = await apiFetch(apiUrl(config, `/api/tasks/${taskId}`), {
      method: "PATCH",
      body: JSON.stringify({ status: "done" }),
    });
    outputJSON(data);
  }
}

async function cmdCheckApproval(positional: string[]): Promise<void> {
  const taskId = positional[0];
  if (!taskId) errorJSON("Usage: check-approval <task-id>");
  const config = await loadConfig();

  const approvals = (await apiFetch(
    apiUrl(config, `/api/approvals?task_id=${encodeURIComponent(taskId)}`)
  )) as Array<{
    id: string;
    status: string;
    reviewedBy: string | null;
    notes: string | null;
  }>;

  if (!approvals || approvals.length === 0) {
    errorJSON("No approval requests found for this task");
  }

  // Check the latest approval
  const latest = approvals[approvals.length - 1];

  if (latest.status === "approved") {
    outputJSON({ status: "approved", approvalId: latest.id });
  } else if (latest.status === "denied") {
    // Resolve reviewer UUID to name
    let reviewerName = latest.reviewedBy || "unknown";
    if (latest.reviewedBy) {
      try {
        const agent = (await apiFetch(
          apiUrl(config, `/api/agents/${latest.reviewedBy}`)
        )) as { name: string };
        reviewerName = agent.name;
      } catch {
        // Use raw ID if lookup fails
      }
    }
    // Output to stderr and exit 1
    const payload = { status: "denied", reviewedBy: reviewerName, notes: latest.notes };
    process.stderr.write(JSON.stringify(payload, null, 2) + "\n");
    process.exit(1);
  } else {
    outputJSON({ status: "pending" });
  }
}

async function cmdReview(positional: string[]): Promise<void> {
  const taskId = positional[0];
  if (!taskId) errorJSON("Usage: review <task-id>");
  const config = await loadConfig();
  const data = await apiFetch(apiUrl(config, `/api/tasks/${taskId}/comments`));
  outputJSON(data);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    errorJSON("No command provided", {
      usage: "bun mission-helper.ts <command> [args]",
      commands: [
        "whoami",
        "list",
        "show",
        "create",
        "claim",
        "release",
        "status",
        "complete",
        "check-approval",
        "review",
      ],
    });
  }

  const command = args[0];
  const rest = args.slice(1);
  const { positional, flags } = parseArgs(rest);

  try {
    switch (command) {
      case "whoami":
        await cmdWhoami(flags);
        break;
      case "list":
        await cmdList(flags);
        break;
      case "show":
        await cmdShow(positional);
        break;
      case "create":
        await cmdCreate(flags);
        break;
      case "claim":
        await cmdClaim(positional);
        break;
      case "release":
        await cmdRelease(positional);
        break;
      case "status":
        await cmdStatus(positional, flags);
        break;
      case "complete":
        await cmdComplete(positional);
        break;
      case "check-approval":
        await cmdCheckApproval(positional);
        break;
      case "review":
        await cmdReview(positional);
        break;
      default:
        errorJSON(`Unknown command: ${command}`, {
          commands: [
            "whoami",
            "list",
            "show",
            "create",
            "claim",
            "release",
            "status",
            "complete",
            "check-approval",
            "review",
          ],
        });
    }
  } catch (err: unknown) {
    // If errorJSON was already called, process.exit would have fired.
    // This catches unexpected errors (e.g., network failures).
    if (err instanceof Error) {
      errorJSON(err.message);
    }
    errorJSON("Unknown error");
  }
}

main();
