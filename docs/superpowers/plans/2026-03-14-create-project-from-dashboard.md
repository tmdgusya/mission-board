# Create Project from Dashboard - Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to create new projects directly from the dashboard UI via a modal form.

**Architecture:** Add a `CreateProjectForm` modal component (matching existing `CreateTaskForm` patterns), a `useCreateProject` React Query mutation hook, and wire a "+ New Project" button into the dashboard header. The backend API (`POST /api/projects`) and API client (`apiClient.createProject()`) already exist - this is purely frontend work.

**Tech Stack:** React 19, TypeScript, @tanstack/react-query, Bun test

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `dashboard/src/hooks/use-create-project.ts` | Create | React Query mutation hook for creating projects |
| `dashboard/src/components/CreateProjectForm.tsx` | Create | Modal form with name + description fields |
| `dashboard/src/components/CreateProjectForm.test.tsx` | Create | Tests for the form component |
| `dashboard/src/components/DashboardContent.tsx` | Modify | Add "+ New Project" button and form state |

---

## Chunk 1: Create Project Feature

### Task 1: Create the `useCreateProject` mutation hook

**Files:**
- Create: `dashboard/src/hooks/use-create-project.ts`

- [ ] **Step 1: Create the hook file**

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../lib/api-client";

export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { name: string; description?: string }) => {
      return apiClient.createProject(data);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `cd /home/roach/mission-board && bun build dashboard/src/hooks/use-create-project.ts --no-bundle 2>&1 | head -5`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/hooks/use-create-project.ts
git commit -m "feat(dashboard): add useCreateProject mutation hook"
```

---

### Task 2: Create the `CreateProjectForm` component

**Files:**
- Create: `dashboard/src/components/CreateProjectForm.tsx`

- [ ] **Step 1: Write the failing test**

Create `dashboard/src/components/CreateProjectForm.test.tsx`:

```tsx
import { test, expect, describe, mock, beforeEach } from "bun:test";

// Test the component structure expectations:
// - Modal renders when isOpen=true, hidden when false
// - Has name field (required) and description field (optional)
// - Submit button calls onClose on success
// - Cancel button calls onClose
// - Validates that name is not empty

describe("CreateProjectForm", () => {
  test("module exports CreateProjectForm component", async () => {
    const mod = await import("./CreateProjectForm");
    expect(mod.CreateProjectForm).toBeDefined();
    expect(typeof mod.CreateProjectForm).toBe("function");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd /home/roach/mission-board && bun test dashboard/src/components/CreateProjectForm.test.tsx 2>&1`
Expected: FAIL - module not found

- [ ] **Step 3: Create the `CreateProjectForm` component**

Create `dashboard/src/components/CreateProjectForm.tsx`. This follows the same patterns as `CreateTaskForm.tsx` - same overlay/modal styles, same form validation approach, same Toast usage:

```tsx
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd /home/roach/mission-board && bun test dashboard/src/components/CreateProjectForm.test.tsx 2>&1`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/components/CreateProjectForm.tsx dashboard/src/components/CreateProjectForm.test.tsx
git commit -m "feat(dashboard): add CreateProjectForm modal component"
```

---

### Task 3: Wire the "+ New Project" button into the dashboard

**Files:**
- Modify: `dashboard/src/components/DashboardContent.tsx`

- [ ] **Step 1: Add import for CreateProjectForm**

At the top of `DashboardContent.tsx`, add:

```tsx
import { CreateProjectForm } from "./CreateProjectForm";
```

- [ ] **Step 2: Add state for project form visibility**

Inside the `DashboardContent` component, alongside the existing `isCreateFormOpen` state, add:

```tsx
const [isCreateProjectFormOpen, setIsCreateProjectFormOpen] = useState(false);
```

- [ ] **Step 3: Add callbacks for project form**

After the existing `handleCloseCreateForm` callback, add:

```tsx
const handleOpenCreateProjectForm = useCallback(() => {
  setIsCreateProjectFormOpen(true);
}, []);

const handleCloseCreateProjectForm = useCallback(() => {
  setIsCreateProjectFormOpen(false);
}, []);
```

- [ ] **Step 4: Add "+ New Project" button in the header**

In the button group (`<div style={{ display: "flex", gap: "8px" }}>`), add a new button **before** the existing "+ New Task" button:

```tsx
<button
  data-testid="new-project-button"
  onClick={handleOpenCreateProjectForm}
  style={{
    padding: "8px 16px",
    borderRadius: "6px",
    fontSize: "13px",
    fontWeight: 500,
    cursor: "pointer",
    border: "1px solid #3b82f644",
    backgroundColor: "#1e293b",
    color: "#60a5fa",
    display: "flex",
    alignItems: "center",
    gap: "6px",
  }}
  onMouseEnter={(e) => {
    e.currentTarget.style.backgroundColor = "#334155";
  }}
  onMouseLeave={(e) => {
    e.currentTarget.style.backgroundColor = "#1e293b";
  }}
>
  + New Project
</button>
```

- [ ] **Step 5: Render the CreateProjectForm**

After the existing `<CreateTaskForm ... />`, add:

```tsx
<CreateProjectForm isOpen={isCreateProjectFormOpen} onClose={handleCloseCreateProjectForm} />
```

- [ ] **Step 6: Verify the dashboard compiles and renders**

Run: `cd /home/roach/mission-board && bun build dashboard/src/components/DashboardContent.tsx --no-bundle 2>&1 | head -10`
Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add dashboard/src/components/DashboardContent.tsx
git commit -m "feat(dashboard): add New Project button to dashboard header"
```

---

### Task 4: Manual smoke test

- [ ] **Step 1: Start the API server**

Run: `cd /home/roach/mission-board && bun run src/server.ts &`

- [ ] **Step 2: Start the dashboard server**

Run: `cd /home/roach/mission-board && bun run dashboard/server.ts &`

- [ ] **Step 3: Verify the feature works**

1. Open `http://localhost:3201` in a browser
2. Click "+ New Project" button in the header
3. Verify the modal opens with Name and Description fields
4. Try submitting with empty name - should show validation error
5. Fill in a name, submit - should create the project and close the modal
6. Open the "+ New Task" form - verify the new project appears in the project dropdown

- [ ] **Step 4: Stop servers**

```bash
kill %1 %2
```
