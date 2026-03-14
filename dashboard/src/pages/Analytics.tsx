import React, { useState, useCallback, useMemo } from "react";
import {
  useAgentStats,
  useTaskMetrics,
  useTimeTrackingMetrics,
  useVelocity,
} from "../hooks/use-analytics";
import { useProjects } from "../hooks/use-projects";
import { useTasks } from "../hooks/use-tasks";
import { useAgents } from "../hooks/use-agents";
import {
  TaskStatusDonut,
  AgentComparisonBar,
  VelocityLine,
} from "../components/Charts";
import { ExportButtons } from "../components/Export";
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
  backlog: { bg: "rgba(85, 85, 85, 0.15)", color: "#555555", border: "rgba(85, 85, 85, 0.3)" },
  ready: { bg: "rgba(0, 170, 255, 0.15)", color: "#00aaff", border: "rgba(0, 170, 255, 0.3)" },
  in_progress: { bg: "rgba(255, 170, 0, 0.15)", color: "#ffaa00", border: "rgba(255, 170, 0, 0.3)" },
  review: { bg: "rgba(0, 255, 204, 0.15)", color: "#00ffcc", border: "rgba(0, 255, 204, 0.3)" },
  done: { bg: "rgba(0, 255, 102, 0.15)", color: "#00ff66", border: "rgba(0, 255, 102, 0.3)" },
  blocked: { bg: "rgba(255, 51, 51, 0.15)", color: "#ff3333", border: "rgba(255, 51, 51, 0.3)" },
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
        backgroundColor: "#0a0a0a",
        borderTop: "2px solid #00ffcc",
        borderRadius: "4px",
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        gap: "4px",
        minWidth: "0",
      }}
    >
      <span
        style={{
          fontSize: "11px",
          fontWeight: 500,
          color: "#555555",
          textTransform: "uppercase",
          letterSpacing: "1.5px",
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: "28px",
          fontWeight: 700,
          color: "#00ffcc",
          lineHeight: 1.2,
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
        }}
      >
        {value}
      </span>
      {sublabel && (
        <span
          style={{
            fontSize: "12px",
            color: "#444444",
            marginTop: "2px",
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
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
        fontSize: "14px",
        fontWeight: 600,
        color: "#888888",
        margin: 0,
        display: "flex",
        alignItems: "center",
        gap: "8px",
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
        textTransform: "uppercase",
        letterSpacing: "2px",
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
                    color: "#555555",
                    fontWeight: 500,
                    fontSize: "11px",
                    textTransform: "uppercase",
                    letterSpacing: "1.5px",
                    borderBottom: "1px solid rgba(0,255,204,0.1)",
                    whiteSpace: "nowrap",
                    fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
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
                borderBottom: "1px solid rgba(0,255,204,0.05)",
                transition: "background-color 0.15s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "rgba(0,255,204,0.03)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              <td
                style={{
                  padding: "10px 12px",
                  color: "#c0c0c0",
                  fontWeight: 500,
                  maxWidth: "200px",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
                }}
              >
                {stat.agentName}
              </td>
              <td
                data-testid={`agent-completed-${stat.agentId}`}
                style={{
                  padding: "10px 12px",
                  color: "#00ff66",
                  fontWeight: 600,
                  fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
                }}
              >
                {stat.tasksCompleted}
              </td>
              <td
                data-testid={`agent-in-progress-${stat.agentId}`}
                style={{
                  padding: "10px 12px",
                  color: "#ffaa00",
                  fontWeight: 600,
                  fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
                }}
              >
                {stat.tasksInProgress}
              </td>
              <td
                style={{
                  padding: "10px 12px",
                  color: "#555555",
                  fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
                }}
              >
                {stat.totalTasks}
              </td>
              <td
                data-testid={`agent-avg-time-${stat.agentId}`}
                style={{
                  padding: "10px 12px",
                  color: "#c0c0c0",
                  fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
                }}
              >
                {formatDuration(stat.avgCompletionTimeMs)}
              </td>
              <td
                data-testid={`agent-success-rate-${stat.agentId}`}
                style={{
                  padding: "10px 12px",
                  color: stat.successRate !== null && stat.successRate >= 70 ? "#00ff66" : "#c0c0c0",
                  fontWeight: 500,
                  fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
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
                    color: "#c0c0c0",
                    fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
                  }}
                >
                  {count}
                </span>
                <span
                  style={{
                    fontSize: "12px",
                    color: "#555555",
                    minWidth: "36px",
                    textAlign: "right",
                    fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
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
                backgroundColor: "#111111",
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
          border: "2px solid rgba(0,255,204,0.15)",
          borderTopColor: "#00ffcc",
          borderRadius: "50%",
          animation: "spin 1s linear infinite",
          boxShadow: "0 0 15px rgba(0,255,204,0.2)",
        }}
      />
      <span style={{ color: "#555555", fontSize: "14px", fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", letterSpacing: "2px" }}>
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
          backgroundColor: "rgba(255,51,51,0.1)",
          border: "1px solid rgba(255,51,51,0.3)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "28px",
          color: "#ff3333",
          flexShrink: 0,
          boxShadow: "0 0 20px rgba(255,51,51,0.15)",
        }}
        aria-hidden="true"
      >
        ⚠
      </div>
      <h2
        style={{ color: "#ff3333", fontSize: "20px", fontWeight: 700, margin: 0, fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", letterSpacing: "1px" }}
      >
        Error Loading Analytics
      </h2>
      <p
        style={{
          color: "#555555",
          textAlign: "center",
          maxWidth: "420px",
          lineHeight: 1.5,
          margin: 0,
          fontSize: "14px",
          fontFamily: "'JetBrains Mono', monospace",
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
          backgroundColor: "transparent",
          color: "#00ffcc",
          border: "1px solid #00ffcc",
          borderRadius: "4px",
          cursor: "pointer",
          fontSize: "14px",
          fontWeight: 500,
          fontFamily: "'JetBrains Mono', monospace",
          textTransform: "uppercase",
          letterSpacing: "1px",
          transition: "all 0.2s",
          marginTop: "4px",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.boxShadow = "0 0 15px rgba(0,255,204,0.3)";
          e.currentTarget.style.backgroundColor = "rgba(0,255,204,0.05)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.boxShadow = "none";
          e.currentTarget.style.backgroundColor = "transparent";
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

  // Fetch tasks and agents for export functionality (respects filters)
  const taskQueryParams = useMemo((): { project_id?: string } => {
    const params: { project_id?: string } = {};
    if (selectedProjectId) params.project_id = selectedProjectId;
    return params;
  }, [selectedProjectId]);

  const tasksResult = useTasks(taskQueryParams);
  const tasks = tasksResult.data ?? [];
  const agentsResult = useAgents();
  const agents = agentsResult.data ?? [];

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
        <AnalyticsHeader
          onBack={onBack}
          tasks={tasks}
          projects={projects}
          agents={agents}
        />
        <AnalyticsLoadingState />
      </div>
    );
  }

  // Error state
  if (hasError && !agentStats.length && !taskMetrics) {
    return (
      <div style={{ padding: "24px", maxWidth: "100%" }}>
        <AnalyticsHeader
          onBack={onBack}
          tasks={tasks}
          projects={projects}
          agents={agents}
        />
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
      <AnalyticsHeader
        onBack={onBack}
        tasks={tasks}
        projects={projects}
        agents={agents}
      />

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
              fontSize: "11px",
              fontWeight: 500,
              color: "#555555",
              fontFamily: "'JetBrains Mono', monospace",
              textTransform: "uppercase",
              letterSpacing: "1px",
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
              borderRadius: "4px",
              border: "1px solid #333333",
              backgroundColor: "#000000",
              color: "#c0c0c0",
              fontSize: "13px",
              fontFamily: "'JetBrains Mono', monospace",
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
              fontSize: "11px",
              fontWeight: 500,
              color: "#555555",
              fontFamily: "'JetBrains Mono', monospace",
              textTransform: "uppercase",
              letterSpacing: "1px",
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
              borderRadius: "4px",
              border: "1px solid #333333",
              backgroundColor: "#000000",
              color: "#c0c0c0",
              fontSize: "13px",
              fontFamily: "'JetBrains Mono', monospace",
              cursor: "pointer",
              outline: "none",
            }}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <label
            htmlFor="analytics-date-to"
            style={{
              fontSize: "11px",
              fontWeight: 500,
              color: "#555555",
              fontFamily: "'JetBrains Mono', monospace",
              textTransform: "uppercase",
              letterSpacing: "1px",
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
              borderRadius: "4px",
              border: "1px solid #333333",
              backgroundColor: "#000000",
              color: "#c0c0c0",
              fontSize: "13px",
              fontFamily: "'JetBrains Mono', monospace",
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
              borderRadius: "4px",
              border: "1px solid #555555",
              backgroundColor: "transparent",
              color: "#555555",
              fontSize: "13px",
              fontFamily: "'JetBrains Mono', monospace",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "rgba(0,255,204,0.03)";
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
                backgroundColor: "#000000",
                border: "1px solid rgba(0,255,204,0.15)",
                borderRadius: "4px",
                padding: "20px",
              }}
            >
              <h3
                style={{
                  fontSize: "14px",
                  fontWeight: 600,
                  color: "#888888",
                  margin: "0 0 16px 0",
                  fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
                  textTransform: "uppercase",
                  letterSpacing: "1px",
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
            backgroundColor: "#000000",
            border: "1px solid rgba(0,255,204,0.15)",
            borderRadius: "4px",
            padding: "4px",
          }}
        >
          {agentStats.length === 0 ? (
            <div
              data-testid="no-agents-message"
              style={{
                padding: "40px 20px",
                textAlign: "center",
                color: "#555555",
                fontSize: "14px",
                fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
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
  tasks,
  projects,
  agents,
}: {
  onBack: () => void;
  tasks: { id: string; projectId: string; agentId: string | null; title: string; description: string | null; taskType: string; requiresApproval: boolean; status: string; createdAt: string; updatedAt: string; claimedAt: string | null }[];
  projects: { id: string; name: string }[];
  agents: { id: string; name: string }[];
}): React.ReactElement {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "24px",
        flexWrap: "wrap",
        gap: "12px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        <button
          data-testid="back-to-board-button"
          aria-label="Back to board"
          onClick={onBack}
          style={{
            padding: "6px 12px",
            borderRadius: "4px",
            fontSize: "13px",
            fontWeight: 500,
            cursor: "pointer",
            border: "1px solid #333333",
            backgroundColor: "transparent",
            color: "#555555",
            fontFamily: "'JetBrains Mono', monospace",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "rgba(0,255,204,0.03)";
            e.currentTarget.style.borderColor = "rgba(0,255,204,0.3)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
            e.currentTarget.style.borderColor = "#333333";
          }}
        >
          ← Back
        </button>
        <h1
          data-testid="analytics-page-header"
          style={{ fontSize: "20px", fontWeight: 700, color: "#00ffcc", margin: 0, fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", letterSpacing: "2px" }}
        >
          Analytics
        </h1>
      </div>
      <ExportButtons
        tasks={tasks}
        projects={projects}
        agents={agents}
      />
    </div>
  );
}
