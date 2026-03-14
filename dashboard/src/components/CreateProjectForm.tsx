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
            borderBottom: "1px solid rgba(0,255,204,0.1)",
          }}
        >
          <h2
            data-testid="create-project-title"
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
