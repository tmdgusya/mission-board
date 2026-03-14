import React, { useCallback } from "react";
import type { Task, Project, Agent } from "../lib/api-client";

// =============================================
// Types
// =============================================

interface ExportButtonsProps {
  tasks: Task[];
  projects: Project[];
  agents: Agent[];
  /** Optional custom download handler (for testing). Defaults to browser download. */
  onDownload?: (blobUrl: string, filename: string) => void;
}

// =============================================
// CSV Helpers
// =============================================

function escapeCSVField(value: string): string {
  if (
    value.includes(",") ||
    value.includes('"') ||
    value.includes("\n") ||
    value.includes("\r")
  ) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function resolveProjectName(projectId: string, projects: Project[]): string {
  const project = projects.find((p) => p.id === projectId);
  return project ? project.name : "Unknown Project";
}

function resolveAgentName(agentId: string | null, agents: Agent[]): string {
  if (!agentId) return "Unclaimed";
  const agent = agents.find((a) => a.id === agentId);
  return agent ? agent.name : "Unknown Agent";
}

const CSV_HEADERS = [
  "ID",
  "Title",
  "Description",
  "Status",
  "Task Type",
  "Project",
  "Agent",
  "Requires Approval",
  "Created At",
  "Updated At",
  "Claimed At",
];

// =============================================
// Export Functions (pure, testable)
// =============================================

export function exportToCSV(
  tasks: Task[],
  projects: Project[],
  agents: Agent[]
): string {
  const rows: string[] = [CSV_HEADERS.join(",")];

  for (const task of tasks) {
    const row = [
      escapeCSVField(task.id),
      escapeCSVField(task.title),
      escapeCSVField(task.description || ""),
      escapeCSVField(task.status),
      escapeCSVField(task.taskType),
      escapeCSVField(resolveProjectName(task.projectId, projects)),
      escapeCSVField(resolveAgentName(task.agentId, agents)),
      escapeCSVField(String(task.requiresApproval)),
      escapeCSVField(task.createdAt),
      escapeCSVField(task.updatedAt),
      escapeCSVField(task.claimedAt || "N/A"),
    ];
    rows.push(row.join(","));
  }

  return rows.join("\n") + "\n";
}

export interface ExportedTaskJSON {
  id: string;
  title: string;
  description: string | null;
  status: string;
  taskType: string;
  projectId: string;
  projectName: string;
  agentId: string | null;
  agentName: string;
  requiresApproval: boolean;
  createdAt: string;
  updatedAt: string;
  claimedAt: string | null;
}

export function exportToJSON(
  tasks: Task[],
  projects: Project[],
  agents: Agent[]
): string {
  const enriched: ExportedTaskJSON[] = tasks.map((task) => ({
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    taskType: task.taskType,
    projectId: task.projectId,
    projectName: resolveProjectName(task.projectId, projects),
    agentId: task.agentId,
    agentName: resolveAgentName(task.agentId, agents),
    requiresApproval: task.requiresApproval,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    claimedAt: task.claimedAt,
  }));
  return JSON.stringify(enriched, null, 2);
}

// =============================================
// Default browser download handler
// =============================================

function browserDownload(blobUrl: string, filename: string): void {
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(blobUrl);
}

// =============================================
// Component
// =============================================

export function ExportButtons({
  tasks = [],
  projects = [],
  agents = [],
  onDownload,
}: ExportButtonsProps): React.ReactElement {
  const handleDownload = useCallback(
    (format: "csv" | "json") => {
      if (tasks.length === 0) return;

      let content: string;
      let mimeType: string;
      let extension: string;

      if (format === "csv") {
        content = exportToCSV(tasks, projects, agents);
        mimeType = "text/csv;charset=utf-8;";
        extension = "csv";
      } else {
        content = exportToJSON(tasks, projects, agents);
        mimeType = "application/json;charset=utf-8;";
        extension = "json";
      }

      const blob = new Blob([content], { type: mimeType });
      const blobUrl = URL.createObjectURL(blob);
      const timestamp = new Date().toISOString().slice(0, 10);
      const filename = `mission-board-export-${timestamp}.${extension}`;

      if (onDownload) {
        onDownload(blobUrl, filename);
        URL.revokeObjectURL(blobUrl);
      } else {
        browserDownload(blobUrl, filename);
      }
    },
    [tasks, projects, agents, onDownload]
  );

  const isDisabled = tasks.length === 0;

  return (
    <div
      data-testid="export-buttons"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
      }}
    >
      <span
        data-testid="export-count"
        style={{
          fontSize: "12px",
          color: "#555555",
          marginRight: "4px",
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
        }}
      >
        {tasks.length} task{tasks.length !== 1 ? "s" : ""}
      </span>
      <button
        data-testid="export-csv-button"
        disabled={isDisabled}
        onClick={() => handleDownload("csv")}
        aria-label="Export tasks as CSV"
        title="Export tasks as CSV"
        style={{
          padding: "6px 14px",
          borderRadius: "4px",
          border: `1px solid ${isDisabled ? "#333333" : "#00ffcc"}`,
          backgroundColor: "transparent",
          color: isDisabled ? "#333333" : "#00ffcc",
          fontSize: "12px",
          fontWeight: 500,
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
          textTransform: "uppercase",
          letterSpacing: "0.5px",
          cursor: isDisabled ? "not-allowed" : "pointer",
          display: "flex",
          alignItems: "center",
          gap: "4px",
          opacity: isDisabled ? 0.5 : 1,
          transition: "all 0.2s",
        }}
        onMouseEnter={(e) => {
          if (!isDisabled) {
            e.currentTarget.style.boxShadow = "0 0 12px rgba(0,255,204,0.3)";
            e.currentTarget.style.backgroundColor = "rgba(0,255,204,0.05)";
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.boxShadow = "none";
          e.currentTarget.style.backgroundColor = "transparent";
        }}
      >
        CSV
      </button>
      <button
        data-testid="export-json-button"
        disabled={isDisabled}
        onClick={() => handleDownload("json")}
        aria-label="Export tasks as JSON"
        title="Export tasks as JSON"
        style={{
          padding: "6px 14px",
          borderRadius: "4px",
          border: `1px solid ${isDisabled ? "#333333" : "#00ffcc"}`,
          backgroundColor: "transparent",
          color: isDisabled ? "#333333" : "#00ffcc",
          fontSize: "12px",
          fontWeight: 500,
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
          textTransform: "uppercase",
          letterSpacing: "0.5px",
          cursor: isDisabled ? "not-allowed" : "pointer",
          display: "flex",
          alignItems: "center",
          gap: "4px",
          opacity: isDisabled ? 0.5 : 1,
          transition: "all 0.2s",
        }}
        onMouseEnter={(e) => {
          if (!isDisabled) {
            e.currentTarget.style.boxShadow = "0 0 12px rgba(0,255,204,0.3)";
            e.currentTarget.style.backgroundColor = "rgba(0,255,204,0.05)";
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.boxShadow = "none";
          e.currentTarget.style.backgroundColor = "transparent";
        }}
      >
        JSON
      </button>
    </div>
  );
}
