#!/usr/bin/env bun
import { Command } from "commander";
import chalk from "chalk";
import { loadConfig, getConfigPath, updateConfig, validateAgentId, generateAgentId } from "./config";
import { executeCreate } from "./commands/create";
import { executeList, executeProjects } from "./commands/list";
import { executeClaim } from "./commands/claim";
import { executeUpdate } from "./commands/update";
import { executeRelease } from "./commands/release";
import { executeShow } from "./commands/show";
import { registerGlobalErrorHandlers } from "./errors";
import { createInterface } from "node:readline";

const program = new Command();

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

  const suggestedId = generateAgentId();
  console.log(chalk.gray(`Suggested agent ID: ${suggestedId}`));
  
  let agentId = await prompt(chalk.yellow("Enter your agent ID (or press Enter to use suggested): "));
  
  if (!agentId) {
    agentId = suggestedId;
  }

  // Validate agent ID
  while (!validateAgentId(agentId)) {
    console.log(chalk.red("Invalid agent ID. Use only letters, numbers, hyphens, underscores, and dots."));
    agentId = await prompt(chalk.yellow("Enter your agent ID: "));
  }

  await updateConfig({ agent_id: agentId });
  
  console.log();
  console.log(chalk.green("✓ Configuration saved successfully!"));
  console.log(chalk.gray(`Agent ID: ${agentId}`));
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
      console.log(`  Agent ID: ${chalk.cyan(config.agent_id)}`);
      console.log(`  API URL:  ${chalk.cyan(config.api_url)}`);
    } catch (error) {
      console.error(chalk.red("Failed to load config:"), error);
      process.exit(1);
    }
  });

program
  .command("set-agent")
  .description(
    "Update the agent ID stored in the CLI configuration.\n\n" +
    "  The agent ID identifies you when claiming and creating tasks.\n" +
    "  Valid characters: letters, numbers, hyphens, underscores, and dots."
  )
  .argument("<agent-id>", "New agent ID (letters, numbers, hyphens, underscores, dots)")
  .action(async (agentId: string) => {
    try {
      if (!validateAgentId(agentId)) {
        console.error(chalk.red("Error: Invalid agent ID format"));
        console.error(chalk.gray("Use only letters, numbers, hyphens, underscores, and dots."));
        process.exit(1);
      }

      await updateConfig({ agent_id: agentId });
      console.log(chalk.green(`✓ Agent ID updated to: ${agentId}`));
    } catch (error) {
      console.error(chalk.red("Failed to update agent ID:"), error);
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
  .action(async (taskId: string) => {
    const exitCode = await executeClaim(taskId);
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
  .action(async (taskId: string, options: { status?: string; title?: string; description?: string }) => {
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
  .action(async (taskId: string) => {
    const exitCode = await executeRelease(taskId);
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
