import { loadConfig } from "./config";

// Re-export task statuses for validation
export const TASK_STATUSES = [
  "backlog",
  "ready",
  "in_progress",
  "review",
  "done",
  "blocked",
] as const;

// Task type definitions matching the API schema
export type TaskType =
  | "implementation"
  | "bugfix"
  | "feature"
  | "deployment"
  | "documentation"
  | "testing"
  | "research"
  | "other";

export type TaskStatus =
  | "backlog"
  | "ready"
  | "in_progress"
  | "review"
  | "done"
  | "blocked";

export interface CreateTaskInput {
  projectId: string;
  title: string;
  taskType: TaskType;
  description?: string;
  requiresApproval?: boolean;
}

export interface Task {
  id: string;
  projectId: string;
  agentId: string | null;
  title: string;
  description: string | null;
  taskType: TaskType;
  requiresApproval: boolean;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
  claimedAt: string | null;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ListTasksFilters {
  projectId?: string;
  status?: TaskStatus;
  agentId?: string;
}

export interface ApiError {
  response?: {
    status: number;
    data: {
      error: string;
      details?: unknown;
    };
  };
  message?: string;
}

/**
 * Create a new task via the API
 * @param input - Task creation input
 * @returns The created task
 * @throws Error if the API request fails
 */
export async function createTask(input: CreateTaskInput): Promise<Task> {
  const config = await loadConfig();

  const payload = {
    projectId: input.projectId,
    title: input.title,
    description: input.description,
    taskType: input.taskType,
    requiresApproval: input.requiresApproval ?? false,
  };

  const response = await fetch(`${config.api_url}/api/tasks`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: "Unknown error" })) as { error: string };
    const error = new Error(errorData.error || `HTTP ${response.status}`) as Error & { response?: { status: number; data: typeof errorData } };
    error.response = {
      status: response.status,
      data: errorData,
    };
    throw error;
  }

  return response.json() as Promise<Task>;
}

/**
 * List tasks with optional filters
 * @param filters - Optional filters for project_id, status, agent_id
 * @returns Array of tasks matching the filters
 * @throws Error if the API request fails
 */
export async function listTasks(filters: ListTasksFilters = {}): Promise<Task[]> {
  const config = await loadConfig();

  // Build query string from filters
  const params = new URLSearchParams();
  if (filters.projectId) {
    params.append("project_id", filters.projectId);
  }
  if (filters.status) {
    params.append("status", filters.status);
  }
  if (filters.agentId) {
    params.append("agent_id", filters.agentId);
  }

  const queryString = params.toString();
  const url = `${config.api_url}/api/tasks${queryString ? `?${queryString}` : ""}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: "Unknown error" })) as { error: string };
    const error = new Error(errorData.error || `HTTP ${response.status}`) as Error & { response?: { status: number; data: typeof errorData } };
    error.response = {
      status: response.status,
      data: errorData,
    };
    throw error;
  }

  return response.json() as Promise<Task[]>;
}

/**
 * List all projects
 * @returns Array of all projects
 * @throws Error if the API request fails
 */
export async function listProjects(): Promise<Project[]> {
  const config = await loadConfig();

  const response = await fetch(`${config.api_url}/api/projects`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: "Unknown error" })) as { error: string };
    const error = new Error(errorData.error || `HTTP ${response.status}`) as Error & { response?: { status: number; data: typeof errorData } };
    error.response = {
      status: response.status,
      data: errorData,
    };
    throw error;
  }

  return response.json() as Promise<Project[]>;
}

/**
 * Claim a task for the configured agent
 * @param taskId - The ID of the task to claim
 * @returns The updated task
 * @throws Error if the API request fails (including 409 conflict)
 */
export async function claimTask(taskId: string): Promise<Task> {
  const config = await loadConfig();

  const response = await fetch(`${config.api_url}/api/tasks/${taskId}/claim`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ agentId: config.agent_id }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: "Unknown error" })) as { error: string; currentOwner?: { agentId: string; claimedAt: string | null } };
    const error = new Error(errorData.error || `HTTP ${response.status}`) as Error & { response?: { status: number; data: typeof errorData } };
    error.response = {
      status: response.status,
      data: errorData,
    };
    throw error;
  }

  return response.json() as Promise<Task>;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  status?: TaskStatus;
}

/**
 * Update a task
 * @param taskId - The ID of the task to update
 * @param updates - The fields to update
 * @returns The updated task
 * @throws Error if the API request fails
 */
export async function updateTask(taskId: string, updates: UpdateTaskInput): Promise<Task> {
  const config = await loadConfig();

  const response = await fetch(`${config.api_url}/api/tasks/${taskId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: "Unknown error" })) as { error: string };
    const error = new Error(errorData.error || `HTTP ${response.status}`) as Error & { response?: { status: number; data: typeof errorData } };
    error.response = {
      status: response.status,
      data: errorData,
    };
    throw error;
  }

  return response.json() as Promise<Task>;
}

/**
 * Release a claimed task
 * @param taskId - The ID of the task to release
 * @returns The updated task
 * @throws Error if the API request fails
 */
export async function releaseTask(taskId: string): Promise<Task> {
  const config = await loadConfig();

  const response = await fetch(`${config.api_url}/api/tasks/${taskId}/release`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: "Unknown error" })) as { error: string };
    const error = new Error(errorData.error || `HTTP ${response.status}`) as Error & { response?: { status: number; data: typeof errorData } };
    error.response = {
      status: response.status,
      data: errorData,
    };
    throw error;
  }

  return response.json() as Promise<Task>;
}
