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
          border: "2px solid rgba(0,255,204,0.15)",
          borderTopColor: "#00ffcc",
          borderRadius: "50%",
          animation: "palantirPulseRing 1.5s ease-in-out infinite",
          boxShadow: "0 0 15px rgba(0,255,204,0.2), inset 0 0 15px rgba(0,255,204,0.05)",
        }}
      />
      <span
        style={{
          color: "#555555",
          fontSize: "14px",
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
          textTransform: "uppercase",
          letterSpacing: "2px",
        }}
      >
        {message}
      </span>
      <style>{`
        @keyframes palantirPulseRing {
          0%, 100% { border-top-color: #00ffcc; box-shadow: 0 0 15px rgba(0,255,204,0.2), inset 0 0 15px rgba(0,255,204,0.05); transform: rotate(0deg); }
          50% { border-top-color: rgba(0,255,204,0.6); box-shadow: 0 0 25px rgba(0,255,204,0.4), inset 0 0 25px rgba(0,255,204,0.1); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
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
        background: "radial-gradient(ellipse at center, rgba(255,51,51,0.05) 0%, transparent 70%)",
      }}
    >
      {/* Error icon */}
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

      <h2
        style={{
          color: "#ff3333",
          fontSize: "20px",
          fontWeight: 700,
          margin: 0,
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
          textTransform: "uppercase",
          letterSpacing: "1px",
        }}
      >
        {message}
      </h2>

      <p
        style={{
          color: "#555555",
          textAlign: "center",
          maxWidth: "420px",
          lineHeight: 1.5,
          margin: 0,
          fontSize: "14px",
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
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
            backgroundColor: "transparent",
            color: isRetrying ? "#555555" : "#00ffcc",
            border: `1px solid ${isRetrying ? "#333333" : "#00ffcc"}`,
            borderRadius: "4px",
            cursor: isRetrying ? "not-allowed" : "pointer",
            fontSize: "14px",
            fontWeight: 500,
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
            textTransform: "uppercase",
            letterSpacing: "1px",
            transition: "all 0.2s",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginTop: "4px",
          }}
          onMouseEnter={(e) => {
            if (!isRetrying) {
              e.currentTarget.style.boxShadow = "0 0 15px rgba(0,255,204,0.3)";
              e.currentTarget.style.backgroundColor = "rgba(0,255,204,0.05)";
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow = "none";
            e.currentTarget.style.backgroundColor = "transparent";
          }}
        >
          {isRetrying && (
            <span
              style={{
                width: "14px",
                height: "14px",
                border: "2px solid #333333",
                borderTopColor: "#555555",
                borderRadius: "50%",
                animation: "spin 1s linear infinite",
                display: "inline-block",
              }}
            />
          )}
          {isRetrying ? "Retrying..." : "Retry"}
        </button>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
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
  const title = hasActiveFilters
    ? "NO MATCHING SIGNALS"
    : "NO SIGNALS DETECTED";
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
        backgroundImage: "linear-gradient(rgba(0,255,204,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,204,0.03) 1px, transparent 1px)",
        backgroundSize: "40px 40px",
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
        }}
        aria-hidden="true"
      >
        {hasActiveFilters ? "?" : "-"}
      </div>

      <h2
        style={{
          color: "#555555",
          fontSize: "18px",
          fontWeight: 600,
          margin: 0,
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
          textTransform: "uppercase",
          letterSpacing: "3px",
        }}
      >
        {title}
      </h2>

      <p
        style={{
          color: "#444444",
          textAlign: "center",
          maxWidth: "400px",
          lineHeight: 1.5,
          margin: 0,
          fontSize: "14px",
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
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
            color: "#00ffcc",
            border: "1px solid #00ffcc",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "13px",
            fontWeight: 500,
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
            textTransform: "uppercase",
            letterSpacing: "1px",
            transition: "all 0.2s",
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
          Clear Filters
        </button>
      )}
    </div>
  );
}
