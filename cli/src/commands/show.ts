import chalk from "chalk";
import { getTask, getAgent, getProject, type Task } from "../client";

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Format a date string to a readable format
 * @param dateStr - ISO date string
 * @returns Formatted date string
 */
function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Format status with color
 * @param status - Task status
 * @returns Colored status string
 */
function formatStatus(status: string): string {
  const statusColors: Record<string, (s: string) => string> = {
    backlog: chalk.gray,
    ready: chalk.blue,
    in_progress: chalk.yellow,
    review: chalk.magenta,
    done: chalk.green,
    blocked: chalk.red,
  };

  const colorFn = statusColors[status] || chalk.white;
  return colorFn(status);
}

/**
 * Format task type with color
 * @param taskType - Task type
 * @returns Colored task type string
 */
function formatTaskType(taskType: string): string {
  const typeColors: Record<string, (s: string) => string> = {
    implementation: chalk.cyan,
    bugfix: chalk.red,
    feature: chalk.green,
    deployment: chalk.magenta,
    documentation: chalk.blue,
    testing: chalk.yellow,
    research: chalk.gray,
    other: chalk.white,
  };

  const colorFn = typeColors[taskType] || chalk.white;
  return colorFn(taskType);
}

/**
 * Format task details for display
 * @param task - The task object
 * @param agentName - The agent name (or null if unclaimed)
 * @param projectName - The project name
 * @returns Formatted task details string
 */
export function formatTaskDetails(task: Task, agentName: string | null, projectName: string): string {
  const lines: string[] = [];

  // Header with task title
  lines.push("");
  lines.push(chalk.bold.cyan("═".repeat(60)));
  lines.push(chalk.bold.white(task.title));
  lines.push(chalk.bold.cyan("═".repeat(60)));
  lines.push("");

  // Description section
  lines.push(chalk.bold("Description:"));
  if (task.description) {
    lines.push(task.description);
  } else {
    lines.push(chalk.gray("(No description)"));
  }
  lines.push("");

  // Status and Type
  lines.push(chalk.bold("Status:     ") + formatStatus(task.status));
  lines.push(chalk.bold("Type:       ") + formatTaskType(task.taskType));
  lines.push("");

  // Assignment info
  lines.push(chalk.bold("Assigned to: ") + (agentName ? chalk.cyan(agentName) : chalk.gray("Unclaimed")));
  lines.push(chalk.bold("Project:    ") + chalk.cyan(projectName));
  lines.push("");

  // Timestamps
  lines.push(chalk.bold("Timestamps:"));
  lines.push("  " + chalk.gray("Created:   ") + formatDate(task.createdAt));
  lines.push("  " + chalk.gray("Updated:   ") + formatDate(task.updatedAt));
  if (task.claimedAt) {
    lines.push("  " + chalk.gray("Claimed:   ") + formatDate(task.claimedAt));
  }
  lines.push("");

  // Task ID at the bottom
  lines.push(chalk.gray("Task ID: ") + task.id);
  lines.push("");

  return lines.join("\n");
}

/**
 * Format API error message for display
 * @param error - The error object from API call
 * @returns Formatted error message
 */
export function formatShowError(error: unknown): string {
  // Handle API response errors
  if (error && typeof error === "object" && "response" in error) {
    const apiError = error as {
      response?: {
        status: number;
        data: {
          error: string;
          details?: unknown;
        };
      };
    };

    if (apiError.response) {
      const { status, data } = apiError.response;

      switch (status) {
        case 400:
          return chalk.red(`Error: ${data.error || "Invalid request"}`);

        case 404:
          return chalk.red(`Error: Task not found`);

        case 500:
          return chalk.red(`Error: Server error - ${data.error || "Please try again later"}`);

        default:
          return chalk.red(`Error: ${data.error || `HTTP ${status}`}`);
      }
    }
  }

  // Handle network errors
  if (error instanceof Error) {
    if (error.message.includes("fetch") || error.message.includes("connect") || error.message.includes("ECONNREFUSED")) {
      return chalk.red("Error: Unable to connect to API. Is the server running?");
    }
    return chalk.red(`Error: ${error.message}`);
  }

  return chalk.red("Error: An unexpected error occurred");
}

/**
 * Validate UUID format
 * @param uuid - The UUID string to validate
 * @returns True if valid UUID format
 */
function isValidUUID(uuid: string): boolean {
  return UUID_REGEX.test(uuid);
}

/**
 * Execute the show task command
 * @param taskId - The task ID to show
 * @returns Exit code (0 for success, 1 for error)
 */
export async function executeShow(taskId: string): Promise<number> {
  // Validate task ID format
  if (!isValidUUID(taskId)) {
    console.error(chalk.red("Error: Invalid task ID format"));
    console.error(chalk.gray("Task ID must be a valid UUID (e.g., 550e8400-e29b-41d4-a716-446655440000)"));
    return 1;
  }

  try {
    // Fetch the task
    const task = await getTask(taskId);

    // Fetch agent name if task is claimed
    let agentName: string | null = null;
    if (task.agentId) {
      try {
        const agent = await getAgent(task.agentId);
        agentName = agent.name;
      } catch {
        // If agent fetch fails, use the ID as fallback
        agentName = task.agentId;
      }
    }

    // Fetch project name
    let projectName: string;
    try {
      const project = await getProject(task.projectId);
      projectName = project.name;
    } catch {
      // If project fetch fails, use the ID as fallback
      projectName = task.projectId;
    }

    // Display task details
    console.log(formatTaskDetails(task, agentName, projectName));
    return 0;
  } catch (error) {
    console.error(formatShowError(error));
    return 1;
  }
}
