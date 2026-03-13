const API_BASE_URL =
  (typeof process !== "undefined" && process.env?.VITE_API_URL) || "http://localhost:3200";

export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || API_BASE_URL;
  }

  private async request<T>(
    path: string,
    options?: RequestInit
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
      },
      ...options,
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({
        error: `Request failed with status ${response.status}`,
      }));
      const message =
        typeof errorBody === "object" &&
        errorBody !== null &&
        "error" in errorBody
          ? String(errorBody.error)
          : "Unknown error";
      throw new ApiError(response.status, message);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }

  // Projects
  async listProjects(): Promise<Project[]> {
    return this.request<Project[]>("/api/projects");
  }

  async getProject(id: string): Promise<Project> {
    return this.request<Project>(`/api/projects/${id}`);
  }

  async createProject(data: {
    name: string;
    description?: string;
  }): Promise<Project> {
    return this.request<Project>("/api/projects", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // Tasks
  async listTasks(params?: TaskQueryParams): Promise<Task[]> {
    const searchParams = new URLSearchParams();
    if (params?.project_id) searchParams.set("project_id", params.project_id);
    if (params?.status) searchParams.set("status", params.status);
    if (params?.agent_id) searchParams.set("agent_id", params.agent_id);
    const query = searchParams.toString();
    return this.request<Task[]>(
      `/api/tasks${query ? `?${query}` : ""}`
    );
  }

  async getTask(id: string): Promise<Task> {
    return this.request<Task>(`/api/tasks/${id}`);
  }

  async createTask(data: {
    title: string;
    projectId: string;
    agentId?: string;
    description?: string;
    taskType?: string;
    requiresApproval?: boolean;
  }): Promise<Task> {
    return this.request<Task>("/api/tasks", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateTask(
    id: string,
    data: { title?: string; description?: string; status?: string }
  ): Promise<Task> {
    return this.request<Task>(`/api/tasks/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async deleteTask(id: string): Promise<void> {
    return this.request<void>(`/api/tasks/${id}`, {
      method: "DELETE",
    });
  }

  async claimTask(
    id: string,
    agentId: string
  ): Promise<Task> {
    return this.request<Task>(`/api/tasks/${id}/claim`, {
      method: "POST",
      body: JSON.stringify({ agentId }),
    });
  }

  async releaseTask(id: string): Promise<Task> {
    return this.request<Task>(`/api/tasks/${id}/release`, {
      method: "POST",
    });
  }

  // Agents
  async listAgents(): Promise<Agent[]> {
    return this.request<Agent[]>("/api/agents");
  }

  async getAgent(id: string): Promise<Agent> {
    return this.request<Agent>(`/api/agents/${id}`);
  }

  // Logs
  async listLogs(params?: LogQueryParams): Promise<TaskLog[]> {
    const searchParams = new URLSearchParams();
    if (params?.task_id) searchParams.set("task_id", params.task_id);
    if (params?.agent_id) searchParams.set("agent_id", params.agent_id);
    if (params?.project_id) searchParams.set("project_id", params.project_id);
    if (params?.action) searchParams.set("action", params.action);
    const query = searchParams.toString();
    return this.request<TaskLog[]>(
      `/api/logs${query ? `?${query}` : ""}`
    );
  }

  // Health
  async healthCheck(): Promise<{ status: string }> {
    return this.request<{ status: string }>("/api/health");
  }
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// Singleton instance
export const apiClient = new ApiClient();

// Types matching the API response format (camelCase)
export interface Project {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  projectId: string;
  agentId: string | null;
  title: string;
  description: string | null;
  taskType: string;
  requiresApproval: boolean;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
  claimedAt: string | null;
}

export type TaskStatus =
  | "backlog"
  | "ready"
  | "in_progress"
  | "review"
  | "done"
  | "blocked";

export interface Agent {
  id: string;
  name: string;
  createdAt: string;
  lastSeenAt: string;
}

export interface TaskLog {
  id: string;
  taskId: string;
  agentId: string;
  action: string;
  details: Record<string, unknown>;
  createdAt: string;
}

export interface TaskQueryParams {
  project_id?: string;
  status?: string;
  agent_id?: string;
}

export interface LogQueryParams {
  task_id?: string;
  agent_id?: string;
  project_id?: string;
  action?: string;
}
