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

  // Approvals
  async listApprovals(params?: ApprovalQueryParams): Promise<ApprovalRequest[]> {
    const searchParams = new URLSearchParams();
    if (params?.task_id) searchParams.set("task_id", params.task_id);
    if (params?.status) searchParams.set("status", params.status);
    const query = searchParams.toString();
    return this.request<ApprovalRequest[]>(
      `/api/approvals${query ? `?${query}` : ""}`
    );
  }

  async approveRequest(
    id: string,
    reviewedBy: string
  ): Promise<ApprovalRequest> {
    return this.request<ApprovalRequest>(`/api/approvals/${id}/approve`, {
      method: "POST",
      body: JSON.stringify({ reviewedBy }),
    });
  }

  async denyRequest(
    id: string,
    reviewedBy: string,
    notes: string
  ): Promise<ApprovalRequest> {
    return this.request<ApprovalRequest>(`/api/approvals/${id}/deny`, {
      method: "POST",
      body: JSON.stringify({ reviewedBy, notes }),
    });
  }

  // Health
  async healthCheck(): Promise<{ status: string }> {
    return this.request<{ status: string }>("/api/health");
  }

  // Analytics
  async getAgentStats(params?: { project_id?: string; date_from?: string; date_to?: string }): Promise<AgentStat[]> {
    const searchParams = new URLSearchParams();
    if (params?.project_id) searchParams.set("project_id", params.project_id);
    if (params?.date_from) searchParams.set("date_from", params.date_from);
    if (params?.date_to) searchParams.set("date_to", params.date_to);
    const query = searchParams.toString();
    return this.request<AgentStat[]>(
      `/api/analytics/agents${query ? `?${query}` : ""}`
    );
  }

  async getTaskMetrics(params?: { project_id?: string; date_from?: string; date_to?: string }): Promise<TaskMetrics> {
    const searchParams = new URLSearchParams();
    if (params?.project_id) searchParams.set("project_id", params.project_id);
    if (params?.date_from) searchParams.set("date_from", params.date_from);
    if (params?.date_to) searchParams.set("date_to", params.date_to);
    const query = searchParams.toString();
    return this.request<TaskMetrics>(
      `/api/analytics/tasks${query ? `?${query}` : ""}`
    );
  }

  async getTimeTrackingMetrics(params?: {
    project_id?: string;
    date_from?: string;
    date_to?: string;
  }): Promise<TimeTrackingMetrics> {
    const searchParams = new URLSearchParams();
    if (params?.project_id) searchParams.set("project_id", params.project_id);
    if (params?.date_from) searchParams.set("date_from", params.date_from);
    if (params?.date_to) searchParams.set("date_to", params.date_to);
    const query = searchParams.toString();
    return this.request<TimeTrackingMetrics>(
      `/api/analytics/time-tracking${query ? `?${query}` : ""}`
    );
  }

  async getVelocity(params?: {
    project_id?: string;
    date_from?: string;
    date_to?: string;
  }): Promise<VelocityDataPoint[]> {
    const searchParams = new URLSearchParams();
    if (params?.project_id) searchParams.set("project_id", params.project_id);
    if (params?.date_from) searchParams.set("date_from", params.date_from);
    if (params?.date_to) searchParams.set("date_to", params.date_to);
    const query = searchParams.toString();
    return this.request<VelocityDataPoint[]>(
      `/api/analytics/velocity${query ? `?${query}` : ""}`
    );
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

export interface TranscriptStep {
  step: number;
  thought: string;
}

export interface TaskLog {
  id: string;
  taskId: string;
  agentId: string | null;
  action: string;
  details: Record<string, unknown>;
  reason: string | null;
  transcript: TranscriptStep[] | null;
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

export interface ApprovalQueryParams {
  task_id?: string;
  status?: string;
}

// Analytics types
export interface AgentStat {
  agentId: string;
  agentName: string;
  tasksCompleted: number;
  tasksInProgress: number;
  totalTasks: number;
  avgCompletionTimeMs: number | null;
  successRate: number | null;
}

export interface TaskMetrics {
  totalTasks: number;
  statusCounts: Record<string, number>;
  completionRate: number;
  avgTimeToCompletionMs: number | null;
}

export interface TimeTrackingMetrics {
  avgCreatedToClaimedMs: number | null;
  avgClaimedToCompletedMs: number | null;
  tasksWithClaimData: number;
  tasksWithCompletionData: number;
}

export interface VelocityDataPoint {
  date: string;
  count: number;
}
