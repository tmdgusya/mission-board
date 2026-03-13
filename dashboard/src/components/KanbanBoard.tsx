import React, { useState, useCallback, useEffect } from "react";
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
import { LoadingState, ErrorState, EmptyState } from "./BoardStates";

interface KanbanBoardProps {
  tasks: Task[];
  isLoading: boolean;
  error: Error | null;
  onRetry: () => void;
  onTaskClick?: (taskId: string) => void;
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
}

export function KanbanBoard({
  tasks,
  isLoading,
  error: tasksError,
  onRetry: refetchTasks,
  onTaskClick,
  hasActiveFilters = false,
  onClearFilters,
}: KanbanBoardProps): React.ReactElement {
  const { data: healthData, error: healthError, refetch: refetchHealth, isFetching: isHealthFetching } = useApiHealth();
  const updateTask = useUpdateTask();
  const handleApiError = useHandleApiError();
  const { messages, addToast, dismissToast } = useToast();

  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Responsive detection
  useEffect(() => {
    const checkMobile = (): void => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

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
    setIsRetrying(true);
    Promise.all([refetchHealth(), refetchTasks()])
      .finally(() => setIsRetrying(false));
  }, [refetchHealth, refetchTasks]);

  // Error state
  if (healthError || tasksError) {
    return (
      <ErrorState
        onRetry={handleRetry}
        isRetrying={isRetrying}
        details={healthError
          ? "Unable to connect to the API server. Make sure it's running on port 3200."
          : "Failed to load tasks. Please check your connection and try again."}
      />
    );
  }

  // Loading state
  if (isLoading) {
    return <LoadingState />;
  }

  // Empty state
  if (tasks.length === 0) {
    return (
      <EmptyState
        hasActiveFilters={hasActiveFilters}
        onClearFilters={onClearFilters}
      />
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
          marginBottom: isMobile ? "16px" : "24px",
        }}
      >
        <h1
          style={{
            fontSize: isMobile ? "20px" : "24px",
            fontWeight: 700,
            color: "#f1f5f9",
          }}
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
            display: isMobile ? "flex" : "flex",
            flexDirection: isMobile ? "column" : "row",
            gap: isMobile ? "12px" : "16px",
            overflowX: isMobile ? "visible" : "auto",
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
              isMobile={isMobile}
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
