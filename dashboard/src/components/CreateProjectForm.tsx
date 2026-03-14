import React, { useState, useCallback, useEffect } from "react";
import { useCreateProject } from "../hooks/use-create-project";
import { useHandleApiError } from "../hooks/use-update-task";
import { Toast, useToast } from "./Toast";

interface CreateProjectFormProps {
  isOpen: boolean;
  onClose: () => void;
}

interface FormErrors {
  name?: string;
  general?: string;
}

export function CreateProjectForm({
  isOpen,
  onClose,
}: CreateProjectFormProps): React.ReactElement | null {
  const createProject = useCreateProject();
  const handleApiError = useHandleApiError();
  const { messages, addToast, dismissToast } = useToast();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    if (isOpen) {
      setName("");
      setDescription("");
      setErrors({});
    }
  }, [isOpen]);

  const validate = useCallback((): boolean => {
    const newErrors: FormErrors = {};
    if (!name.trim()) {
      newErrors.name = "Project name is required";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [name]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!validate()) return;

      createProject.mutate(
        {
          name: name.trim(),
          description: description.trim() || undefined,
        },
        {
          onSuccess: () => {
            addToast("Project created successfully", "success");
            onClose();
          },
          onError: (error) => {
            addToast(handleApiError(error), "error");
          },
        }
      );
    },
    [name, description, validate, createProject, addToast, handleApiError, onClose]
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
      aria-label="Create new project"
      data-testid="create-project-modal"
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
            borderBottom: "1px solid #1e293b",
          }}
        >
          <h2
            data-testid="create-project-title"
            style={{
              fontSize: "18px",
              fontWeight: 600,
              color: "#f1f5f9",
              margin: 0,
            }}
          >
            Create New Project
          </h2>
          <button
            onClick={onClose}
            style={closeButtonStyle}
            aria-label="Close"
            data-testid="create-project-close"
          >
            ×
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} data-testid="create-project-form">
          {/* Name */}
          <div style={fieldContainerStyle}>
            <label htmlFor="create-project-name" style={labelStyle}>
              Name <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <input
              id="create-project-name"
              type="text"
              data-testid="create-project-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
              }}
              placeholder="Enter project name..."
              style={errors.name ? { ...inputStyle, borderColor: "#ef4444" } : inputStyle}
              aria-required="true"
              autoFocus
            />
            {errors.name && (
              <span data-testid="error-name" style={errorTextStyle}>
                {errors.name}
              </span>
            )}
          </div>

          {/* Description */}
          <div style={fieldContainerStyle}>
            <label htmlFor="create-project-description" style={labelStyle}>
              Description
            </label>
            <textarea
              id="create-project-description"
              data-testid="create-project-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the project..."
              style={textareaStyle}
              rows={3}
            />
          </div>

          {/* General Error */}
          {errors.general && (
            <div
              data-testid="error-general"
              style={{
                padding: "12px",
                backgroundColor: "#450a0a",
                borderRadius: "8px",
                marginBottom: "16px",
                border: "1px solid #dc2626",
                color: "#fca5a5",
                fontSize: "13px",
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
              borderTop: "1px solid #1e293b",
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={cancelButtonStyle}
              data-testid="create-project-cancel"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createProject.isPending}
              style={submitButtonStyle}
              data-testid="create-project-submit"
            >
              {createProject.isPending ? "Creating..." : "Create Project"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Style constants (matching CreateTaskForm)
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
  maxWidth: "520px",
  maxHeight: "90vh",
  overflowY: "auto",
  padding: "24px",
  boxShadow: "0 20px 60px rgba(0, 0, 0, 0.5)",
};

const labelStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "#64748b",
  fontWeight: 500,
  display: "block",
  marginBottom: "6px",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
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
  boxSizing: "border-box",
};

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  minHeight: "80px",
  resize: "vertical",
  fontFamily: "inherit",
};

const fieldContainerStyle: React.CSSProperties = {
  marginBottom: "16px",
};

const errorTextStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "#f87171",
  marginTop: "4px",
  display: "block",
};

const closeButtonStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "#94a3b8",
  cursor: "pointer",
  fontSize: "20px",
  padding: "4px 8px",
  lineHeight: 1,
};

const cancelButtonStyle: React.CSSProperties = {
  padding: "8px 16px",
  borderRadius: "6px",
  fontSize: "13px",
  fontWeight: 500,
  cursor: "pointer",
  border: "1px solid #334155",
  backgroundColor: "transparent",
  color: "#94a3b8",
};

const submitButtonStyle: React.CSSProperties = {
  padding: "8px 16px",
  borderRadius: "6px",
  fontSize: "13px",
  fontWeight: 500,
  cursor: "pointer",
  border: "1px solid transparent",
  backgroundColor: "#3b82f6",
  color: "white",
};
