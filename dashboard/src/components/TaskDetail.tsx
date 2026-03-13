import React, { useState } from "react";
import { useTask } from "../hooks/use-tasks";
import { useLogs } from "../hooks/use-logs";
import { useAgents } from "../hooks/use-agents";
import { useProjects } from "../hooks/use-projects";
import { useUpdateTask, useHandleApiError } from "../hooks/use-update-task";
import { useDeleteTask } from "../hooks/use-delete-task";
import { STATUS_LABELS, STATUS_COLORS, type TaskStatus } from "../lib/status-transitions";
import { Toast, useToast } from "./Toast";

interface TaskDetailProps {
  taskId: string | null;
  onClose: () => void;
}

export function TaskDetail({ taskId, onClose }: TaskDetailProps): React.ReactElement | null {
  const { data: task, isLoading: taskLoading, error: taskError } = useTask(taskId ?? "");
  const { data: logs = [], isLoading: logsLoading } = useLogs(
    taskId ? { task_id: taskId } : undefined
  );
  const { data: agents = [] } = useAgents();
  const { data: projects = [] } = useProjects();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const handleApiError = useHandleApiError();
  const { messages, addToast, dismissToast } = useToast();

  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Reset edit state when task changes
  React.useEffect(() => {
    if (task) {
      setEditTitle(task.title);
      setEditDescription(task.description ?? "");
    }
    setIsEditing(false);
    setShowDeleteConfirm(false);
  }, [task?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!taskId) return null;

  const agent = agents.find((a) => a.id === task?.agentId);
  const project = projects.find((p) => p.id === task?.projectId);

  const handleEditSave = (): void => {
    if (!task) return;

    const updates: { title?: string; description?: string } = {};
    if (editTitle.trim() !== task.title) {
      updates.title = editTitle.trim();
    }
    if (editDescription.trim() !== (task.description ?? "")) {
      updates.description = editDescription.trim() || null;
    }

    if (Object.keys(updates).length === 0) {
      setIsEditing(false);
      return;
    }

    updateTask.mutate(
      { id: task.id, data: updates },
      {
        onSuccess: () => {
          setIsEditing(false);
          addToast("Task updated successfully", "success");
        },
        onError: (error) => {
          addToast(handleApiError(error), "error");
        },
      }
    );
  };

  const handleDelete = (): void => {
    if (!taskId) return;

    deleteTask.mutate(taskId, {
      onSuccess: () => {
        addToast("Task deleted successfully", "success");
        onClose();
      },
      onError: (error) => {
        addToast(handleApiError(error), "error");
        setShowDeleteConfirm(false);
      },
    });
  };

  const handleOverlayClick = (e: React.MouseEvent): void => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === "Escape") {
      if (showDeleteConfirm) {
        setShowDeleteConfirm(false);
      } else if (isEditing) {
        setIsEditing(false);
        if (task) {
          setEditTitle(task.title);
          setEditDescription(task.description ?? "");
        }
      } else {
        onClose();
      }
    }
  };

  const formatDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleString();
  };

  const formatAction = (action: string): string => {
    const labels: Record<string, string> = {
      created: "Created",
      claimed: "Claimed",
      released: "Released",
      updated: "Updated",
      deleted: "Deleted",
    };
    return labels[action] || action;
  };

  const getActionColor = (action: string): string => {
    const colors: Record<string, string> = {
      created: "#22c55e",
      claimed: "#3b82f6",
      released: "#64748b",
      updated: "#f59e0b",
      deleted: "#ef4444",
    };
    return colors[action] || "#94a3b8";
  };

  if (taskLoading) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Task details"
        data-testid="task-detail-loading"
        style={overlayStyle}
        onClick={handleOverlayClick}
        onKeyDown={handleKeyDown}
      >
        <div style={modalStyle}>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              padding: "60px 0",
            }}
          >
            <div
              style={{
                width: "32px",
                height: "32px",
                border: "3px solid #334155",
                borderTopColor: "#3b82f6",
                borderRadius: "50%",
                animation: "spin 1s linear infinite",
              }}
            />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        </div>
      </div>
    );
  }

  if (taskError || !task) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Task details"
        data-testid="task-detail-error"
        style={overlayStyle}
        onClick={handleOverlayClick}
        onKeyDown={handleKeyDown}
      >
        <div style={modalStyle}>
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <div style={{ color: "#ef4444", fontSize: "16px", marginBottom: "8px" }}>
              Error loading task
            </div>
            <button
              onClick={onClose}
              style={buttonStyle}
              data-testid="task-detail-close-error"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Task details: ${task.title}`}
      data-testid="task-detail-modal"
      style={overlayStyle}
      onClick={handleOverlayClick}
      onKeyDown={handleKeyDown}
    >
      <div style={modalStyle}>
        <Toast messages={messages} onDismiss={dismissToast} />

        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: "20px",
            paddingBottom: "16px",
            borderBottom: "1px solid #1e293b",
          }}
        >
          <div style={{ flex: 1, marginRight: "16px" }}>
            {isEditing ? (
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                data-testid="edit-title-input"
                style={{
                  ...inputStyle,
                  fontSize: "18px",
                  fontWeight: 600,
                  width: "100%",
                }}
                autoFocus
              />
            ) : (
              <h2
                style={{
                  fontSize: "18px",
                  fontWeight: 600,
                  color: "#f1f5f9",
                  marginBottom: "8px",
                }}
                data-testid="task-detail-title"
              >
                {task.title}
              </h2>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "#94a3b8",
              cursor: "pointer",
              fontSize: "20px",
              padding: "4px 8px",
              lineHeight: 1,
            }}
            aria-label="Close"
            data-testid="task-detail-close"
          >
            ×
          </button>
        </div>

        {/* Status and Type badges */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
          <span
            data-testid="task-detail-status"
            style={{
              fontSize: "12px",
              padding: "4px 10px",
              borderRadius: "12px",
              backgroundColor: `${STATUS_COLORS[task.status as TaskStatus]}20`,
              color: STATUS_COLORS[task.status as TaskStatus],
              fontWeight: 500,
            }}
          >
            {STATUS_LABELS[task.status as TaskStatus]}
          </span>
          <span
            data-testid="task-detail-type"
            style={{
              fontSize: "12px",
              padding: "4px 10px",
              borderRadius: "12px",
              backgroundColor: "#334155",
              color: "#94a3b8",
            }}
          >
            {task.taskType.replace("_", " ")}
          </span>
          {task.requiresApproval && (
            <span
              data-testid="task-detail-approval-required"
              style={{
                fontSize: "12px",
                padding: "4px 10px",
                borderRadius: "12px",
                backgroundColor: "#f59e0b20",
                color: "#f59e0b",
              }}
            >
              Approval Required
            </span>
          )}
        </div>

        {/* Description */}
        <div style={{ marginBottom: "20px" }}>
          <label
            style={{
              fontSize: "12px",
              color: "#64748b",
              fontWeight: 500,
              display: "block",
              marginBottom: "6px",
            }}
          >
            Description
          </label>
          {isEditing ? (
            <textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              data-testid="edit-description-input"
              style={{
                ...inputStyle,
                minHeight: "100px",
                resize: "vertical",
                fontFamily: "inherit",
              }}
            />
          ) : (
            <p
              data-testid="task-detail-description"
              style={{
                fontSize: "14px",
                color: "#cbd5e1",
                lineHeight: 1.5,
                whiteSpace: "pre-wrap",
              }}
            >
              {task.description || "No description provided"}
            </p>
          )}
        </div>

        {/* Details Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "16px",
            marginBottom: "20px",
            padding: "16px",
            backgroundColor: "#0f172a",
            borderRadius: "8px",
          }}
        >
          <div>
            <label style={labelStyle}>Project</label>
            <p data-testid="task-detail-project" style={valueStyle}>
              {project?.name || task.projectId}
            </p>
          </div>
          <div>
            <label style={labelStyle}>Assigned Agent</label>
            <p data-testid="task-detail-agent" style={valueStyle}>
              {agent ? agent.name : "Unclaimed"}
            </p>
          </div>
          <div>
            <label style={labelStyle}>Created</label>
            <p data-testid="task-detail-created" style={valueStyle}>
              {formatDate(task.createdAt)}
            </p>
          </div>
          <div>
            <label style={labelStyle}>Updated</label>
            <p data-testid="task-detail-updated" style={valueStyle}>
              {formatDate(task.updatedAt)}
            </p>
          </div>
          <div>
            <label style={labelStyle}>Claimed</label>
            <p data-testid="task-detail-claimed" style={valueStyle}>
              {formatDate(task.claimedAt)}
            </p>
          </div>
          <div>
            <label style={labelStyle}>Task ID</label>
            <p data-testid="task-detail-id" style={{ ...valueStyle, fontSize: "12px" }}>
              {task.id}
            </p>
          </div>
        </div>

        {/* Activity History */}
        <div style={{ marginBottom: "20px" }}>
          <h3
            style={{
              fontSize: "14px",
              fontWeight: 600,
              color: "#e2e8f0",
              marginBottom: "12px",
            }}
            data-testid="activity-history-heading"
          >
            Activity History
          </h3>
          {logsLoading ? (
            <div style={{ color: "#64748b", fontSize: "13px" }}>
              Loading activity...
            </div>
          ) : logs.length === 0 ? (
            <div
              data-testid="activity-history-empty"
              style={{ color: "#475569", fontSize: "13px" }}
            >
              No activity recorded
            </div>
          ) : (
            <div
              data-testid="activity-history-list"
              style={{
                maxHeight: "200px",
                overflowY: "auto",
                border: "1px solid #1e293b",
                borderRadius: "6px",
              }}
            >
              {logs
                .sort(
                  (a, b) =>
                    new Date(b.createdAt).getTime() -
                    new Date(a.createdAt).getTime()
                )
                .map((log) => (
                  <div
                    key={log.id}
                    data-testid={`activity-log-${log.id}`}
                    style={{
                      padding: "10px 12px",
                      borderBottom: "1px solid #1e293b",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span
                        style={{
                          width: "8px",
                          height: "8px",
                          borderRadius: "50%",
                          backgroundColor: getActionColor(log.action),
                          flexShrink: 0,
                        }}
                      />
                      <span
                        data-testid={`log-action-${log.id}`}
                        style={{
                          fontSize: "13px",
                          fontWeight: 500,
                          color: getActionColor(log.action),
                          minWidth: "70px",
                        }}
                      >
                        {formatAction(log.action)}
                      </span>
                      <span
                        data-testid={`log-details-${log.id}`}
                        style={{ fontSize: "12px", color: "#94a3b8" }}
                      >
                        {formatLogDetails(log.action, log.details)}
                      </span>
                    </div>
                    <span
                      data-testid={`log-time-${log.id}`}
                      style={{ fontSize: "11px", color: "#475569", whiteSpace: "nowrap" }}
                    >
                      {formatDate(log.createdAt)}
                    </span>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Delete Confirmation */}
        {showDeleteConfirm && (
          <div
            data-testid="delete-confirmation"
            style={{
              padding: "16px",
              backgroundColor: "#450a0a",
              borderRadius: "8px",
              marginBottom: "16px",
              border: "1px solid #dc2626",
            }}
          >
            <p
              style={{
                fontSize: "14px",
                color: "#fca5a5",
                marginBottom: "12px",
              }}
            >
              Are you sure you want to delete this task? This action cannot be undone.
            </p>
            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                style={{
                  ...buttonStyle,
                  backgroundColor: "transparent",
                  color: "#94a3b8",
                  border: "1px solid #334155",
                }}
                data-testid="delete-cancel"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteTask.isPending}
                style={{
                  ...buttonStyle,
                  backgroundColor: "#dc2626",
                  border: "1px solid #dc2626",
                }}
                data-testid="delete-confirm"
              >
                {deleteTask.isPending ? "Deleting..." : "Delete Task"}
              </button>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "8px",
            paddingTop: "16px",
            borderTop: "1px solid #1e293b",
          }}
        >
          {isEditing ? (
            <>
              <button
                onClick={() => {
                  setIsEditing(false);
                  if (task) {
                    setEditTitle(task.title);
                    setEditDescription(task.description ?? "");
                  }
                }}
                style={{
                  ...buttonStyle,
                  backgroundColor: "transparent",
                  color: "#94a3b8",
                  border: "1px solid #334155",
                }}
                data-testid="edit-cancel"
              >
                Cancel
              </button>
              <button
                onClick={handleEditSave}
                disabled={updateTask.isPending || !editTitle.trim()}
                style={{
                  ...buttonStyle,
                  backgroundColor: editTitle.trim() ? "#22c55e" : "#1e293b",
                  border: `1px solid ${editTitle.trim() ? "#22c55e" : "#334155"}`,
                  color: editTitle.trim() ? "white" : "#475569",
                  cursor: editTitle.trim() ? "pointer" : "not-allowed",
                }}
                data-testid="edit-save"
              >
                {updateTask.isPending ? "Saving..." : "Save Changes"}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setIsEditing(true)}
                style={buttonStyle}
                data-testid="edit-button"
              >
                Edit
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                style={{
                  ...buttonStyle,
                  backgroundColor: "transparent",
                  color: "#f87171",
                  border: "1px solid #f87171",
                }}
                data-testid="delete-button"
              >
                Delete
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Helper to format log details into a readable string
function formatLogDetails(action: string, details: Record<string, unknown>): string {
  if (!details || Object.keys(details).length === 0) return "";

  switch (action) {
    case "created":
      return `Type: ${(details.task_type as string)?.replace("_", " ") || ""}`;
    case "claimed":
      return `By agent`;
    case "released":
      return `Status → ready`;
    case "updated": {
      const changes = details.field_changes as Array<{ field: string; old_value: unknown; new_value: unknown }> | undefined;
      if (!changes || changes.length === 0) return "";
      return changes
        .map((c) => `${c.field}: ${formatValue(c.old_value)} → ${formatValue(c.new_value)}`)
        .join(", ");
    }
    case "deleted":
      return "Task removed";
    default:
      return "";
  }
}

function formatValue(val: unknown): string {
  if (val === null || val === undefined) return "—";
  if (typeof val === "string") return val;
  return String(val);
}

// Style constants
const overlayStyle: React.CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: "rgba(0, 0, 0, 0.6)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
};

const modalStyle: React.CSSProperties = {
  backgroundColor: "#1e293b",
  borderRadius: "12px",
  border: "1px solid #334155",
  width: "90%",
  maxWidth: "600px",
  maxHeight: "90vh",
  overflowY: "auto",
  padding: "24px",
  boxShadow: "0 20px 60px rgba(0, 0, 0, 0.5)",
};

const inputStyle: React.CSSProperties = {
  backgroundColor: "#0f172a",
  color: "#e2e8f0",
  border: "1px solid #334155",
  borderRadius: "6px",
  padding: "8px 12px",
  fontSize: "14px",
  outline: "none",
  width: "100%",
};

const buttonStyle: React.CSSProperties = {
  padding: "8px 16px",
  borderRadius: "6px",
  fontSize: "13px",
  fontWeight: 500,
  cursor: "pointer",
  border: "1px solid transparent",
  backgroundColor: "#3b82f6",
  color: "white",
};

const labelStyle: React.CSSProperties = {
  fontSize: "11px",
  color: "#64748b",
  fontWeight: 500,
  display: "block",
  marginBottom: "4px",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
};

const valueStyle: React.CSSProperties = {
  fontSize: "13px",
  color: "#cbd5e1",
};
