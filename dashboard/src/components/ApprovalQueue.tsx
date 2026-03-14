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
          border: "2px solid rgba(0,255,204,0.15)",
          borderTopColor: "#00ffcc",
          borderRadius: "50%",
          animation: "spin 1s linear infinite",
          boxShadow: "0 0 15px rgba(0,255,204,0.2)",
        }}
      />
      <span style={{ color: "#555555", fontSize: "14px", fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", letterSpacing: "2px" }}>
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
      <h2 style={{ color: "#ff3333", fontSize: "20px", fontWeight: 700, margin: 0, fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", letterSpacing: "1px" }}>
        Error Loading Approvals
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
        data-testid="retry-approvals-button"
        aria-label="Retry loading approvals"
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
          backgroundColor: "rgba(0,255,204,0.05)",
          border: "1px solid rgba(0,255,204,0.15)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "32px",
          flexShrink: 0,
          color: "#00ffcc",
        }}
        aria-hidden="true"
      >
        -
      </div>
      <h2 style={{ color: "#555555", fontSize: "18px", fontWeight: 600, margin: 0, fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", letterSpacing: "3px" }}>
        No Pending Approvals
      </h2>
      <p
        style={{
          color: "#444444",
          textAlign: "center",
          maxWidth: "400px",
          lineHeight: 1.5,
          margin: 0,
          fontSize: "14px",
          fontFamily: "'JetBrains Mono', monospace",
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
    pending: { bg: "rgba(255, 170, 0, 0.1)", color: "#ffaa00", border: "rgba(255, 170, 0, 0.25)" },
    approved: { bg: "rgba(0, 255, 102, 0.1)", color: "#00ff66", border: "rgba(0, 255, 102, 0.25)" },
    denied: { bg: "rgba(255, 51, 51, 0.1)", color: "#ff3333", border: "rgba(255, 51, 51, 0.25)" },
  };

  const c = colors[status];
  const label = status.charAt(0).toUpperCase() + status.slice(1);

  return (
    <>
      <span
        style={{
          fontSize: "11px",
          fontWeight: 500,
          backgroundColor: c.bg,
          color: c.color,
          padding: "2px 8px",
          borderRadius: "4px",
          border: `1px solid ${c.border}`,
          textTransform: "uppercase",
          letterSpacing: "1px",
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
        }}
      >
        {status === "pending" && (
          <span
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              backgroundColor: "#ffaa00",
              display: "inline-block",
              animation: "pulseAmber 1.5s ease-in-out infinite",
            }}
          />
        )}
        {label}
      </span>
      {status === "pending" && (
        <style>{`@keyframes pulseAmber { 0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(255,170,0,0.4); } 50% { opacity: 0.5; box-shadow: 0 0 0 4px rgba(255,170,0,0); } }`}</style>
      )}
    </>
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
        backgroundColor: "#050505",
        borderRadius: "4px",
        border: "1px solid rgba(0,255,204,0.1)",
      }}
    >
      <label
        htmlFor={`deny-notes-${approvalId}`}
        style={{
          display: "block",
          fontSize: "11px",
          fontWeight: 500,
          color: "#555555",
          marginBottom: "8px",
          fontFamily: "'JetBrains Mono', monospace",
          textTransform: "uppercase",
          letterSpacing: "1px",
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
          borderRadius: "4px",
          border: "1px solid #333333",
          backgroundColor: "#000000",
          color: "#c0c0c0",
          fontSize: "13px",
          resize: "vertical",
          fontFamily: "'JetBrains Mono', monospace",
          outline: "none",
          boxSizing: "border-box",
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = "#00ffcc";
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = "#333333";
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
        backgroundColor: "#0a0a0a",
        border: "1px solid rgba(0,255,204,0.12)",
        borderRadius: "4px",
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
            color: "#c0c0c0",
            margin: 0,
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
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
          <span style={{ color: "#555555", minWidth: "80px", fontFamily: "'JetBrains Mono', monospace" }}>
            Agent:
          </span>
          <span style={{ color: "#c0c0c0", fontWeight: 500, fontFamily: "'JetBrains Mono', monospace" }}>
            {agentName}
          </span>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <span style={{ color: "#555555", minWidth: "80px", fontFamily: "'JetBrains Mono', monospace" }}>
            Action:
          </span>
          <span style={{ color: "#c0c0c0", fontFamily: "'JetBrains Mono', monospace" }}>
            {approval.actionRequested}
          </span>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <span style={{ color: "#555555", minWidth: "80px", fontFamily: "'JetBrains Mono', monospace" }}>
            Requested:
          </span>
          <span
            data-testid="approval-timestamp"
            style={{ color: "#c0c0c0", fontFamily: "'JetBrains Mono', monospace" }}
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
                borderRadius: "4px",
                fontSize: "13px",
                fontWeight: 500,
                fontFamily: "'JetBrains Mono', monospace",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                cursor: isApproving || isDenying ? "not-allowed" : "pointer",
                border: "1px solid #ff3333",
                backgroundColor: "transparent",
                color: "#ff3333",
                opacity: isApproving || isDenying ? 0.5 : 1,
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                if (!isApproving && !isDenying) {
                  e.currentTarget.style.boxShadow = "0 0 12px rgba(255,51,51,0.3)";
                  e.currentTarget.style.backgroundColor = "rgba(255,51,51,0.05)";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = "none";
                e.currentTarget.style.backgroundColor = "transparent";
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
                borderRadius: "4px",
                fontSize: "13px",
                fontWeight: 500,
                fontFamily: "'JetBrains Mono', monospace",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                cursor: isApproving || isDenying ? "not-allowed" : "pointer",
                border: "1px solid #00ff66",
                backgroundColor: "transparent",
                color: "#00ff66",
                opacity: isApproving || isDenying ? 0.5 : 1,
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                if (!isApproving && !isDenying) {
                  e.currentTarget.style.boxShadow = "0 0 12px rgba(0,255,102,0.3)";
                  e.currentTarget.style.backgroundColor = "rgba(0,255,102,0.05)";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = "none";
                e.currentTarget.style.backgroundColor = "transparent";
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
            style={{ fontSize: "20px", fontWeight: 700, color: "#00ffcc", margin: 0, fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase" as const, letterSpacing: "2px" }}
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
            style={{ fontSize: "20px", fontWeight: 700, color: "#00ffcc", margin: 0, fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase" as const, letterSpacing: "2px" }}
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
            data-testid="approval-queue-header"
            style={{ fontSize: "20px", fontWeight: 700, color: "#00ffcc", margin: 0, fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase" as const, letterSpacing: "2px" }}
          >
            Approval Queue
          </h1>
        </div>
        <span
          data-testid="pending-count"
          style={{
            fontSize: "12px",
            color: "#ffaa00",
            backgroundColor: "rgba(255,170,0,0.1)",
            border: "1px solid rgba(255,170,0,0.2)",
            padding: "4px 12px",
            borderRadius: "4px",
            fontFamily: "'JetBrains Mono', monospace",
            textTransform: "uppercase",
            letterSpacing: "1px",
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
