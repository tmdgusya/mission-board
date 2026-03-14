import React, { useState, useCallback, useMemo } from "react";
import {
  useAgentStats,
  useTaskMetrics,
  useTimeTrackingMetrics,
  useVelocity,
} from "../hooks/use-analytics";
import { useProjects } from "../hooks/use-projects";
import {
  TaskStatusDonut,
  AgentComparisonBar,
  VelocityLine,
} from "../components/Charts";
import type { AgentStat, TaskMetrics, TimeTrackingMetrics } from "../lib/api-client";

// =============================================
// Types
// =============================================

interface AnalyticsProps {
  onBack: () => void;
}

// =============================================
// Helpers
// =============================================

function formatDuration(ms: number | null): string {
  if (ms === null) return "N/A";
  const minutes = Math.floor(ms / 60000);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours > 0) {
    return `${hours}h ${remainingMinutes}m`;
  }
  return `${minutes}m`;
}

function formatRate(rate: number | null): string {
  if (rate === null) return "N/A";
  return `${rate}%`;
}

const STATUS_LABELS: Record<string, string> = {
  backlog: "Backlog",
  ready: "Ready",
  in_progress: "In Progress",
  review: "Review",
  done: "Done",
  blocked: "Blocked",
};

const STATUS_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  backlog: { bg: "rgba(100, 116, 139, 0.15)", color: "#94a3b8", border: "rgba(100, 116, 139, 0.3)" },
  ready: { bg: "rgba(59, 130, 246, 0.15)", color: "#60a5fa", border: "rgba(59, 130, 246, 0.3)" },
  in_progress: { bg: "rgba(245, 158, 11, 0.15)", color: "#f59e0b", border: "rgba(245, 158, 11, 0.3)" },
  review: { bg: "rgba(168, 85, 247, 0.15)", color: "#a855f7", border: "rgba(168, 85, 247, 0.3)" },
  done: { bg: "rgba(34, 197, 94, 0.15)", color: "#22c55e", border: "rgba(34, 197, 94, 0.3)" },
  blocked: { bg: "rgba(239, 68, 68, 0.15)", color: "#ef4444", border: "rgba(239, 68, 68, 0.3)" },
};

// =============================================
// Metric Card
// =============================================

function MetricCard({
  label,
  value,
  sublabel,
  testId,
}: {
  label: string;
  value: string;
  sublabel?: string;
  testId: string;
}): React.ReactElement {
  return (
    <div
      data-testid={testId}
      style={{
        backgroundColor: "#1e293b",
        border: "1px solid #334155",
        borderRadius: "10px",
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        gap: "4px",
        minWidth: "0",
      }}
    >
      <span
        style={{
          fontSize: "12px",
          fontWeight: 500,
          color: "#94a3b8",
          textTransform: "uppercase",
          letterSpacing: "0.5px",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: "28px",
          fontWeight: 700,
          color: "#f1f5f9",
          lineHeight: 1.2,
        }}
      >
        {value}
      </span>
      {sublabel && (
        <span
          style={{
            fontSize: "12px",
            color: "#64748b",
            marginTop: "2px",
          }}
        >
          {sublabel}
        </span>
      )}
    </div>
  );
}

// =============================================
// Section Header
// =============================================

function SectionHeader({
  title,
  icon,
}: {
  title: string;
  icon: string;
}): React.ReactElement {
  return (
    <h2
      style={{
        fontSize: "18px",
        fontWeight: 600,
        color: "#f1f5f9",
        margin: 0,
        display: "flex",
        alignItems: "center",
        gap: "8px",
      }}
    >
      <span aria-hidden="true">{icon}</span>
      {title}
    </h2>
  );
}

// =============================================
// Agent Stats Table
// =============================================

function AgentStatsTable({
  stats,
}: {
  stats: AgentStat[];
}): React.ReactElement {
  return (
    <div
      data-testid="agent-stats-table"
      style={{
        overflowX: "auto",
      }}
    >
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: "14px",
        }}
      >
        <thead>
          <tr>
            {["Agent", "Completed", "In Progress", "Total", "Avg Completion", "Success Rate"].map(
              (header) => (
                <th
                  key={header}
                  style={{
                    textAlign: "left",
                    padding: "10px 12px",
                    color: "#94a3b8",
                    fontWeight: 500,
                    fontSize: "12px",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    borderBottom: "1px solid #334155",
                    whiteSpace: "nowrap",
                  }}
                >
                  {header}
                </th>
              )
            )}
          </tr>
        </thead>
        <tbody>
          {stats.map((stat) => (
            <tr
              key={stat.agentId}
              data-testid={`agent-row-${stat.agentId}`}
              style={{
                borderBottom: "1px solid #1e293b",
                transition: "background-color 0.15s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#1e293b";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              <td
                style={{
                  padding: "10px 12px",
                  color: "#e2e8f0",
                  fontWeight: 500,
                  maxWidth: "200px",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {stat.agentName}
              </td>
              <td
                data-testid={`agent-completed-${stat.agentId}`}
                style={{
                  padding: "10px 12px",
                  color: "#22c55e",
                  fontWeight: 600,
                }}
              >
                {stat.tasksCompleted}
              </td>
              <td
                data-testid={`agent-in-progress-${stat.agentId}`}
                style={{
                  padding: "10px 12px",
                  color: "#f59e0b",
                  fontWeight: 600,
                }}
              >
                {stat.tasksInProgress}
              </td>
              <td
                style={{
                  padding: "10px 12px",
                  color: "#94a3b8",
                }}
              >
                {stat.totalTasks}
              </td>
              <td
                data-testid={`agent-avg-time-${stat.agentId}`}
                style={{
                  padding: "10px 12px",
                  color: "#e2e8f0",
                }}
              >
                {formatDuration(stat.avgCompletionTimeMs)}
              </td>
              <td
                data-testid={`agent-success-rate-${stat.agentId}`}
                style={{
                  padding: "10px 12px",
                  color: stat.successRate !== null && stat.successRate >= 70 ? "#22c55e" : "#e2e8f0",
                  fontWeight: 500,
                }}
              >
                {formatRate(stat.successRate)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// =============================================
// Task Status Distribution
// =============================================

function TaskStatusDistribution({
  metrics,
}: {
  metrics: TaskMetrics;
}): React.ReactElement {
  const { statusCounts, totalTasks } = metrics;

  return (
    <div
      data-testid="task-status-distribution"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      }}
    >
      {Object.entries(statusCounts).map(([status, count]) => {
        const colors = STATUS_COLORS[status] || STATUS_COLORS.backlog;
        const percentage = totalTasks > 0 ? Math.round((count / totalTasks) * 100) : 0;
        return (
          <div key={status}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "6px",
              }}
            >
              <span
                style={{
                  fontSize: "13px",
                  fontWeight: 500,
                  color: colors.color,
                }}
              >
                {STATUS_LABELS[status] || status}
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span
                  data-testid={`status-count-${status}`}
                  style={{
                    fontSize: "14px",
                    fontWeight: 600,
                    color: "#e2e8f0",
                  }}
                >
                  {count}
                </span>
                <span
                  style={{
                    fontSize: "12px",
                    color: "#64748b",
                    minWidth: "36px",
                    textAlign: "right",
                  }}
                >
                  {percentage}%
                </span>
              </div>
            </div>
            <div
              style={{
                width: "100%",
                height: "8px",
                backgroundColor: "#0f172a",
                borderRadius: "4px",
                overflow: "hidden",
              }}
            >
              <div
                data-testid={`status-bar-${status}`}
                style={{
                  width: `${percentage}%`,
                  height: "100%",
                  backgroundColor: colors.color,
                  borderRadius: "4px",
                  transition: "width 0.3s ease",
                  minWidth: count > 0 ? "4px" : "0",
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// =============================================
// Loading State
// =============================================

function AnalyticsLoadingState(): React.ReactElement {
  return (
    <div
      data-testid="analytics-loading"
      role="status"
      aria-live="polite"
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        padding: "60px 24px",
        gap: "20px",
        minHeight: "400px",
      }}
    >
      <div
        style={{
          width: "48px",
          height: "48px",
          border: "4px solid #334155",
          borderTopColor: "#3b82f6",
          borderRadius: "50%",
          animation: "spin 1s linear infinite",
        }}
      />
      <span style={{ color: "#94a3b8", fontSize: "14px" }}>
        Loading analytics...
      </span>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// =============================================
// Error State
// =============================================

function AnalyticsErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}): React.ReactElement {
  return (
    <div
      data-testid="analytics-error"
      role="alert"
      aria-live="assertive"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "60px 24px",
        gap: "16px",
        minHeight: "400px",
      }}
    >
      <div
        style={{
          width: "56px",
          height: "56px",
          borderRadius: "50%",
          backgroundColor: "#ef444420",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "28px",
          color: "#ef4444",
          flexShrink: 0,
        }}
        aria-hidden="true"
      >
        ⚠
      </div>
      <h2
        style={{ color: "#ef4444", fontSize: "20px", fontWeight: 700, margin: 0 }}
      >
        Error Loading Analytics
      </h2>
      <p
        style={{
          color: "#94a3b8",
          textAlign: "center",
          maxWidth: "420px",
          lineHeight: 1.5,
          margin: 0,
          fontSize: "14px",
        }}
      >
        {message}
      </p>
      <button
        onClick={onRetry}
        data-testid="retry-analytics-button"
        aria-label="Retry loading analytics"
        style={{
          padding: "10px 28px",
          backgroundColor: "#3b82f6",
          color: "white",
          border: "none",
          borderRadius: "8px",
          cursor: "pointer",
          fontSize: "14px",
          fontWeight: 500,
          transition: "background-color 0.2s",
          marginTop: "4px",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = "#2563eb";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = "#3b82f6";
        }}
      >
        Retry
      </button>
    </div>
  );
}

// =============================================
// Main Analytics Component
// =============================================

export function Analytics({ onBack }: AnalyticsProps): React.ReactElement {
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  const analyticsParams = useMemo(() => {
    const params: { projectId?: string; dateFrom?: string; dateTo?: string } = {};
    if (selectedProjectId) params.projectId = selectedProjectId;
    if (dateFrom) params.dateFrom = dateFrom;
    if (dateTo) params.dateTo = dateTo;
    return Object.keys(params).length > 0 ? params : undefined;
  }, [selectedProjectId, dateFrom, dateTo]);

  const {
    data: agentStats = [],
    isLoading: agentsLoading,
    error: agentsError,
    refetch: refetchAgents,
  } = useAgentStats(analyticsParams);

  const {
    data: taskMetrics,
    isLoading: tasksLoading,
    error: tasksError,
    refetch: refetchTasks,
  } = useTaskMetrics(analyticsParams);

  const {
    data: timeTracking,
    isLoading: timeLoading,
    error: timeError,
    refetch: refetchTime,
  } = useTimeTrackingMetrics(analyticsParams);

  const {
    data: velocityData = [],
    isLoading: velocityLoading,
    refetch: refetchVelocity,
  } = useVelocity(analyticsParams);

  const { data: projects = [] } = useProjects();

  const isLoading = agentsLoading || tasksLoading || timeLoading;
  const hasError = agentsError || tasksError || timeError;

  const handleRetry = useCallback(() => {
    void refetchAgents();
    void refetchTasks();
    void refetchTime();
    void refetchVelocity();
  }, [refetchAgents, refetchTasks, refetchTime, refetchVelocity]);

  const handleProjectChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setSelectedProjectId(e.target.value);
    },
    []
  );

  const handleDateFromChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setDateFrom(e.target.value);
    },
    []
  );

  const handleDateToChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setDateTo(e.target.value);
    },
    []
  );

  const handleClearFilters = useCallback(() => {
    setSelectedProjectId("");
    setDateFrom("");
    setDateTo("");
  }, []);

  const hasActiveFilters = !!(selectedProjectId || dateFrom || dateTo);

  // Loading state
  if (isLoading && !agentStats.length && !taskMetrics) {
    return (
      <div style={{ padding: "24px", maxWidth: "100%" }}>
        <AnalyticsHeader onBack={onBack} />
        <AnalyticsLoadingState />
      </div>
    );
  }

  // Error state
  if (hasError && !agentStats.length && !taskMetrics) {
    return (
      <div style={{ padding: "24px", maxWidth: "100%" }}>
        <AnalyticsHeader onBack={onBack} />
        <AnalyticsErrorState
          message="Failed to load analytics data. Please check your connection and try again."
          onRetry={handleRetry}
        />
      </div>
    );
  }

  return (
    <div
      data-testid="analytics-page"
      style={{
        padding: "24px",
        maxWidth: "100%",
      }}
      className="dashboard-container"
    >
      {/* Header */}
      <AnalyticsHeader onBack={onBack} />

      {/* Filters */}
      <div
        data-testid="analytics-filters"
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "12px",
          marginBottom: "24px",
        }}
      >
        {/* Project Filter */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <label
            htmlFor="analytics-project-filter"
            style={{
              fontSize: "13px",
              fontWeight: 500,
              color: "#94a3b8",
            }}
          >
            Project:
          </label>
          <select
            id="analytics-project-filter"
            data-testid="analytics-project-filter"
            value={selectedProjectId}
            onChange={handleProjectChange}
            style={{
              padding: "6px 12px",
              borderRadius: "6px",
              border: "1px solid #334155",
              backgroundColor: "#1e293b",
              color: "#e2e8f0",
              fontSize: "13px",
              cursor: "pointer",
              outline: "none",
              minWidth: "180px",
            }}
          >
            <option value="">All Projects</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </div>

        {/* Date Range Filter */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <label
            htmlFor="analytics-date-from"
            style={{
              fontSize: "13px",
              fontWeight: 500,
              color: "#94a3b8",
            }}
          >
            From:
          </label>
          <input
            id="analytics-date-from"
            type="date"
            data-testid="analytics-date-from"
            value={dateFrom}
            onChange={handleDateFromChange}
            style={{
              padding: "6px 10px",
              borderRadius: "6px",
              border: "1px solid #334155",
              backgroundColor: "#1e293b",
              color: "#e2e8f0",
              fontSize: "13px",
              cursor: "pointer",
              outline: "none",
            }}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <label
            htmlFor="analytics-date-to"
            style={{
              fontSize: "13px",
              fontWeight: 500,
              color: "#94a3b8",
            }}
          >
            To:
          </label>
          <input
            id="analytics-date-to"
            type="date"
            data-testid="analytics-date-to"
            value={dateTo}
            onChange={handleDateToChange}
            style={{
              padding: "6px 10px",
              borderRadius: "6px",
              border: "1px solid #334155",
              backgroundColor: "#1e293b",
              color: "#e2e8f0",
              fontSize: "13px",
              cursor: "pointer",
              outline: "none",
            }}
          />
        </div>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <button
            data-testid="analytics-clear-filters"
            onClick={handleClearFilters}
            style={{
              padding: "6px 14px",
              borderRadius: "6px",
              border: "1px solid #475569",
              backgroundColor: "transparent",
              color: "#94a3b8",
              fontSize: "13px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#1e293b";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            ✕ Clear
          </button>
        )}
      </div>

      {/* Section: Task Completion Metrics */}
      <section
        data-testid="task-metrics-section"
        style={{
          marginBottom: "32px",
        }}
      >
        <SectionHeader title="Task Completion Metrics" icon="📊" />

        {taskMetrics && (
          <div style={{ marginTop: "16px" }}>
            {/* Summary cards */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: "12px",
                marginBottom: "24px",
              }}
            >
              <MetricCard
                testId="metric-total-tasks"
                label="Total Tasks"
                value={String(taskMetrics.totalTasks)}
              />
              <MetricCard
                testId="metric-completion-rate"
                label="Completion Rate"
                value={`${taskMetrics.completionRate}%`}
                sublabel={`${taskMetrics.statusCounts?.done || 0} completed`}
              />
              <MetricCard
                testId="metric-avg-completion-time"
                label="Avg Time to Completion"
                value={formatDuration(taskMetrics.avgTimeToCompletionMs)}
              />
            </div>

            {/* Status distribution bar view */}
            <div
              style={{
                backgroundColor: "#1e293b",
                border: "1px solid #334155",
                borderRadius: "10px",
                padding: "20px",
              }}
            >
              <h3
                style={{
                  fontSize: "14px",
                  fontWeight: 600,
                  color: "#cbd5e1",
                  margin: "0 0 16px 0",
                }}
              >
                Status Distribution
              </h3>
              <TaskStatusDistribution metrics={taskMetrics} />
            </div>
          </div>
        )}
      </section>

      {/* Section: Charts */}
      <section
        data-testid="charts-section"
        style={{
          marginBottom: "32px",
        }}
      >
        <SectionHeader title="Charts" icon="📈" />

        <div
          style={{
            marginTop: "16px",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: "16px",
          }}
        >
          {/* Donut Chart: Task Status Distribution */}
          {taskMetrics && (
            <TaskStatusDonut
              statusCounts={taskMetrics.statusCounts}
              totalTasks={taskMetrics.totalTasks}
            />
          )}

          {/* Bar Chart: Agent Comparison */}
          <AgentComparisonBar agentStats={agentStats} />
        </div>

        {/* Line Chart: Velocity Over Time */}
        <div style={{ marginTop: "16px" }}>
          <VelocityLine velocityData={velocityData} isLoading={velocityLoading} />
        </div>
      </section>

      {/* Section: Agent Performance */}
      <section
        data-testid="agent-performance-section"
        style={{
          marginBottom: "32px",
        }}
      >
        <SectionHeader title="Agent Performance" icon="🤖" />

        <div
          style={{
            marginTop: "16px",
            backgroundColor: "#1e293b",
            border: "1px solid #334155",
            borderRadius: "10px",
            padding: "4px",
          }}
        >
          {agentStats.length === 0 ? (
            <div
              data-testid="no-agents-message"
              style={{
                padding: "40px 20px",
                textAlign: "center",
                color: "#64748b",
                fontSize: "14px",
              }}
            >
              No agent data available. Agents will appear here once they start working on tasks.
            </div>
          ) : (
            <AgentStatsTable stats={agentStats} />
          )}
        </div>
      </section>

      {/* Section: Time Tracking */}
      <section
        data-testid="time-tracking-section"
        style={{
          marginBottom: "32px",
        }}
      >
        <SectionHeader title="Time Tracking" icon="⏱" />

        {timeTracking && (
          <div
            style={{
              marginTop: "16px",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "12px",
            }}
          >
            <MetricCard
              testId="metric-created-to-claimed"
              label="Created → Claimed"
              value={formatDuration(timeTracking.avgCreatedToClaimedMs)}
              sublabel={`${timeTracking.tasksWithClaimData} tasks measured`}
            />
            <MetricCard
              testId="metric-claimed-to-completed"
              label="Claimed → Completed"
              value={formatDuration(timeTracking.avgClaimedToCompletedMs)}
              sublabel={`${timeTracking.tasksWithCompletionData} tasks measured`}
            />
          </div>
        )}
      </section>
    </div>
  );
}

// =============================================
// Header Component
// =============================================

function AnalyticsHeader({
  onBack,
}: {
  onBack: () => void;
}): React.ReactElement {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "24px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        <button
          data-testid="back-to-board-button"
          aria-label="Back to board"
          onClick={onBack}
          style={{
            padding: "6px 12px",
            borderRadius: "6px",
            fontSize: "13px",
            fontWeight: 500,
            cursor: "pointer",
            border: "1px solid #475569",
            backgroundColor: "transparent",
            color: "#94a3b8",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "#1e293b";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
          }}
        >
          ← Back
        </button>
        <h1
          data-testid="analytics-page-header"
          style={{ fontSize: "24px", fontWeight: 700, color: "#f1f5f9", margin: 0 }}
        >
          Analytics
        </h1>
      </div>
    </div>
  );
}
