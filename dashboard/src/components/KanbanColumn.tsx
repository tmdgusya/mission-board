import React from "react";
import { useDroppable } from "@dnd-kit/core";
import type { Task } from "../lib/api-client";
import { STATUS_LABELS, STATUS_COLORS, type TaskStatus } from "../lib/status-transitions";
import { TaskCard } from "./TaskCard";

interface KanbanColumnProps {
  status: TaskStatus;
  tasks: Task[];
  activeTaskId: string | null;
  onTaskClick?: (taskId: string) => void;
  isMobile?: boolean;
}

export function KanbanColumn({
  status,
  tasks,
  activeTaskId,
  onTaskClick,
  isMobile = false,
}: KanbanColumnProps): React.ReactElement {
  const { isOver, setNodeRef } = useDroppable({
    id: `column-${status}`,
    data: { status },
  });

  const columnStyle: React.CSSProperties = {
    backgroundColor: isOver ? "rgba(0,255,204,0.04)" : "rgba(0,255,204,0.02)",
    borderRadius: "2px",
    padding: isMobile ? "12px" : "16px",
    minWidth: isMobile ? "auto" : "280px",
    flex: isMobile ? undefined : 1,
    border: `1px solid ${isOver ? "rgba(0,255,204,0.2)" : "rgba(0,255,204,0.08)"}`,
    transition: "border-color 0.2s, background-color 0.2s",
  };

  return (
    <div ref={setNodeRef} style={columnStyle} data-testid={`kanban-column-${status}`}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "12px",
          paddingBottom: "8px",
          borderBottom: "1px solid rgba(0,255,204,0.1)",
        }}
      >
        <h3
          style={{
            fontSize: "14px",
            fontWeight: 600,
            color: "rgba(0,255,204,0.6)",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
          }}
          data-testid={`column-header-${status}`}
        >
          {STATUS_LABELS[status]}
        </h3>
        <span
          style={{
            fontSize: "12px",
            backgroundColor: "rgba(0,255,204,0.08)",
            padding: "2px 8px",
            borderRadius: "2px",
            color: "#555555",
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
          }}
          data-testid={`column-count-${status}`}
        >
          {tasks.length}
        </span>
      </div>
      <div style={{ minHeight: "60px" }}>
        {tasks.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              color: "#555555",
              fontSize: "13px",
              padding: "20px 0",
              fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
            }}
            data-testid={`column-empty-${status}`}
          >
            No tasks
          </div>
        ) : (
          tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              isDragging={task.id === activeTaskId}
              onTaskClick={onTaskClick}
            />
          ))
        )}
      </div>
    </div>
  );
}
