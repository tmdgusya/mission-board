import React, { useState, useMemo, useCallback } from "react";
import { useTasks } from "../hooks/use-tasks";
import { KanbanBoard } from "./KanbanBoard";
import {
  Filters,
  DEFAULT_FILTERS,
  buildApiParams,
  applyClientFilters,
  type FilterState,
} from "./Filters";
import { TaskDetail } from "./TaskDetail";
import { CreateTaskForm } from "./CreateTaskForm";

export function DashboardContent(): React.ReactElement {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isCreateFormOpen, setIsCreateFormOpen] = useState(false);

  const apiParams = useMemo(() => buildApiParams(filters), [filters]);
  const {
    data: tasks = [],
    isLoading,
    error: tasksError,
    refetch: refetchTasks,
  } = useTasks(apiParams);

  const filteredTasks = useMemo(
    () => applyClientFilters(tasks, filters),
    [tasks, filters]
  );

  const handleTaskClick = useCallback((taskId: string) => {
    setSelectedTaskId(taskId);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setSelectedTaskId(null);
  }, []);

  const handleOpenCreateForm = useCallback(() => {
    setIsCreateFormOpen(true);
  }, []);

  const handleCloseCreateForm = useCallback(() => {
    setIsCreateFormOpen(false);
  }, []);

  const hasActiveFilters = useMemo(
    () =>
      filters.projectId !== "" ||
      filters.status !== "" ||
      filters.agentId !== "" ||
      filters.search !== "",
    [filters]
  );

  const handleClearFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  return (
    <div
      style={{
        padding: "24px",
        maxWidth: "100%",
        // Responsive: use CSS media query approach via style override
      }}
      className="dashboard-container"
    >
      {/* Header with New Task button */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "16px",
        }}
      >
        <h1
          style={{
            fontSize: "24px",
            fontWeight: 700,
            color: "#f1f5f9",
            margin: 0,
          }}
        >
          Mission Board
        </h1>
        <button
          data-testid="new-task-button"
          onClick={handleOpenCreateForm}
          style={{
            padding: "8px 16px",
            borderRadius: "6px",
            fontSize: "13px",
            fontWeight: 500,
            cursor: "pointer",
            border: "1px solid transparent",
            backgroundColor: "#22c55e",
            color: "white",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "#16a34a";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "#22c55e";
          }}
        >
          + New Task
        </button>
      </div>

      <Filters
        filters={filters}
        onFiltersChange={setFilters}
        tasks={filteredTasks}
      />
      <KanbanBoard
        tasks={filteredTasks}
        isLoading={isLoading}
        error={tasksError}
        onRetry={refetchTasks}
        onTaskClick={handleTaskClick}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={handleClearFilters}
      />
      <TaskDetail taskId={selectedTaskId} onClose={handleCloseDetail} />
      <CreateTaskForm isOpen={isCreateFormOpen} onClose={handleCloseCreateForm} />
    </div>
  );
}
