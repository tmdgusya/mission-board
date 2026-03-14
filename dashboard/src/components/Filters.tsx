import React, { useMemo } from "react";
import { useProjects } from "../hooks/use-projects";
import { useAgents } from "../hooks/use-agents";
import {
  TASK_STATUSES,
  STATUS_LABELS,
  type TaskStatus,
} from "../lib/status-transitions";
import type { Task } from "../lib/api-client";

export interface FilterState {
  projectId: string;
  status: string;
  agentId: string;
  search: string;
}

export const DEFAULT_FILTERS: FilterState = {
  projectId: "",
  status: "",
  agentId: "",
  search: "",
};

interface FiltersProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  tasks: Task[];
}

export function Filters({
  filters,
  onFiltersChange,
  tasks,
}: FiltersProps): React.ReactElement {
  const { data: projects = [] } = useProjects();
  const { data: agents = [] } = useAgents();

  const handleFilterChange = (
    field: keyof FilterState,
    value: string
  ): void => {
    onFiltersChange({ ...filters, [field]: value });
  };

  const handleClearFilters = (): void => {
    onFiltersChange(DEFAULT_FILTERS);
  };

  const hasActiveFilters = useMemo(
    () =>
      filters.projectId !== "" ||
      filters.status !== "" ||
      filters.agentId !== "" ||
      filters.search !== "",
    [filters]
  );

  const selectStyle: React.CSSProperties = {
    backgroundColor: "#000000",
    color: "#c0c0c0",
    border: "1px solid #333333",
    borderRadius: "2px",
    padding: "6px 10px",
    fontSize: "13px",
    outline: "none",
    minWidth: "140px",
    cursor: "pointer",
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
  };

  const inputStyle: React.CSSProperties = {
    ...selectStyle,
    cursor: "text",
    minWidth: "180px",
  };

  return (
    <div
      data-testid="filters-bar"
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: "12px",
        padding: "12px 16px",
        backgroundColor: "rgba(0,0,0,0.8)",
        borderRadius: "2px",
        border: "1px solid rgba(0,255,204,0.08)",
        marginBottom: "16px",
      }}
    >
      {/* Project Filter */}
      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
        <label
          htmlFor="filter-project"
          style={{ fontSize: "11px", color: "#555555", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace" }}
        >
          Project
        </label>
        <select
          id="filter-project"
          data-testid="filter-project"
          value={filters.projectId}
          onChange={(e) => handleFilterChange("projectId", e.target.value)}
          style={selectStyle}
          aria-label="Filter by project"
        >
          <option value="">All Projects</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      </div>

      {/* Status Filter */}
      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
        <label
          htmlFor="filter-status"
          style={{ fontSize: "11px", color: "#555555", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace" }}
        >
          Status
        </label>
        <select
          id="filter-status"
          data-testid="filter-status"
          value={filters.status}
          onChange={(e) => handleFilterChange("status", e.target.value)}
          style={selectStyle}
          aria-label="Filter by status"
        >
          <option value="">All Statuses</option>
          {TASK_STATUSES.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABELS[status]}
            </option>
          ))}
        </select>
      </div>

      {/* Agent Filter */}
      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
        <label
          htmlFor="filter-agent"
          style={{ fontSize: "11px", color: "#555555", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace" }}
        >
          Agent
        </label>
        <select
          id="filter-agent"
          data-testid="filter-agent"
          value={filters.agentId}
          onChange={(e) => handleFilterChange("agentId", e.target.value)}
          style={selectStyle}
          aria-label="Filter by agent"
        >
          <option value="">All Agents</option>
          {agents.map((agent) => (
            <option key={agent.id} value={agent.id}>
              {agent.name}
            </option>
          ))}
        </select>
      </div>

      {/* Search Input */}
      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
        <label
          htmlFor="filter-search"
          style={{ fontSize: "11px", color: "#555555", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace" }}
        >
          Search
        </label>
        <input
          id="filter-search"
          data-testid="filter-search"
          type="text"
          placeholder="Search tasks..."
          value={filters.search}
          onChange={(e) => handleFilterChange("search", e.target.value)}
          style={inputStyle}
          aria-label="Search tasks by title or description"
        />
      </div>

      {/* Clear Filters Button */}
      {hasActiveFilters && (
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
          }}
        >
          <button
            data-testid="clear-filters"
            onClick={handleClearFilters}
            style={{
              backgroundColor: "transparent",
              color: "#ff3333",
              border: "1px solid rgba(255,51,51,0.3)",
              borderRadius: "2px",
              padding: "6px 14px",
              fontSize: "13px",
              cursor: "pointer",
              transition: "background-color 0.2s",
              whiteSpace: "nowrap",
              fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
            aria-label="Clear all filters"
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "rgba(255,51,51,0.1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            Clear Filters
          </button>
        </div>
      )}

      {/* Active filter count */}
      {hasActiveFilters && (
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            fontSize: "12px",
            color: "#555555",
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
          }}
          data-testid="filter-count-info"
        >
          {tasks.length} task{tasks.length !== 1 ? "s" : ""} shown
        </div>
      )}
    </div>
  );
}

/**
 * Apply client-side filtering to tasks.
 * Server-side filters (project_id, status, agent_id) are passed to the API.
 * Search (title/description) is filtered client-side.
 */
export function applyClientFilters(
  tasks: Task[],
  filters: FilterState
): Task[] {
  let filtered = tasks;

  if (filters.search.trim()) {
    const query = filters.search.toLowerCase().trim();
    filtered = filtered.filter(
      (task) =>
        task.title.toLowerCase().includes(query) ||
        (task.description &&
          task.description.toLowerCase().includes(query))
    );
  }

  return filtered;
}

/**
 * Build API query params from filter state (server-side filters only).
 */
export function buildApiParams(filters: FilterState): {
  project_id?: string;
  status?: string;
  agent_id?: string;
} {
  const params: { project_id?: string; status?: string; agent_id?: string } =
    {};

  if (filters.projectId) params.project_id = filters.projectId;
  if (filters.status) params.status = filters.status;
  if (filters.agentId) params.agent_id = filters.agentId;

  return params;
}
