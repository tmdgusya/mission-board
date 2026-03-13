import React from "react";
import { useDroppable } from "@dnd-kit/core";
import type { Task } from "../lib/api-client";
import { STATUS_LABELS, STATUS_COLORS, type TaskStatus } from "../lib/status-transitions";
import { TaskCard } from "./TaskCard";

interface KanbanColumnProps {
  status: TaskStatus;
  tasks: Task[];
  activeTaskId: string | null;
}

export function KanbanColumn({
  status,
  tasks,
  activeTaskId,
}: KanbanColumnProps): React.ReactElement {
  const { isOver, setNodeRef } = useDroppable({
    id: `column-${status}`,
    data: { status },
  });

  const columnStyle: React.CSSProperties = {
    backgroundColor: isOver ? "#1a2332" : "#0f172a",
    borderRadius: "8px",
    padding: "16px",
    minWidth: "280px",
    flex: 1,
    border: `1px solid ${isOver ? STATUS_COLORS[status] : "#1e293b"}`,
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
          borderBottom: `2px solid ${STATUS_COLORS[status]}`,
        }}
      >
        <h3
          style={{ fontSize: "14px", fontWeight: 600, color: "#e2e8f0" }}
          data-testid={`column-header-${status}`}
        >
          {STATUS_LABELS[status]}
        </h3>
        <span
          style={{
            fontSize: "12px",
            backgroundColor: "#1e293b",
            padding: "2px 8px",
            borderRadius: "12px",
            color: "#94a3b8",
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
              color: "#475569",
              fontSize: "13px",
              padding: "20px 0",
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
            />
          ))
        )}
      </div>
    </div>
  );
}
