import { loadConfig } from "./config";

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
  status: string;
  createdAt: string;
  updatedAt: string;
  claimedAt: string | null;
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
