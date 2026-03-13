import React, { useState, useCallback } from "react";
import { useApprovals } from "../hooks/use-approvals";
import { useApproveRequest, useDenyRequest } from "../hooks/use-approval-actions";
import { useAgents } from "../hooks/use-agents";
import { useTasks } from "../hooks/use-tasks";
import { Toast, useToast } from "./Toast";
import type { ApprovalRequest, Agent, Task } from "../lib/api-client";

// =============================================
// Types
// =============================================

interface ApprovalQueueProps {
  onBack: () => void;
}

// =============================================
// Helpers
// =============================================

function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function getAgentName(
  agentId: string,
  agents: Agent[] | undefined
): string {
  if (!agents) return "Unknown Agent";
  const agent = agents.find((a) => a.id === agentId);
  return agent ? agent.name : agentId;
}

function getTaskTitle(
  taskId: string,
  tasks: Task[] | undefined
): string {
  if (!tasks) return "Unknown Task";
  const task = tasks.find((t) => t.id === taskId);
  return task ? task.title : "Unknown Task";
}

// =============================================
// Loading State
// =============================================

function ApprovalLoadingState(): React.ReactElement {
  return (
    <div
      data-testid="approvals-loading"
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
        Loading approvals...
      </span>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// =============================================
// Error State
// =============================================

function ApprovalErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}): React.ReactElement {
  return (
    <div
      data-testid="approvals-error"
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
      <h2 style={{ color: "#ef4444", fontSize: "20px", fontWeight: 700, margin: 0 }}>
        Error Loading Approvals
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
        data-testid="retry-approvals-button"
        aria-label="Retry loading approvals"
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
// Empty State
// =============================================

function ApprovalEmptyState(): React.ReactElement {
  return (
    <div
      data-testid="empty-approvals-message"
      role="status"
      aria-live="polite"
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
          width: "72px",
          height: "72px",
          borderRadius: "50%",
          backgroundColor: "#1e293b",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "32px",
          flexShrink: 0,
        }}
        aria-hidden="true"
      >
        ✅
      </div>
      <h2 style={{ color: "#e2e8f0", fontSize: "18px", fontWeight: 600, margin: 0 }}>
        No Pending Approvals
      </h2>
      <p
        style={{
          color: "#94a3b8",
          textAlign: "center",
          maxWidth: "400px",
          lineHeight: 1.5,
          margin: 0,
          fontSize: "14px",
        }}
      >
        All approval requests have been processed. New requests will appear here when agents submit them.
      </p>
    </div>
  );
}

// =============================================
// Status Badge
// =============================================

function StatusBadge({ status }: { status: ApprovalRequest["status"] }): React.ReactElement {
  const colors: Record<ApprovalRequest["status"], { bg: string; color: string; border: string }> = {
    pending: { bg: "rgba(245, 158, 11, 0.133)", color: "#f59e0b", border: "rgba(245, 158, 11, 0.267)" },
    approved: { bg: "rgba(34, 197, 94, 0.133)", color: "#22c55e", border: "rgba(34, 197, 94, 0.267)" },
    denied: { bg: "rgba(239, 68, 68, 0.133)", color: "#ef4444", border: "rgba(239, 68, 68, 0.267)" },
  };

  const c = colors[status];
  const label = status.charAt(0).toUpperCase() + status.slice(1);

  return (
    <span
      style={{
        fontSize: "12px",
        fontWeight: 500,
        backgroundColor: c.bg,
        color: c.color,
        padding: "2px 8px",
        borderRadius: "4px",
        border: `1px solid ${c.border}`,
        textTransform: "capitalize",
      }}
    >
      {label}
    </span>
  );
}

// =============================================
// Deny Form
// =============================================

function DenyForm({
  approvalId,
  onConfirm,
  onCancel,
  isLoading,
  validationError,
}: {
  approvalId: string;
  onConfirm: (notes: string) => void;
  onCancel: () => void;
  isLoading: boolean;
  validationError: string | null;
}): React.ReactElement {
  const [notes, setNotes] = useState("");

  const handleConfirm = (): void => {
    onConfirm(notes);
  };

  return (
    <div
      style={{
        marginTop: "12px",
        padding: "12px",
        backgroundColor: "#0f172a",
        borderRadius: "6px",
        border: "1px solid #334155",
      }}
    >
      <label
        htmlFor={`deny-notes-${approvalId}`}
        style={{
          display: "block",
          fontSize: "13px",
          fontWeight: 500,
          color: "#e2e8f0",
          marginBottom: "8px",
        }}
      >
        Notes (required):
      </label>
      <textarea
        id={`deny-notes-${approvalId}`}
        data-testid={`deny-notes-${approvalId}`}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Provide reason for denial..."
        rows={3}
        style={{
          width: "100%",
          padding: "8px 12px",
          borderRadius: "6px",
          border: "1px solid #334155",
          backgroundColor: "#1e293b",
          color: "#e2e8f0",
          fontSize: "13px",
          resize: "vertical",
          fontFamily: "inherit",
          outline: "none",
          boxSizing: "border-box",
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = "#3b82f6";
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = "#334155";
        }}
      />
      {validationError && (
        <p
          style={{
            color: "#ef4444",
            fontSize: "12px",
            marginTop: "6px",
            marginBottom: 0,
          }}
        >
          {validationError}
        </p>
      )}
      <div
        style={{
          display: "flex",
          gap: "8px",
          justifyContent: "flex-end",
          marginTop: "10px",
        }}
      >
        <button
          data-testid={`cancel-deny-button-${approvalId}`}
          onClick={onCancel}
          style={{
            padding: "6px 14px",
            borderRadius: "6px",
            fontSize: "13px",
            fontWeight: 500,
            cursor: "pointer",
            border: "1px solid #475569",
            backgroundColor: "transparent",
            color: "#94a3b8",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "#1e293b";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
          }}
        >
          Cancel
        </button>
        <button
          data-testid={`confirm-deny-button-${approvalId}`}
          onClick={handleConfirm}
          disabled={isLoading}
          style={{
            padding: "6px 14px",
            borderRadius: "6px",
            fontSize: "13px",
            fontWeight: 500,
            cursor: isLoading ? "not-allowed" : "pointer",
            border: "none",
            backgroundColor: isLoading ? "#7f1d1d" : "#dc2626",
            color: "white",
            opacity: isLoading ? 0.7 : 1,
          }}
          onMouseEnter={(e) => {
            if (!isLoading) e.currentTarget.style.backgroundColor = "#b91c1c";
          }}
          onMouseLeave={(e) => {
            if (!isLoading) e.currentTarget.style.backgroundColor = "#dc2626";
          }}
        >
          {isLoading ? "Denying..." : "Confirm Deny"}
        </button>
      </div>
    </div>
  );
}

// =============================================
// Approval Item
// =============================================

interface ApprovalItemProps {
  approval: ApprovalRequest;
  agentName: string;
  taskTitle: string;
  onApprove: (id: string) => void;
  onDeny: (id: string, notes: string) => void;
  isApproving: boolean;
  isDenying: boolean;
}

function ApprovalItem({
  approval,
  agentName,
  taskTitle,
  onApprove,
  onDeny,
  isApproving,
  isDenying,
}: ApprovalItemProps): React.ReactElement {
  const [showDenyForm, setShowDenyForm] = useState(false);
  const [denyValidationError, setDenyValidationError] = useState<string | null>(null);

  const handleDenyClick = (): void => {
    setShowDenyForm(true);
    setDenyValidationError(null);
  };

  const handleCancelDeny = (): void => {
    setShowDenyForm(false);
    setDenyValidationError(null);
  };

  const handleConfirmDeny = (notes: string): void => {
    if (!notes.trim()) {
      setDenyValidationError("Notes are required when denying a request");
      return;
    }
    onDeny(approval.id, notes.trim());
  };

  return (
    <div
      data-testid={`approval-item-${approval.id}`}
      role="listitem"
      style={{
        backgroundColor: "#1e293b",
        border: "1px solid #334155",
        borderRadius: "8px",
        padding: "16px",
      }}
    >
      {/* Header: task title + status */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "12px",
        }}
      >
        <h3
          style={{
            fontSize: "16px",
            fontWeight: 600,
            color: "#f1f5f9",
            margin: 0,
          }}
        >
          {taskTitle}
        </h3>
        <StatusBadge status={approval.status} />
      </div>

      {/* Details */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          marginBottom: "16px",
          fontSize: "14px",
        }}
      >
        <div style={{ display: "flex", gap: "8px" }}>
          <span style={{ color: "#94a3b8", minWidth: "80px" }}>
            Agent:
          </span>
          <span style={{ color: "#e2e8f0", fontWeight: 500 }}>
            {agentName}
          </span>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <span style={{ color: "#94a3b8", minWidth: "80px" }}>
            Action:
          </span>
          <span style={{ color: "#e2e8f0" }}>
            {approval.actionRequested}
          </span>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <span style={{ color: "#94a3b8", minWidth: "80px" }}>
            Requested:
          </span>
          <span
            data-testid="approval-timestamp"
            style={{ color: "#e2e8f0" }}
          >
            {formatTimestamp(approval.createdAt)}
          </span>
        </div>
      </div>

      {/* Action buttons */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          justifyContent: "flex-end",
        }}
      >
        {!showDenyForm && (
          <>
            <button
              data-testid={`deny-button-${approval.id}`}
              aria-label={`Deny request from ${agentName}`}
              onClick={handleDenyClick}
              disabled={isApproving || isDenying}
              style={{
                padding: "6px 14px",
                borderRadius: "6px",
                fontSize: "13px",
                fontWeight: 500,
                cursor: isApproving || isDenying ? "not-allowed" : "pointer",
                border: "1px solid rgba(220, 38, 38, 0.267)",
                backgroundColor: "rgba(220, 38, 38, 0.133)",
                color: "#f87171",
                opacity: isApproving || isDenying ? 0.5 : 1,
              }}
              onMouseEnter={(e) => {
                if (!isApproving && !isDenying)
                  e.currentTarget.style.backgroundColor = "rgba(220, 38, 38, 0.2)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "rgba(220, 38, 38, 0.133)";
              }}
            >
              Deny
            </button>
            <button
              data-testid={`approve-button-${approval.id}`}
              aria-label={`Approve request from ${agentName}`}
              onClick={() => onApprove(approval.id)}
              disabled={isApproving || isDenying}
              style={{
                padding: "6px 14px",
                borderRadius: "6px",
                fontSize: "13px",
                fontWeight: 500,
                cursor: isApproving || isDenying ? "not-allowed" : "pointer",
                border: "none",
                backgroundColor: "#16a34a",
                color: "white",
                opacity: isApproving || isDenying ? 0.5 : 1,
              }}
              onMouseEnter={(e) => {
                if (!isApproving && !isDenying)
                  e.currentTarget.style.backgroundColor = "#15803d";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "#16a34a";
              }}
            >
              {isApproving ? "Approving..." : "Approve"}
            </button>
          </>
        )}
      </div>

      {/* Deny form */}
      {showDenyForm && (
        <DenyForm
          approvalId={approval.id}
          onConfirm={handleConfirmDeny}
          onCancel={handleCancelDeny}
          isLoading={isDenying}
          validationError={denyValidationError}
        />
      )}
    </div>
  );
}

// =============================================
// Main ApprovalQueue Component
// =============================================

const DASHBOARD_REVIEWER_ID = "00000000-0000-0000-0000-000000000000"; // System UUID for dashboard reviewer

export function ApprovalQueue({ onBack }: ApprovalQueueProps): React.ReactElement {
  const { messages, addToast, dismissToast } = useToast();
  const approveRequest = useApproveRequest();
  const denyRequest = useDenyRequest();

  const {
    data: approvals = [],
    isLoading,
    error: approvalsError,
    refetch: refetchApprovals,
  } = useApprovals({ status: "pending" });

  const { data: agents = [] } = useAgents();
  const { data: tasks = [] } = useTasks();

  const handleApprove = useCallback(
    (id: string) => {
      const reviewerId = crypto.randomUUID();
      approveRequest.mutate(
        { id, reviewedBy: reviewerId },
        {
          onSuccess: () => {
            addToast("Approval approved successfully", "success");
          },
          onError: (error: Error) => {
            addToast(error.message, "error");
          },
        }
      );
    },
    [approveRequest, addToast]
  );

  const handleDeny = useCallback(
    (id: string, notes: string) => {
      const reviewerId = crypto.randomUUID();
      denyRequest.mutate(
        { id, reviewedBy: reviewerId, notes },
        {
          onSuccess: () => {
            addToast("Approval denied successfully", "success");
          },
          onError: (error: Error) => {
            addToast(error.message, "error");
          },
        }
      );
    },
    [denyRequest, addToast]
  );

  // Loading state
  if (isLoading) {
    return (
      <div style={{ padding: "24px", maxWidth: "100%" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "24px",
          }}
        >
          <h1
            data-testid="approval-queue-header"
            style={{ fontSize: "24px", fontWeight: 700, color: "#f1f5f9", margin: 0 }}
          >
            Approval Queue
          </h1>
        </div>
        <ApprovalLoadingState />
      </div>
    );
  }

  // Error state
  if (approvalsError) {
    return (
      <div style={{ padding: "24px", maxWidth: "100%" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "24px",
          }}
        >
          <h1
            data-testid="approval-queue-header"
            style={{ fontSize: "24px", fontWeight: 700, color: "#f1f5f9", margin: 0 }}
          >
            Approval Queue
          </h1>
        </div>
        <ApprovalErrorState
          message="Failed to load approval requests. Please check your connection and try again."
          onRetry={() => void refetchApprovals()}
        />
      </div>
    );
  }

  return (
    <div style={{ padding: "24px", maxWidth: "100%" }}>
      {/* Header */}
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
            data-testid="approval-queue-header"
            style={{ fontSize: "24px", fontWeight: 700, color: "#f1f5f9", margin: 0 }}
          >
            Approval Queue
          </h1>
        </div>
        <span
          data-testid="pending-count"
          style={{
            fontSize: "14px",
            color: "#94a3b8",
            backgroundColor: "#1e293b",
            padding: "4px 12px",
            borderRadius: "12px",
          }}
        >
          {approvals.length} pending
        </span>
      </div>

      <Toast messages={messages} onDismiss={dismissToast} />

      {/* Empty state */}
      {approvals.length === 0 && <ApprovalEmptyState />}

      {/* Approval list */}
      <div
        role="list"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        {approvals.map((approval) => (
          <ApprovalItem
            key={approval.id}
            approval={approval}
            agentName={getAgentName(approval.agentId, agents)}
            taskTitle={getTaskTitle(approval.taskId, tasks)}
            onApprove={handleApprove}
            onDeny={handleDeny}
            isApproving={approveRequest.isPending && approveRequest.variables?.id === approval.id}
            isDenying={denyRequest.isPending && denyRequest.variables?.id === approval.id}
          />
        ))}
      </div>
    </div>
  );
}
