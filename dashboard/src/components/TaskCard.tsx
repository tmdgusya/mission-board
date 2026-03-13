import React from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { Task } from "../lib/api-client";
import { STATUS_COLORS } from "../lib/status-transitions";
import { useAgents } from "../hooks/use-agents";

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

  const style: React.CSSProperties = {
    backgroundColor: isDragActive || isDragging ? "#334155" : "#1e293b",
    borderRadius: "8px",
    padding: "12px",
    marginBottom: "8px",
    border: `1px solid ${isDragActive || isDragging ? "#3b82f6" : "#334155"}`,
    cursor: "grab",
    transition: "border-color 0.2s, background-color 0.2s",
    opacity: isDragging ? 0.5 : 1,
    transform: CSS.Translate.toString(transform),
    boxShadow: isDragActive ? "0 4px 12px rgba(0,0,0,0.3)" : "none",
    userSelect: "none",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={handleClick}
      data-testid={`task-card-${task.id}`}
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
          data-testid="task-type-badge"
          style={{
            fontSize: "11px",
            padding: "2px 8px",
            borderRadius: "12px",
            backgroundColor: `${STATUS_COLORS[task.status]}20`,
            color: STATUS_COLORS[task.status],
            textTransform: "capitalize",
          }}
        >
          {task.taskType.replace("_", " ")}
        </span>
        <span
          data-testid="task-agent-name"
          style={{
            fontSize: "12px",
            color: "#94a3b8",
          }}
        >
          {agent ? agent.name : "Unclaimed"}
        </span>
      </div>
    </div>
  );
}
