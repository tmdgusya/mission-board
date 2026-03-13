#!/usr/bin/env bun
import { Command } from "commander";
import chalk from "chalk";
import { loadConfig, getConfigPath, updateConfig, validateAgentId, generateAgentId } from "./config";
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
  .description("Mission Board CLI - Agent task management tool")
  .version("1.0.0");

program
  .command("init")
  .description("Initialize CLI configuration")
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
  .description("Show current configuration")
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
  .description("Update agent ID")
  .argument("<agent-id>", "New agent ID")
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

// Auto-initialize on first run - this runs when no command is specified
// or when the main command is called directly
async function main() {
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
