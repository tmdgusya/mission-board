import React, { useState, useMemo, useCallback } from "react";
import { useTasks } from "../hooks/use-tasks";
import { useApprovals } from "../hooks/use-approvals";
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
import { ApprovalQueue } from "./ApprovalQueue";

type View = "board" | "approvals";

export function DashboardContent(): React.ReactElement {
  const [currentView, setCurrentView] = useState<View>("board");
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

  // Fetch pending approvals count for the badge
  const { data: pendingApprovals = [] } = useApprovals({ status: "pending" });
  const pendingCount = pendingApprovals.length;

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

  const handleNavigateToApprovals = useCallback(() => {
    setCurrentView("approvals");
  }, []);

  const handleBackToBoard = useCallback(() => {
    setCurrentView("board");
  }, []);

  // Show approval queue view
  if (currentView === "approvals") {
    return <ApprovalQueue onBack={handleBackToBoard} />;
  }

  return (
    <div
      style={{
        padding: "24px",
        maxWidth: "100%",
      }}
      className="dashboard-container"
    >
      {/* Header with New Task button and Approval Queue link */}
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
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            data-testid="approval-queue-nav-button"
            onClick={handleNavigateToApprovals}
            style={{
              padding: "8px 16px",
              borderRadius: "6px",
              fontSize: "13px",
              fontWeight: 500,
              cursor: "pointer",
              border: "1px solid #f59e0b44",
              backgroundColor: pendingCount > 0 ? "#f59e0b22" : "#1e293b",
              color: pendingCount > 0 ? "#f59e0b" : "#94a3b8",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = pendingCount > 0 ? "#f59e0b33" : "#334155";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = pendingCount > 0 ? "#f59e0b22" : "#1e293b";
            }}
          >
            🔔 Approvals
            {pendingCount > 0 && (
              <span
                style={{
                  backgroundColor: "#f59e0b",
                  color: "#000",
                  padding: "1px 6px",
                  borderRadius: "10px",
                  fontSize: "11px",
                  fontWeight: 600,
                }}
              >
                {pendingCount}
              </span>
            )}
          </button>
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
