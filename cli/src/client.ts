import { loadConfig, getAgentId } from "./config";
import { withTimeout, API_TIMEOUT_MS } from "./errors";

/**
 * Resolve the agent UUID from config, using the given agent name or the default.
 */
async function resolveAgentId(agentName?: string): Promise<{ apiUrl: string; agentId: string }> {
  const config = await loadConfig();
  const name = agentName || config.default_agent;
  if (!name) {
    throw new Error("No agent specified and no default_agent configured. Run 'mission init' first.");
  }
  return { apiUrl: config.api_url, agentId: getAgentId(config, name) };
}

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

  const response = await withTimeout(
    fetch(`${config.api_url}/api/tasks`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }),
    API_TIMEOUT_MS
  );

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

  const response = await withTimeout(
    fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    }),
    API_TIMEOUT_MS
  );

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

  const response = await withTimeout(
    fetch(`${config.api_url}/api/projects`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    }),
    API_TIMEOUT_MS
  );

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
export async function claimTask(taskId: string, agentName?: string): Promise<Task> {
  const { apiUrl, agentId } = await resolveAgentId(agentName);

  const response = await withTimeout(
    fetch(`${apiUrl}/api/tasks/${taskId}/claim`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ agentId }),
    }),
    API_TIMEOUT_MS
  );

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

  const response = await withTimeout(
    fetch(`${config.api_url}/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updates),
    }),
    API_TIMEOUT_MS
  );

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

  const response = await withTimeout(
    fetch(`${config.api_url}/api/tasks/${taskId}/release`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    }),
    API_TIMEOUT_MS
  );

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

export interface ApprovalRequest {
  id: string;
  taskId: string;
  agentId: string;
  actionRequested: string;
  status: "pending" | "approved" | "denied";
  reviewedBy: string | null;
  reviewedAt: string | null;
  notes: string | null;
  createdAt: string;
}

export interface Agent {
  id: string;
  name: string;
  createdAt: string;
  lastSeenAt: string;
}

/**
 * Get a single task by ID
 * @param taskId - The ID of the task to fetch
 * @returns The task details
 * @throws Error if the API request fails
 */
export async function getTask(taskId: string): Promise<Task> {
  const config = await loadConfig();

  const response = await withTimeout(
    fetch(`${config.api_url}/api/tasks/${taskId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    }),
    API_TIMEOUT_MS
  );

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
 * Get a single agent by ID
 * @param agentId - The ID of the agent to fetch
 * @returns The agent details
 * @throws Error if the API request fails
 */
export async function getAgent(agentId: string): Promise<Agent> {
  const config = await loadConfig();

  const response = await withTimeout(
    fetch(`${config.api_url}/api/agents/${agentId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    }),
    API_TIMEOUT_MS
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: "Unknown error" })) as { error: string };
    const error = new Error(errorData.error || `HTTP ${response.status}`) as Error & { response?: { status: number; data: typeof errorData } };
    error.response = {
      status: response.status,
      data: errorData,
    };
    throw error;
  }

  return response.json() as Promise<Agent>;
}

/**
 * Get a single project by ID
 * @param projectId - The ID of the project to fetch
 * @returns The project details
 * @throws Error if the API request fails
 */
export async function getProject(projectId: string): Promise<Project> {
  const config = await loadConfig();

  const response = await withTimeout(
    fetch(`${config.api_url}/api/projects/${projectId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    }),
    API_TIMEOUT_MS
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: "Unknown error" })) as { error: string };
    const error = new Error(errorData.error || `HTTP ${response.status}`) as Error & { response?: { status: number; data: typeof errorData } };
    error.response = {
      status: response.status,
      data: errorData,
    };
    throw error;
  }

  return response.json() as Promise<Project>;
}

/**
 * Request approval for a task
 * @param taskId - The ID of the task to request approval for
 * @param actionRequested - Description of the action requiring approval
 * @returns The created approval request
 * @throws Error if the API request fails
 */
export async function requestApproval(taskId: string, actionRequested: string, agentName?: string): Promise<ApprovalRequest> {
  const { apiUrl, agentId } = await resolveAgentId(agentName);

  const response = await withTimeout(
    fetch(`${apiUrl}/api/approvals`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        taskId,
        agentId,
        actionRequested,
      }),
    }),
    API_TIMEOUT_MS
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: "Unknown error" })) as { error: string };
    const error = new Error(errorData.error || `HTTP ${response.status}`) as Error & { response?: { status: number; data: typeof errorData } };
    error.response = {
      status: response.status,
      data: errorData,
    };
    throw error;
  }

  return response.json() as Promise<ApprovalRequest>;
}

/**
 * Check approval status for a task
 * @param taskId - The ID of the task to check approval status for
 * @returns Array of approval requests for the task
 * @throws Error if the API request fails
 */
export async function checkApproval(taskId: string): Promise<ApprovalRequest[]> {
  const config = await loadConfig();

  const params = new URLSearchParams();
  params.append("task_id", taskId);

  const response = await withTimeout(
    fetch(`${config.api_url}/api/approvals?${params.toString()}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    }),
    API_TIMEOUT_MS
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: "Unknown error" })) as { error: string };
    const error = new Error(errorData.error || `HTTP ${response.status}`) as Error & { response?: { status: number; data: typeof errorData } };
    error.response = {
      status: response.status,
      data: errorData,
    };
    throw error;
  }

  return response.json() as Promise<ApprovalRequest[]>;
}
