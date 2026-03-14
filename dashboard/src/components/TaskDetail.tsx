import React, { useState } from "react";
import { useTask } from "../hooks/use-tasks";
import { useLogs } from "../hooks/use-logs";
import { useAgents } from "../hooks/use-agents";
import { useProjects } from "../hooks/use-projects";
import { useUpdateTask, useHandleApiError } from "../hooks/use-update-task";
import { useDeleteTask } from "../hooks/use-delete-task";
import { STATUS_LABELS, STATUS_COLORS, type TaskStatus } from "../lib/status-transitions";
import { Toast, useToast } from "./Toast";
import { AgentReasoningTimeline } from "./AgentReasoningTimeline";

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
      updates.description = editDescription.trim() || undefined;
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
                border: "3px solid #333",
                borderTopColor: "#00ffcc",
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
            <div style={{ color: "#ef4444", fontSize: "16px", marginBottom: "8px", fontFamily: "monospace" }}>
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
            borderBottom: "1px solid rgba(0,255,204,0.1)",
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
                  color: "#e2e8f0",
                  marginBottom: "8px",
                  fontFamily: "monospace",
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
              color: "#64748b",
              cursor: "pointer",
              fontSize: "20px",
              padding: "4px 8px",
              lineHeight: 1,
              fontFamily: "monospace",
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
              boxShadow: `0 0 4px ${STATUS_COLORS[task.status as TaskStatus]}`,
              fontFamily: "monospace",
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
              backgroundColor: "rgba(0,255,204,0.05)",
              color: "#64748b",
              fontFamily: "monospace",
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
                fontFamily: "monospace",
              }}
            >
              Approval Required
            </span>
          )}
        </div>

        {/* Description */}
        <div style={{ marginBottom: "20px" }}>
          <label style={sectionHeaderStyle}>
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
              }}
            />
          ) : (
            <p
              data-testid="task-detail-description"
              style={{
                fontSize: "14px",
                color: "#94a3b8",
                lineHeight: 1.5,
                whiteSpace: "pre-wrap",
                fontFamily: "monospace",
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
            backgroundColor: "#000",
            borderRadius: "8px",
            border: "1px solid rgba(0,255,204,0.08)",
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
            <p data-testid="task-detail-agent" style={{ ...valueStyle, color: agent ? "#00ff66" : "#64748b" }}>
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

        {/* Activity Timeline with Agent Reasoning */}
        <div style={{ marginBottom: "20px" }}>
          <h3
            style={sectionHeaderStyle}
            data-testid="activity-history-heading"
          >
            Activity Timeline
          </h3>
          <div
            style={{
              maxHeight: "300px",
              overflowY: "auto",
              paddingRight: "8px",
            }}
          >
            <AgentReasoningTimeline taskId={task.id} />
          </div>
        </div>

        {/* Delete Confirmation */}
        {showDeleteConfirm && (
          <div
            data-testid="delete-confirmation"
            style={{
              padding: "16px",
              backgroundColor: "rgba(69,10,10,0.5)",
              borderRadius: "8px",
              marginBottom: "16px",
              border: "1px solid #ff3333",
            }}
          >
            <p
              style={{
                fontSize: "14px",
                color: "#fca5a5",
                marginBottom: "12px",
                fontFamily: "monospace",
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
                  border: "1px solid #333",
                }}
                data-testid="delete-cancel"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteTask.isPending}
                style={dangerButtonStyle}
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
            borderTop: "1px solid rgba(0,255,204,0.1)",
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
                  border: "1px solid #333",
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
                  opacity: editTitle.trim() ? 1 : 0.4,
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
                style={dangerButtonStyle}
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

// Style constants
const overlayStyle: React.CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: "rgba(0, 10, 15, 0.85)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
};

const modalStyle: React.CSSProperties = {
  backgroundColor: "#0a0a0a",
  borderRadius: "12px",
  border: "1px solid rgba(0,255,204,0.2)",
  width: "90%",
  maxWidth: "600px",
  maxHeight: "90vh",
  overflowY: "auto",
  padding: "24px",
  boxShadow: "0 0 30px rgba(0,255,204,0.05)",
  fontFamily: "monospace",
};

const inputStyle: React.CSSProperties = {
  backgroundColor: "#000",
  color: "#e2e8f0",
  border: "1px solid #333",
  borderRadius: "6px",
  padding: "8px 12px",
  fontSize: "14px",
  outline: "none",
  width: "100%",
  fontFamily: "monospace",
};

const buttonStyle: React.CSSProperties = {
  padding: "8px 16px",
  borderRadius: "6px",
  fontSize: "13px",
  fontWeight: 500,
  cursor: "pointer",
  border: "1px solid #00ffcc",
  backgroundColor: "transparent",
  color: "#00ffcc",
  fontFamily: "monospace",
};

const dangerButtonStyle: React.CSSProperties = {
  padding: "8px 16px",
  borderRadius: "6px",
  fontSize: "13px",
  fontWeight: 500,
  cursor: "pointer",
  border: "1px solid #ff3333",
  backgroundColor: "transparent",
  color: "#ff3333",
  fontFamily: "monospace",
};

const sectionHeaderStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "rgba(0,255,204,0.5)",
  fontWeight: 500,
  display: "block",
  marginBottom: "8px",
  textTransform: "uppercase",
  letterSpacing: "1.5px",
  fontFamily: "monospace",
};

const labelStyle: React.CSSProperties = {
  fontSize: "11px",
  color: "rgba(0,255,204,0.4)",
  fontWeight: 500,
  display: "block",
  marginBottom: "4px",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
  fontFamily: "monospace",
};

const valueStyle: React.CSSProperties = {
  fontSize: "13px",
  color: "#94a3b8",
  fontFamily: "monospace",
};
