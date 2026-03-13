import React, { useState, useCallback } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from "@dnd-kit/core";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import type { Task } from "../lib/api-client";
import {
  TASK_STATUSES,
  STATUS_LABELS,
  isValidStatusTransition,
  getInvalidTransitionMessage,
  type TaskStatus,
} from "../lib/status-transitions";
import { useApiHealth } from "../hooks/use-api-health";
import { useUpdateTask, useHandleApiError } from "../hooks/use-update-task";
import { KanbanColumn } from "./KanbanColumn";
import { TaskCard } from "./TaskCard";
import { Toast, useToast } from "./Toast";

interface KanbanBoardProps {
  tasks: Task[];
  isLoading: boolean;
  error: Error | null;
  onRetry: () => void;
  onTaskClick?: (taskId: string) => void;
}

export function KanbanBoard({
  tasks,
  isLoading,
  error: tasksError,
  onRetry: refetchTasks,
  onTaskClick,
}: KanbanBoardProps): React.ReactElement {
  const { data: healthData, error: healthError, refetch: refetchHealth } = useApiHealth();
  const updateTask = useUpdateTask();
  const handleApiError = useHandleApiError();
  const { messages, addToast, dismissToast } = useToast();

  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const task = tasks.find((t) => t.id === event.active.id);
      if (task) {
        setActiveTask(task);
      }
    },
    [tasks]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveTask(null);

      const { active, over } = event;
      if (!over) return;

      const taskId = active.id as string;
      const overId = over.id as string;

      // Determine target status from droppable id
      const targetStatus = overId.replace("column-", "") as TaskStatus;
      const task = tasks.find((t) => t.id === taskId);
      if (!task || task.status === targetStatus) return;

      // Validate status transition
      if (!isValidStatusTransition(task.status as TaskStatus, targetStatus)) {
        addToast(
          getInvalidTransitionMessage(task.status as TaskStatus, targetStatus),
          "error"
        );
        return;
      }

      // Call API to update task status
      updateTask.mutate(
        { id: taskId, data: { status: targetStatus } },
        {
          onSuccess: () => {
            addToast(
              `Task moved to ${STATUS_LABELS[targetStatus]}`,
              "success"
            );
          },
          onError: (error) => {
            addToast(handleApiError(error), "error");
          },
        }
      );
    },
    [tasks, updateTask, addToast, handleApiError]
  );

  const handleDragCancel = useCallback(() => {
    setActiveTask(null);
  }, []);

  const handleRetry = useCallback(() => {
    refetchHealth();
    refetchTasks();
  }, [refetchHealth, refetchTasks]);

  // Error state
  if (healthError || tasksError) {
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
        data-testid="error-state"
      >
        <div style={{ color: "#ef4444", fontSize: "18px", fontWeight: "bold" }}>
          Connection Error
        </div>
        <div style={{ color: "#94a3b8", textAlign: "center" }}>
          Unable to connect to the API server. Make sure it&apos;s running on port 3200.
        </div>
        <button
          onClick={handleRetry}
          style={{
            padding: "8px 24px",
            backgroundColor: "#3b82f6",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontSize: "14px",
          }}
          data-testid="retry-button"
        >
          Retry
        </button>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div
        data-testid="loading-state"
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

  const tasksByStatus = new Map<TaskStatus, Task[]>();
  for (const status of TASK_STATUSES) {
    tasksByStatus.set(status, tasks.filter((t) => t.status === status));
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "24px",
        }}
      >
        <h1
          style={{ fontSize: "24px", fontWeight: 700, color: "#f1f5f9" }}
          data-testid="board-title"
        >
          Mission Board
        </h1>
        <div
          style={{
            fontSize: "12px",
            color: healthData?.status === "ok" ? "#22c55e" : "#ef4444",
          }}
          data-testid="connection-status"
        >
          {healthData?.status === "ok" ? "● Connected" : "● Disconnected"}
        </div>
      </div>

      <Toast messages={messages} onDismiss={dismissToast} />
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div
          data-testid="kanban-board"
          style={{
            display: "flex",
            gap: "16px",
            overflowX: "auto",
            paddingBottom: "16px",
            minHeight: "400px",
          }}
        >
          {TASK_STATUSES.map((status) => (
            <KanbanColumn
              key={status}
              status={status}
              tasks={tasksByStatus.get(status) ?? []}
              activeTaskId={activeTask?.id ?? null}
              onTaskClick={onTaskClick}
            />
          ))}
        </div>
        <DragOverlay>
          {activeTask ? <TaskCard task={activeTask} isDragging /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
