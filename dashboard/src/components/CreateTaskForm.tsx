import React, { useState, useCallback, useEffect } from "react";
import { useProjects } from "../hooks/use-projects";
import { useCreateTask } from "../hooks/use-create-task";
import { useHandleApiError } from "../hooks/use-update-task";
import { Toast, useToast } from "./Toast";

// Valid task types matching backend schema
const TASK_TYPES = [
  { value: "implementation", label: "Implementation" },
  { value: "bugfix", label: "Bug Fix" },
  { value: "feature", label: "Feature" },
  { value: "deployment", label: "Deployment" },
  { value: "documentation", label: "Documentation" },
  { value: "testing", label: "Testing" },
  { value: "research", label: "Research" },
  { value: "other", label: "Other" },
] as const;

interface CreateTaskFormProps {
  isOpen: boolean;
  onClose: () => void;
}

interface FormErrors {
  title?: string;
  projectId?: string;
  taskType?: string;
  general?: string;
}

export function CreateTaskForm({
  isOpen,
  onClose,
}: CreateTaskFormProps): React.ReactElement | null {
  const { data: projects = [], isLoading: projectsLoading } = useProjects();
  const createTask = useCreateTask();
  const handleApiError = useHandleApiError();
  const { messages, addToast, dismissToast } = useToast();

  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState("");
  const [description, setDescription] = useState("");
  const [taskType, setTaskType] = useState("");
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setTitle("");
      setProjectId("");
      setDescription("");
      setTaskType("");
      setRequiresApproval(false);
      setErrors({});
    }
  }, [isOpen]);

  const validate = useCallback((): boolean => {
    const newErrors: FormErrors = {};

    if (!title.trim()) {
      newErrors.title = "Title is required";
    }

    if (!projectId) {
      newErrors.projectId = "Project is required";
    }

    if (!taskType) {
      newErrors.taskType = "Task type is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [title, projectId, taskType]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!validate()) return;

      createTask.mutate(
        {
          title: title.trim(),
          projectId,
          description: description.trim() || undefined,
          taskType,
          requiresApproval,
        },
        {
          onSuccess: () => {
            addToast("Task created successfully", "success");
            onClose();
          },
          onError: (error) => {
            addToast(handleApiError(error), "error");
          },
        }
      );
    },
    [title, projectId, description, taskType, requiresApproval, validate, createTask, addToast, handleApiError, onClose]
  );

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    },
    [onClose]
  );

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Create new task"
      data-testid="create-task-modal"
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
            alignItems: "center",
            marginBottom: "24px",
            paddingBottom: "16px",
            borderBottom: "1px solid rgba(0,255,204,0.1)",
          }}
        >
          <h2
            data-testid="create-task-title"
            style={{
              fontSize: "16px",
              fontWeight: 600,
              color: "#00ffcc",
              margin: 0,
              fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
              textTransform: "uppercase",
              letterSpacing: "1.5px",
            }}
          >
            Create New Task
          </h2>
          <button
            onClick={onClose}
            style={closeButtonStyle}
            aria-label="Close"
            data-testid="create-task-close"
          >
            ×
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} data-testid="create-task-form">
          {/* Project Selector */}
          <div style={fieldContainerStyle}>
            <label
              htmlFor="create-task-project"
              style={labelStyle}
            >
              Project <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <select
              id="create-task-project"
              data-testid="create-task-project"
              value={projectId}
              onChange={(e) => {
                setProjectId(e.target.value);
                if (errors.projectId) setErrors((prev) => ({ ...prev, projectId: undefined }));
              }}
              style={errors.projectId ? { ...selectStyle, borderColor: "#ef4444" } : selectStyle}
              aria-required="true"
              disabled={projectsLoading}
            >
              <option value="">Select a project...</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
            {errors.projectId && (
              <span data-testid="error-project" style={errorTextStyle}>
                {errors.projectId}
              </span>
            )}
          </div>

          {/* Title */}
          <div style={fieldContainerStyle}>
            <label
              htmlFor="create-task-title-input"
              style={labelStyle}
            >
              Title <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <input
              id="create-task-title-input"
              type="text"
              data-testid="create-task-title-input"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (errors.title) setErrors((prev) => ({ ...prev, title: undefined }));
              }}
              placeholder="Enter task title..."
              style={errors.title ? { ...inputStyle, borderColor: "#ef4444" } : inputStyle}
              aria-required="true"
              autoFocus
            />
            {errors.title && (
              <span data-testid="error-title" style={errorTextStyle}>
                {errors.title}
              </span>
            )}
          </div>

          {/* Description */}
          <div style={fieldContainerStyle}>
            <label
              htmlFor="create-task-description"
              style={labelStyle}
            >
              Description
            </label>
            <textarea
              id="create-task-description"
              data-testid="create-task-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the task..."
              style={textareaStyle}
              rows={3}
            />
          </div>

          {/* Task Type */}
          <div style={fieldContainerStyle}>
            <label
              htmlFor="create-task-type"
              style={labelStyle}
            >
              Task Type <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <select
              id="create-task-type"
              data-testid="create-task-type"
              value={taskType}
              onChange={(e) => {
                setTaskType(e.target.value);
                if (errors.taskType) setErrors((prev) => ({ ...prev, taskType: undefined }));
              }}
              style={errors.taskType ? { ...selectStyle, borderColor: "#ef4444" } : selectStyle}
              aria-required="true"
            >
              <option value="">Select task type...</option>
              {TASK_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
            {errors.taskType && (
              <span data-testid="error-task-type" style={errorTextStyle}>
                {errors.taskType}
              </span>
            )}
          </div>

          {/* Requires Approval Checkbox */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "24px",
            }}
          >
            <input
              id="create-task-approval"
              type="checkbox"
              data-testid="create-task-approval"
              checked={requiresApproval}
              onChange={(e) => setRequiresApproval(e.target.checked)}
              style={{
                width: "16px",
                height: "16px",
                accentColor: "#00ffcc",
                cursor: "pointer",
              }}
            />
            <label
              htmlFor="create-task-approval"
              style={{
                fontSize: "13px",
                color: "#888888",
                cursor: "pointer",
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              Requires approval
            </label>
          </div>

          {/* General Error */}
          {errors.general && (
            <div
              data-testid="error-general"
              style={{
                padding: "12px",
                backgroundColor: "rgba(255,51,51,0.05)",
                borderRadius: "4px",
                marginBottom: "16px",
                border: "1px solid rgba(255,51,51,0.3)",
                color: "#ff3333",
                fontSize: "13px",
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              {errors.general}
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
            <button
              type="button"
              onClick={onClose}
              style={cancelButtonStyle}
              data-testid="create-task-cancel"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createTask.isPending}
              style={submitButtonStyle}
              data-testid="create-task-submit"
            >
              {createTask.isPending ? "Creating..." : "Create Task"}
            </button>
          </div>
        </form>
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
  backgroundColor: "rgba(0, 0, 0, 0.85)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
};

const modalStyle: React.CSSProperties = {
  backgroundColor: "#0a0a0a",
  borderRadius: "4px",
  border: "1px solid rgba(0,255,204,0.2)",
  width: "90%",
  maxWidth: "520px",
  maxHeight: "90vh",
  overflowY: "auto",
  padding: "24px",
  boxShadow: "0 20px 60px rgba(0, 0, 0, 0.8), 0 0 30px rgba(0,255,204,0.05)",
};

const labelStyle: React.CSSProperties = {
  fontSize: "11px",
  color: "#555555",
  fontWeight: 500,
  display: "block",
  marginBottom: "6px",
  textTransform: "uppercase",
  letterSpacing: "1.5px",
  fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
};

const inputStyle: React.CSSProperties = {
  backgroundColor: "#000000",
  color: "#c0c0c0",
  border: "1px solid #333333",
  borderRadius: "4px",
  padding: "8px 12px",
  fontSize: "14px",
  fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: "pointer",
};

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  minHeight: "80px",
  resize: "vertical",
};

const fieldContainerStyle: React.CSSProperties = {
  marginBottom: "16px",
};

const errorTextStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "#ff3333",
  marginTop: "4px",
  display: "block",
  fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
};

const closeButtonStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "#555555",
  cursor: "pointer",
  fontSize: "20px",
  padding: "4px 8px",
  lineHeight: 1,
};

const cancelButtonStyle: React.CSSProperties = {
  padding: "8px 16px",
  borderRadius: "4px",
  fontSize: "13px",
  fontWeight: 500,
  cursor: "pointer",
  border: "1px solid #555555",
  backgroundColor: "transparent",
  color: "#555555",
  fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
};

const submitButtonStyle: React.CSSProperties = {
  padding: "8px 16px",
  borderRadius: "4px",
  fontSize: "13px",
  fontWeight: 500,
  cursor: "pointer",
  border: "1px solid #00ffcc",
  backgroundColor: "transparent",
  color: "#00ffcc",
  fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
  transition: "all 0.2s",
};
