#!/usr/bin/env bun
import { Command } from "commander";
import chalk from "chalk";
import { loadConfig, getConfigPath, updateConfig, validateAgentId, generateAgentId, registerAgent, getAgentId } from "./config";
import { executeCreate } from "./commands/create";
import { executeList, executeProjects } from "./commands/list";
import { executeClaim } from "./commands/claim";
import { executeUpdate } from "./commands/update";
import { executeRelease } from "./commands/release";
import { executeShow } from "./commands/show";
import { executeRequestApproval } from "./commands/request-approval";
import { executeCheckApproval } from "./commands/check-approval";
import { registerGlobalErrorHandlers } from "./errors";
import { createInterface } from "node:readline";

const program = new Command();

/**
 * Get the agent name from the global --agent flag.
 * Returns undefined if not set (commands should fall back to default_agent).
 */
function getGlobalAgentName(): string | undefined {
  return program.opts().agent as string | undefined;
}

// Helper to prompt for input
async function prompt(question: string): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// Helper to initialize config with user prompt
async function initializeConfig(): Promise<void> {
  console.log(chalk.blue("Welcome to Mission Board CLI!"));
  console.log(chalk.gray(`Config will be stored at: ${getConfigPath()}`));
  console.log();

  let agentName = await prompt(chalk.yellow("Enter a name for this agent (e.g., alice, bob): "));

  // Validate agent name
  while (!agentName || !validateAgentId(agentName)) {
    console.log(chalk.red("Invalid agent name. Use only letters, numbers, hyphens, underscores, and dots."));
    agentName = await prompt(chalk.yellow("Enter agent name: "));
  }

  const uuid = await registerAgent(agentName);
  // Ensure this agent is the default
  await updateConfig({ default_agent: agentName });

  console.log();
  console.log(chalk.green("✓ Configuration saved successfully!"));
  console.log(chalk.gray(`Agent name: ${agentName}`));
  console.log(chalk.gray(`Agent UUID: ${uuid}`));
}

program
  .name("mission")
  .description(
    "Mission Board CLI — manage tasks across agent swarms.\n\n" +
    "  Tasks are created in projects and can be claimed, updated, and\n" +
    "  released by agents. Use the commands below to interact with the\n" +
    "  Mission Board API."
  )
  .version("1.0.0")
  .option("--agent <name>", "Agent name to use (overrides default_agent from config)")
  .addHelpText("afterAll", () => {
    return (
      "\n" +
      chalk.bold("Examples:") + "\n" +
      "  $ mission create --project <uuid> --title \"Fix login bug\" --type bugfix\n" +
      "  $ mission list --status in_progress\n" +
      "  $ mission claim <task-uuid>\n" +
      "  $ mission update <task-uuid> --status review\n" +
      "  $ mission show <task-uuid>\n" +
      "  $ mission release <task-uuid>\n" +
      "  $ mission request-approval <task-uuid> --action \"deploy to production\"\n" +
      "  $ mission check-approval <task-uuid>\n" +
      "  $ mission projects\n" +
      "\n" +
      chalk.bold("Configuration:") + "\n" +
      "  Config file: ~/.mission-board/config.json\n" +
      "  Run " + chalk.cyan("mission init") + " to set up your agent ID.\n"
    );
  });

program
  .command("init")
  .description(
    "Initialize CLI configuration.\n\n" +
    "  Creates ~/.mission-board/config.json with a unique agent ID.\n" +
    "  You will be prompted for an agent ID or one will be generated.\n" +
    "  This only needs to be run once."
  )
  .action(async () => {
    try {
      await initializeConfig();
    } catch (error) {
      console.error(chalk.red("Failed to initialize config:"), error);
      process.exit(1);
    }
  });

program
  .command("config")
  .description(
    "Show the current CLI configuration.\n\n" +
    "  Displays the config file path, agent ID, and API URL.\n" +
    "  Use " + chalk.cyan("mission set-agent") + " to change the agent ID."
  )
  .action(async () => {
    try {
      const config = await loadConfig();
      console.log(chalk.blue("Current Configuration:"));
      console.log(chalk.gray(`  Config file: ${getConfigPath()}`));
      console.log(`  API URL:       ${chalk.cyan(config.api_url)}`);
      console.log(`  Default agent: ${chalk.cyan(config.default_agent || "(none)")}`);
      const agentEntries = Object.entries(config.agents);
      if (agentEntries.length > 0) {
        console.log(`  Agents:`);
        for (const [name, uuid] of agentEntries) {
          const marker = name === config.default_agent ? " (default)" : "";
          console.log(`    ${chalk.cyan(name)}: ${uuid}${marker}`);
        }
      } else {
        console.log(`  Agents: ${chalk.gray("(none registered)")}`);
      }
    } catch (error) {
      console.error(chalk.red("Failed to load config:"), error);
      process.exit(1);
    }
  });

program
  .command("set-agent")
  .description(
    "Set the default agent by name.\n\n" +
    "  The agent name must already be registered. If it doesn't exist,\n" +
    "  a new agent will be registered with a generated UUID.\n" +
    "  Valid characters: letters, numbers, hyphens, underscores, and dots."
  )
  .argument("<agent-name>", "Agent name to set as default (letters, numbers, hyphens, underscores, dots)")
  .action(async (agentName: string) => {
    try {
      if (!validateAgentId(agentName)) {
        console.error(chalk.red("Error: Invalid agent name format"));
        console.error(chalk.gray("Use only letters, numbers, hyphens, underscores, and dots."));
        process.exit(1);
      }

      const config = await loadConfig();
      if (!config.agents[agentName]) {
        // Register new agent
        await registerAgent(agentName);
      }
      await updateConfig({ default_agent: agentName });
      console.log(chalk.green(`✓ Default agent set to: ${agentName}`));
    } catch (error) {
      console.error(chalk.red("Failed to update default agent:"), error);
      process.exit(1);
    }
  });

// Create task command
program
  .command("create")
  .description(
    "Create a new task in the Mission Board.\n\n" +
    "  The task is created in the 'backlog' status. After creation it can\n" +
    "  be claimed, moved through statuses, and eventually completed.\n" +
    "  Use " + chalk.cyan("mission projects") + " to see available project IDs."
  )
  .requiredOption("--project <project-id>", "Project UUID to create the task in")
  .requiredOption("--title <title>", "Title for the new task")
  .requiredOption("--type <type>", "Task type: implementation | bugfix | feature | deployment | documentation | testing | research | other")
  .option("--description <description>", "Optional description for the task")
  .action(async (options: { project: string; title: string; type: string; description?: string }) => {
    const exitCode = await executeCreate({
      project: options.project,
      title: options.title,
      type: options.type,
      description: options.description,
    });
    process.exit(exitCode);
  });

// List tasks command
program
  .command("list")
  .description(
    "List tasks, filtered by the configured agent's assignments.\n\n" +
    "  By default shows tasks assigned to your agent ID. Use filters\n" +
    "  to narrow results by project or status."
  )
  .option("--project <project-id>", "Filter by project UUID")
  .option("--status <status>", "Filter by status: backlog | ready | in_progress | review | done | blocked")
  .action(async (options: { project?: string; status?: string }) => {
    const exitCode = await executeList({
      project: options.project,
      status: options.status,
    });
    process.exit(exitCode);
  });

// List projects command
program
  .command("projects")
  .description(
    "List all available projects.\n\n" +
    "  Shows project IDs and names. Use the project ID with\n" +
    "  " + chalk.cyan("mission create --project <id>") + " to create tasks in a specific project."
  )
  .action(async () => {
    const exitCode = await executeProjects();
    process.exit(exitCode);
  });

// Claim task command
program
  .command("claim")
  .description(
    "Claim a task for the configured agent.\n\n" +
    "  Sets the task status to 'in_progress' and assigns it to your agent.\n" +
    "  If the task is already claimed by another agent, a 409 conflict is returned."
  )
  .argument("<task-id>", "Task UUID to claim")
  .option("--reason <text>", "Short reasoning summary for this action")
  .option("--transcript <json-file>", "Path to JSON file with reasoning steps, or - for stdin")
  .action(async (taskId: string, options: { reason?: string; transcript?: string }) => {
    const exitCode = await executeClaim(taskId, getGlobalAgentName(), options);
    process.exit(exitCode);
  });

// Update task command
program
  .command("update")
  .description(
    "Update a task's status or other fields.\n\n" +
    "  At least one of --status, --title, or --description must be provided.\n" +
    "  Status transitions are validated (e.g. backlog→done is not allowed).\n" +
    "  Valid transitions: backlog↔ready, ready↔in_progress, in_progress↔review,\n" +
    "  review↔done, any→blocked."
  )
  .argument("<task-id>", "Task UUID to update")
  .option("--status <status>", "New status: backlog | ready | in_progress | review | done | blocked")
  .option("--title <title>", "New title for the task")
  .option("--description <description>", "New description for the task")
  .option("--reason <text>", "Short reasoning summary for this action")
  .option("--transcript <json-file>", "Path to JSON file with reasoning steps, or - for stdin")
  .action(async (taskId: string, options: { status?: string; title?: string; description?: string; reason?: string; transcript?: string }) => {
    const exitCode = await executeUpdate(taskId, options);
    process.exit(exitCode);
  });

// Release task command
program
  .command("release")
  .description(
    "Release a claimed task back to the pool.\n\n" +
    "  Clears the agent assignment and sets the task status to 'ready'.\n" +
    "  Other agents can then claim the task."
  )
  .argument("<task-id>", "Task UUID to release")
  .option("--reason <text>", "Short reasoning summary for this action")
  .option("--transcript <json-file>", "Path to JSON file with reasoning steps, or - for stdin")
  .action(async (taskId: string, options: { reason?: string; transcript?: string }) => {
    const exitCode = await executeRelease(taskId, options);
    process.exit(exitCode);
  });

// Show task command
program
  .command("show")
  .description(
    "Show full details of a task.\n\n" +
    "  Displays title, description, status, type, assigned agent,\n" +
    "  project name, and all timestamps (created, updated, claimed)."
  )
  .argument("<task-id>", "Task UUID to display")
  .action(async (taskId: string) => {
    const exitCode = await executeShow(taskId);
    process.exit(exitCode);
  });

// Request approval command
program
  .command("request-approval")
  .description(
    "Request approval for a task action.\n\n" +
    "  Creates an approval request for the specified task. The task must\n" +
    "  have requires_approval=true. Use " + chalk.cyan("mission check-approval") + " to\n" +
    "  check the status of your request."
  )
  .argument("<task-id>", "Task UUID to request approval for")
  .requiredOption("--action <description>", "Description of the action requiring approval")
  .option("--reason <text>", "Short reasoning summary for this action")
  .option("--transcript <json-file>", "Path to JSON file with reasoning steps, or - for stdin")
  .action(async (taskId: string, options: { action: string; reason?: string; transcript?: string }) => {
    const exitCode = await executeRequestApproval(taskId, options.action, getGlobalAgentName(), options);
    process.exit(exitCode);
  });

// Check approval command
program
  .command("check-approval")
  .description(
    "Check approval status for a task.\n\n" +
    "  Shows the current approval status (pending, approved, or denied).\n" +
    "  If denied, shows the reviewer's notes explaining the decision."
  )
  .argument("<task-id>", "Task UUID to check approval status for")
  .action(async (taskId: string) => {
    const exitCode = await executeCheckApproval(taskId);
    process.exit(exitCode);
  });

// Auto-initialize on first run - this runs when no command is specified
// or when the main command is called directly
async function main() {
  // Register global error handlers for uncaught exceptions and unhandled rejections
  registerGlobalErrorHandlers();

  // Check if we should show help (no args or help flag)
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    program.help();
    return;
  }

  // For all other commands, config will be loaded lazily
  program.parse();
}

// Export for testing
export { program, initializeConfig };

// Run if this file is executed directly
if (import.meta.main) {
  main();
}
