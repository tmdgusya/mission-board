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
import { CreateProjectForm } from "./CreateProjectForm";
import { ApprovalQueue } from "./ApprovalQueue";
import { Analytics } from "../pages/Analytics";

type View = "board" | "approvals" | "analytics";

export function DashboardContent(): React.ReactElement {
  const [currentView, setCurrentView] = useState<View>("board");
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isCreateFormOpen, setIsCreateFormOpen] = useState(false);
  const [isCreateProjectFormOpen, setIsCreateProjectFormOpen] = useState(false);

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

  const handleOpenCreateProjectForm = useCallback(() => {
    setIsCreateProjectFormOpen(true);
  }, []);

  const handleCloseCreateProjectForm = useCallback(() => {
    setIsCreateProjectFormOpen(false);
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

  const handleNavigateToAnalytics = useCallback(() => {
    setCurrentView("analytics");
  }, []);

  // Show approval queue view
  if (currentView === "approvals") {
    return <ApprovalQueue onBack={handleBackToBoard} />;
  }

  // Show analytics view
  if (currentView === "analytics") {
    return <Analytics onBack={handleBackToBoard} />;
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
          paddingBottom: "12px",
          borderBottom: "1px solid rgba(0,255,204,0.2)",
          boxShadow: "0 1px 8px rgba(0,255,204,0.05)",
        }}
      >
        <h1
          style={{
            fontSize: "24px",
            fontWeight: 700,
            color: "#00ffcc",
            margin: 0,
            textTransform: "uppercase",
            letterSpacing: "0.15em",
            textShadow: "0 0 10px rgba(0,255,204,0.5)",
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
          }}
        >
          Mission Board
        </h1>
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            data-testid="analytics-nav-button"
            onClick={handleNavigateToAnalytics}
            style={{
              padding: "8px 16px",
              borderRadius: "2px",
              fontSize: "13px",
              fontWeight: 500,
              cursor: "pointer",
              border: "1px solid rgba(0,255,204,0.15)",
              backgroundColor: "transparent",
              color: "#555555",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "#00ffcc";
              e.currentTarget.style.borderColor = "rgba(0,255,204,0.4)";
              e.currentTarget.style.boxShadow = "0 0 8px rgba(0,255,204,0.1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "#555555";
              e.currentTarget.style.borderColor = "rgba(0,255,204,0.15)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            Analytics
          </button>
          <button
            data-testid="approval-queue-nav-button"
            onClick={handleNavigateToApprovals}
            style={{
              padding: "8px 16px",
              borderRadius: "2px",
              fontSize: "13px",
              fontWeight: 500,
              cursor: "pointer",
              border: `1px solid ${pendingCount > 0 ? "rgba(255,170,0,0.3)" : "rgba(0,255,204,0.15)"}`,
              backgroundColor: pendingCount > 0 ? "rgba(255,170,0,0.1)" : "transparent",
              color: pendingCount > 0 ? "#ffaa00" : "#555555",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = pendingCount > 0 ? "#ffaa00" : "#00ffcc";
              e.currentTarget.style.boxShadow = "0 0 8px rgba(0,255,204,0.1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = pendingCount > 0 ? "#ffaa00" : "#555555";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            Approvals
            {pendingCount > 0 && (
              <span
                style={{
                  backgroundColor: "#ffaa00",
                  color: "#000",
                  padding: "1px 6px",
                  borderRadius: "2px",
                  fontSize: "11px",
                  fontWeight: 600,
                }}
              >
                {pendingCount}
              </span>
            )}
          </button>
          <button
            data-testid="new-project-button"
            onClick={handleOpenCreateProjectForm}
            style={{
              padding: "8px 16px",
              borderRadius: "2px",
              fontSize: "13px",
              fontWeight: 500,
              cursor: "pointer",
              border: "1px solid rgba(0,255,204,0.15)",
              backgroundColor: "transparent",
              color: "#555555",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "#00ffcc";
              e.currentTarget.style.borderColor = "rgba(0,255,204,0.4)";
              e.currentTarget.style.boxShadow = "0 0 8px rgba(0,255,204,0.1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "#555555";
              e.currentTarget.style.borderColor = "rgba(0,255,204,0.15)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            + New Project
          </button>
          <button
            data-testid="new-task-button"
            onClick={handleOpenCreateForm}
            style={{
              padding: "8px 16px",
              borderRadius: "2px",
              fontSize: "13px",
              fontWeight: 500,
              cursor: "pointer",
              border: "1px solid rgba(0,255,102,0.3)",
              backgroundColor: "rgba(0,255,102,0.1)",
              color: "#00ff66",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "rgba(0,255,102,0.2)";
              e.currentTarget.style.boxShadow = "0 0 12px rgba(0,255,102,0.2)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "rgba(0,255,102,0.1)";
              e.currentTarget.style.boxShadow = "none";
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
      <CreateProjectForm isOpen={isCreateProjectFormOpen} onClose={handleCloseCreateProjectForm} />
    </div>
  );
}
