import React from "react";

// =============================================
// Loading State Component
// =============================================

interface LoadingStateProps {
  message?: string;
}

export function LoadingState({
  message = "Loading board...",
}: LoadingStateProps): React.ReactElement {
  return (
    <div
      data-testid="loading-state"
      role="status"
      aria-live="polite"
      aria-label={message}
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
        className="board-spinner"
        style={{
          width: "48px",
          height: "48px",
          border: "4px solid #334155",
          borderTopColor: "#3b82f6",
          borderRadius: "50%",
          animation: "spin 1s linear infinite",
        }}
      />
      <span
        style={{
          color: "#94a3b8",
          fontSize: "14px",
        }}
      >
        {message}
      </span>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// =============================================
// Error State Component
// =============================================

interface ErrorStateProps {
  message?: string;
  details?: string;
  onRetry?: () => void;
  isRetrying?: boolean;
}

export function ErrorState({
  message = "Connection Error",
  details = "Unable to connect to the API server. Make sure it's running on port 3200.",
  onRetry,
  isRetrying = false,
}: ErrorStateProps): React.ReactElement {
  return (
    <div
      data-testid="error-state"
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
      {/* Error icon */}
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

      <h2
        style={{
          color: "#ef4444",
          fontSize: "20px",
          fontWeight: 700,
          margin: 0,
        }}
      >
        {message}
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
        {details}
      </p>

      {onRetry && (
        <button
          onClick={onRetry}
          disabled={isRetrying}
          data-testid="retry-button"
          aria-label="Retry connection"
          style={{
            padding: "10px 28px",
            backgroundColor: isRetrying ? "#1e293b" : "#3b82f6",
            color: isRetrying ? "#64748b" : "white",
            border: "none",
            borderRadius: "8px",
            cursor: isRetrying ? "not-allowed" : "pointer",
            fontSize: "14px",
            fontWeight: 500,
            transition: "background-color 0.2s",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginTop: "4px",
          }}
        >
          {isRetrying && (
            <span
              style={{
                width: "14px",
                height: "14px",
                border: "2px solid #475569",
                borderTopColor: "#64748b",
                borderRadius: "50%",
                animation: "spin 1s linear infinite",
                display: "inline-block",
              }}
            />
          )}
          {isRetrying ? "Retrying..." : "Retry"}
        </button>
      )}
    </div>
  );
}

// =============================================
// Empty State Component
// =============================================

interface EmptyStateProps {
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
}

export function EmptyState({
  hasActiveFilters = false,
  onClearFilters,
}: EmptyStateProps): React.ReactElement {
  const icon = hasActiveFilters ? "🔍" : "📋";
  const title = hasActiveFilters
    ? "No matching tasks"
    : "No tasks yet";
  const description = hasActiveFilters
    ? "No tasks match the current filters. Try adjusting or clearing your filters."
    : "Create your first task to get started with the Mission Board.";

  return (
    <div
      data-testid="empty-state"
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
        {icon}
      </div>

      <h2
        style={{
          color: "#e2e8f0",
          fontSize: "18px",
          fontWeight: 600,
          margin: 0,
        }}
      >
        {title}
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
        {description}
      </p>

      {hasActiveFilters && onClearFilters && (
        <button
          onClick={onClearFilters}
          data-testid="clear-filters-button"
          aria-label="Clear all filters"
          style={{
            marginTop: "8px",
            padding: "8px 20px",
            backgroundColor: "transparent",
            color: "#3b82f6",
            border: "1px solid #3b82f6",
            borderRadius: "8px",
            cursor: "pointer",
            fontSize: "13px",
            fontWeight: 500,
            transition: "background-color 0.2s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "#3b82f620";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
          }}
        >
          Clear Filters
        </button>
      )}
    </div>
  );
}
