import chalk from "chalk";
import { listTasks, listProjects, type Task, type Project, type TaskStatus } from "../client";
import { loadConfig } from "../config";

// Valid task statuses
const VALID_STATUSES: TaskStatus[] = [
  "backlog",
  "ready",
  "in_progress",
  "review",
  "done",
  "blocked",
];

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
 * Truncate text to a maximum length
 * @param text - Text to truncate
 * @param maxLength - Maximum length
 * @returns Truncated text
 */
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + "...";
}

/**
 * Format task list as a readable table
 * @param tasks - Array of tasks
 * @returns Formatted table string
 */
export function formatTaskList(tasks: Task[]): string {
  if (tasks.length === 0) {
    return chalk.yellow("No tasks found.");
  }

  const lines: string[] = [];

  // Header
  lines.push(chalk.bold("\nTasks:"));
  lines.push("");

  // Column headers
  const headers = [
    chalk.bold("ID".padEnd(36)),
    chalk.bold("Title".padEnd(30)),
    chalk.bold("Status".padEnd(12)),
    chalk.bold("Type".padEnd(15)),
    chalk.bold("Created"),
  ];
  lines.push(headers.join("  "));
  lines.push(chalk.gray("-".repeat(100)));

  // Task rows
  for (const task of tasks) {
    const row = [
      task.id,
      truncate(task.title, 30).padEnd(30),
      formatStatus(task.status).padEnd(12),
      formatTaskType(task.taskType).padEnd(15),
      formatDate(task.createdAt),
    ];
    lines.push(row.join("  "));
  }

  lines.push("");
  lines.push(chalk.gray(`Total: ${tasks.length} task${tasks.length === 1 ? "" : "s"}`));

  return lines.join("\n");
}

/**
 * Format project list as a readable table
 * @param projects - Array of projects
 * @returns Formatted table string
 */
export function formatProjectList(projects: Project[]): string {
  if (projects.length === 0) {
    return chalk.yellow("No projects found.");
  }

  const lines: string[] = [];

  // Header
  lines.push(chalk.bold("\nProjects:"));
  lines.push("");

  // Column headers
  const headers = [
    chalk.bold("ID".padEnd(36)),
    chalk.bold("Name".padEnd(25)),
    chalk.bold("Description"),
  ];
  lines.push(headers.join("  "));
  lines.push(chalk.gray("-".repeat(90)));

  // Project rows
  for (const project of projects) {
    const row = [
      project.id,
      truncate(project.name, 25).padEnd(25),
      project.description ? truncate(project.description, 40) : chalk.gray("(no description)"),
    ];
    lines.push(row.join("  "));
  }

  lines.push("");
  lines.push(chalk.gray(`Total: ${projects.length} project${projects.length === 1 ? "" : "s"}`));

  return lines.join("\n");
}

/**
 * Format API error message for display
 * @param error - The error object from API call
 * @returns Formatted error message
 */
export function formatListError(error: unknown): string {
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
          return chalk.red(`Error: ${data.error || "Not found"}`);

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
 * Format projects API error message for display
 * @param error - The error object from API call
 * @returns Formatted error message
 */
export function formatProjectsError(error: unknown): string {
  return formatListError(error);
}

/**
 * Validate UUID format
 * @param uuid - The UUID string to validate
 * @returns True if valid UUID format
 */
function isValidUUID(uuid: string): boolean {
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return UUID_REGEX.test(uuid);
}

/**
 * Validate task status
 * @param status - The status to validate
 * @returns True if valid status
 */
function isValidStatus(status: string): status is TaskStatus {
  return VALID_STATUSES.includes(status as TaskStatus);
}

export interface ListCommandOptions {
  project?: string;
  status?: string;
}

/**
 * Execute the list tasks command
 * @param options - Command options
 * @returns Exit code (0 for success, 1 for error)
 */
export async function executeList(options: ListCommandOptions): Promise<number> {
  // Validate project ID format if provided
  if (options.project && !isValidUUID(options.project)) {
    console.error(chalk.red("Error: Invalid project ID format"));
    console.error(chalk.gray("Project ID must be a valid UUID (e.g., 550e8400-e29b-41d4-a716-446655440000)"));
    return 1;
  }

  // Validate status if provided
  if (options.status && !isValidStatus(options.status)) {
    console.error(chalk.red(`Error: Invalid status "${options.status}"`));
    console.error(chalk.gray(`Valid statuses: ${VALID_STATUSES.join(", ")}`));
    return 1;
  }

  try {
    const config = await loadConfig();

    // Build filters - use agent_id from config if not specified otherwise
    const filters = {
      projectId: options.project,
      status: options.status as TaskStatus | undefined,
      agentId: config.agent_id,
    };

    const tasks = await listTasks(filters);

    console.log(formatTaskList(tasks));
    return 0;
  } catch (error) {
    console.error(formatListError(error));
    return 1;
  }
}

/**
 * Execute the list projects command
 * @returns Exit code (0 for success, 1 for error)
 */
export async function executeProjects(): Promise<number> {
  try {
    const projects = await listProjects();

    console.log(formatProjectList(projects));
    return 0;
  } catch (error) {
    console.error(formatProjectsError(error));
    return 1;
  }
}
