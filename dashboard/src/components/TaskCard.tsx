import React from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { Task } from "../lib/api-client";
import { STATUS_COLORS } from "../lib/status-transitions";
import { useAgents } from "../hooks/use-agents";
import { AgentProgressBar } from "./AgentProgressBar";

const TASK_TYPE_COLORS: Record<string, string> = {
  bug: "#ef4444",
  feature: "#3b82f6",
  improvement: "#f59e0b",
  research: "#8b5cf6",
  maintenance: "#64748b",
};

function getTaskTypeColor(taskType: string): string {
  return TASK_TYPE_COLORS[taskType] ?? "#00ffcc";
}

interface TaskCardProps {
  task: Task;
  isDragging?: boolean;
  onTaskClick?: (taskId: string) => void;
}

export function TaskCard({ task, isDragging, onTaskClick }: TaskCardProps): React.ReactElement {
  const { attributes, listeners, setNodeRef, transform, isDragging: isDragActive } =
    useDraggable({
      id: task.id,
      data: { task },
    });

  const { data: agents } = useAgents();
  const agent = agents?.find((a) => a.id === task.agentId);

  const handleClick = (): void => {
    if (onTaskClick && !isDragActive) {
      onTaskClick(task.id);
    }
  };

  const isActiveWithAgent = task.status === "in_progress" && !!task.agentId;
  const statusColor = STATUS_COLORS[task.status] ?? "#64748b";

  const style: React.CSSProperties = {
    backgroundColor: "#0a0a0a",
    borderRadius: "8px",
    padding: "12px",
    marginBottom: "8px",
    border: "1px solid rgba(0,255,204,0.12)",
    borderLeft: `2px solid ${getTaskTypeColor(task.taskType)}`,
    cursor: "grab",
    transition: "all 150ms ease",
    opacity: isDragging ? 0.5 : 1,
    transform: CSS.Translate.toString(transform),
    boxShadow: isDragActive ? "0 0 12px rgba(0,255,204,0.3)" : "none",
    userSelect: "none",
    overflow: "hidden",
    position: "relative",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={handleClick}
      data-testid={`task-card-${task.id}`}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "rgba(0,255,204,0.4)";
        e.currentTarget.style.boxShadow = "0 0 12px rgba(0,255,204,0.3)";
        e.currentTarget.style.transform = `translateY(-1px) ${CSS.Translate.toString(transform) ?? ""}`.trim();
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "rgba(0,255,204,0.12)";
        e.currentTarget.style.borderLeftColor = getTaskTypeColor(task.taskType);
        e.currentTarget.style.boxShadow = isDragActive ? "0 0 12px rgba(0,255,204,0.3)" : "none";
        e.currentTarget.style.transform = CSS.Translate.toString(transform) ?? "";
      }}
    >
      <AgentProgressBar isActive={isActiveWithAgent} />
      <div style={{ fontSize: "14px", fontWeight: 500, marginBottom: "8px", color: "#e2e8f0" }}>
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
          data-testid="task-type-badge"
          style={{
            fontSize: "11px",
            padding: "2px 8px",
            borderRadius: "12px",
            backgroundColor: `${statusColor}20`,
            color: statusColor,
            boxShadow: `0 0 4px ${statusColor}`,
            textTransform: "capitalize",
          }}
        >
          {task.taskType.replace("_", " ")}
        </span>
        <span
          data-testid="task-agent-name"
          style={{
            fontSize: "12px",
            color: agent ? "#00ff66" : "#94a3b8",
            fontFamily: "monospace",
          }}
        >
          {agent ? agent.name : "Unclaimed"}
        </span>
      </div>
    </div>
  );
}
