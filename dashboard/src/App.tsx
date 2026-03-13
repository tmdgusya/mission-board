import React, { type ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/query-client";
import { useApiHealth } from "./hooks/use-api-health";
import { useTasks } from "./hooks/use-tasks";

function LoadingIndicator(): ReactNode {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "40px",
      }}
    >
      <div
        style={{
          width: "40px",
          height: "40px",
          border: "3px solid #334155",
          borderTopColor: "#3b82f6",
          borderRadius: "50%",
          animation: "spin 1s linear infinite",
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}): ReactNode {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px",
        gap: "16px",
      }}
    >
      <div style={{ color: "#ef4444", fontSize: "18px", fontWeight: "bold" }}>
        Connection Error
      </div>
      <div style={{ color: "#94a3b8", textAlign: "center" }}>{message}</div>
      <button
        onClick={onRetry}
        style={{
          padding: "8px 24px",
          backgroundColor: "#3b82f6",
          color: "white",
          border: "none",
          borderRadius: "6px",
          cursor: "pointer",
          fontSize: "14px",
        }}
      >
        Retry
      </button>
    </div>
  );
}

const TASK_STATUSES = [
  "backlog",
  "ready",
  "in_progress",
  "review",
  "done",
  "blocked",
] as const;

const STATUS_LABELS: Record<string, string> = {
  backlog: "Backlog",
  ready: "Ready",
  in_progress: "In Progress",
  review: "Review",
  done: "Done",
  blocked: "Blocked",
};

const STATUS_COLORS: Record<string, string> = {
  backlog: "#64748b",
  ready: "#3b82f6",
  in_progress: "#f59e0b",
  review: "#8b5cf6",
  done: "#22c55e",
  blocked: "#ef4444",
};

function TaskCard({
  task,
}: {
  task: {
    id: string;
    title: string;
    status: string;
    agent_id: string | null;
    task_type: string;
  };
}): React.ReactElement {
  return (
    <div
      style={{
        backgroundColor: "#1e293b",
        borderRadius: "8px",
        padding: "12px",
        marginBottom: "8px",
        border: "1px solid #334155",
        cursor: "pointer",
        transition: "border-color 0.2s",
      }}
    >
      <div style={{ fontSize: "14px", fontWeight: 500, marginBottom: "8px" }}>
        {task.title}
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span
          style={{
            fontSize: "11px",
            padding: "2px 8px",
            borderRadius: "12px",
            backgroundColor: `${STATUS_COLORS[task.status]}20`,
            color: STATUS_COLORS[task.status],
          }}
        >
          {task.task_type}
        </span>
        <span
          style={{
            fontSize: "12px",
            color: "#94a3b8",
          }}
        >
          {task.agent_id ? task.agent_id.slice(0, 8) + "..." : "Unclaimed"}
        </span>
      </div>
    </div>
  );
}

function KanbanColumn({
  title,
  status,
  tasks,
}: {
  title: string;
  status: string;
  tasks: Array<{
    id: string;
    title: string;
    status: string;
    agent_id: string | null;
    task_type: string;
  }>;
}): ReactNode {
  return (
    <div
      style={{
        backgroundColor: "#0f172a",
        borderRadius: "8px",
        padding: "16px",
        minWidth: "280px",
        flex: 1,
        border: "1px solid #1e293b",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "12px",
          paddingBottom: "8px",
          borderBottom: `2px solid ${STATUS_COLORS[status]}`,
        }}
      >
        <h3 style={{ fontSize: "14px", fontWeight: 600, color: "#e2e8f0" }}>
          {title}
        </h3>
        <span
          style={{
            fontSize: "12px",
            backgroundColor: "#1e293b",
            padding: "2px 8px",
            borderRadius: "12px",
            color: "#94a3b8",
          }}
        >
          {tasks.length}
        </span>
      </div>
      <div>
        {tasks.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              color: "#475569",
              fontSize: "13px",
              padding: "20px 0",
            }}
          >
            No tasks
          </div>
        ) : (
          tasks.map((task) => <TaskCard key={task.id} task={task} />)
        )}
      </div>
    </div>
  );
}

function Dashboard(): ReactNode {
  const { data: healthData, error: healthError, refetch: refetchHealth } = useApiHealth();
  const { data: tasks, isLoading: tasksLoading, error: tasksError, refetch: refetchTasks } = useTasks();

  if (healthError || tasksError) {
    return (
      <ErrorState
        message="Unable to connect to the API server. Make sure it's running on port 3200."
        onRetry={() => {
          refetchHealth();
          refetchTasks();
        }}
      />
    );
  }

  if (tasksLoading) {
    return <LoadingIndicator />;
  }

  const tasksByStatus: Record<string, typeof tasks> = {};
  for (const status of TASK_STATUSES) {
    tasksByStatus[status] = (tasks || []).filter((t) => t.status === status);
  }

  return (
    <div style={{ padding: "24px", maxWidth: "100%" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "24px",
        }}
      >
        <h1 style={{ fontSize: "24px", fontWeight: 700, color: "#f1f5f9" }}>
          Mission Board
        </h1>
        <div
          style={{
            fontSize: "12px",
            color: healthData?.status === "ok" ? "#22c55e" : "#ef4444",
          }}
        >
          {healthData?.status === "ok" ? "● Connected" : "● Disconnected"}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: "16px",
          overflowX: "auto",
          paddingBottom: "16px",
        }}
      >
        {TASK_STATUSES.map((status) => (
          <KanbanColumn
            key={status}
            title={STATUS_LABELS[status] ?? status}
            status={status}
            tasks={tasksByStatus[status] ?? []}
          />
        ))}
      </div>
    </div>
  );
}

export default function App(): ReactNode {
  return (
    <QueryClientProvider client={queryClient}>
      <Dashboard />
    </QueryClientProvider>
  );
}
