import React, { useState } from "react";
import { useLogs } from "../hooks/use-logs";
import type { TaskLog } from "../lib/api-client";

interface AgentReasoningTimelineProps {
  taskId: string;
}

export function AgentReasoningTimeline({
  taskId,
}: AgentReasoningTimelineProps): React.ReactElement | null {
  const { data: logs = [], isLoading } = useLogs(
    taskId ? { task_id: taskId } : undefined
  );

  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const toggleExpand = (logId: string): void => {
    setExpandedLogId(expandedLogId === logId ? null : logId);
  };

  const formatRelativeTime = (dateStr: string): string => {
    const now = new Date();
    const then = new Date(dateStr);
    const diffMs = now.getTime() - then.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return then.toLocaleDateString();
  };

  const getActionBadgeStyle = (action: string): React.CSSProperties => {
    const styles: Record<string, React.CSSProperties> = {
      claimed: {
        background: "#00ffcc22",
        color: "#00ffcc",
      },
      updated: {
        background: "#f0c04022",
        color: "#f0c040",
      },
      released: {
        background: "#ff666622",
        color: "#ff6666",
      },
      created: {
        background: "#66ccff22",
        color: "#66ccff",
      },
      approval_requested: {
        background: "#cc66ff22",
        color: "#cc66ff",
      },
    };
    return (
      styles[action] || {
        background: "#444222",
        color: "#888",
      }
    );
  };

  if (!taskId) return null;

  if (isLoading) {
    return (
      <div style={loadingStyle}>
        <div style={spinnerStyle} />
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div style={emptyStyle}>
        <span style={emptyIconStyle}>○</span>
        <span data-testid="activity-history-empty">No activity recorded</span>
      </div>
    );
  }

  const sortedLogs = [...logs].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  return (
    <div style={containerStyle} data-testid="activity-history-list">
      <div style={timelineStyle}>
        {sortedLogs.map((log) => {
          const hasReasoning = log.reason !== null || log.transcript !== null;
          const isExpanded = expandedLogId === log.id;

          return (
            <div key={log.id} style={entryStyle}>
              <div
                style={{
                  ...dotStyle,
                  ...(hasReasoning ? glowingDotStyle : dimDotStyle),
                }}
              />
              <div
                style={{
                  ...cardStyle,
                  ...(hasReasoning ? hasReasoningCardStyle : {}),
                }}
              >
                <div
                  style={headerStyle}
                  onClick={() => hasReasoning && toggleExpand(log.id)}
                  role={hasReasoning ? "button" : undefined}
                  tabIndex={hasReasoning ? 0 : undefined}
                  aria-expanded={isExpanded}
                  onKeyDown={(e) => {
                    if (hasReasoning && (e.key === "Enter" || e.key === " ")) {
                      e.preventDefault();
                      toggleExpand(log.id);
                    }
                  }}
                >
                  <span
                    style={{
                      ...badgeStyle,
                      ...getActionBadgeStyle(log.action),
                    }}
                  >
                    {log.action}
                  </span>
                  <span style={agentNameStyle}>
                    {log.agentId || "System"}
                  </span>
                  {hasReasoning && (
                    <button
                      style={expandBtnStyle}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleExpand(log.id);
                      }}
                      type="button"
                    >
                      {isExpanded ? "COLLAPSE" : "EXPAND"}
                    </button>
                  )}
                  <span style={timestampStyle}>
                    {formatRelativeTime(log.createdAt)}
                  </span>
                </div>

                {hasReasoning && log.reason && (
                  <div style={reasonSummaryStyle}>&quot;{log.reason}&quot;</div>
                )}

                {!hasReasoning && (
                  <div style={noReasoningStyle}>No agent reasoning available</div>
                )}

                {isExpanded && log.transcript && log.transcript.length > 0 && (
                  <div style={transcriptPanelStyle}>
                    <span style={transcriptLabelStyle}>Chain of Thought</span>
                    {log.transcript.map((step, idx) => (
                      <div key={idx} style={thoughtStepStyle}>
                        <span style={stepNumStyle}>
                          {String(step.step).padStart(2, "0")}
                        </span>
                        <span style={stepThoughtStyle}>{step.thought}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Styles
const containerStyle: React.CSSProperties = {
  width: "100%",
};

const loadingStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  padding: "40px 0",
};

const spinnerStyle: React.CSSProperties = {
  width: "32px",
  height: "32px",
  border: "3px solid #333",
  borderTopColor: "#00ffcc",
  borderRadius: "50%",
  animation: "spin 1s linear infinite",
};

const emptyStyle: React.CSSProperties = {
  padding: "24px 16px",
  textAlign: "center",
  color: "#475569",
  fontSize: "13px",
  fontFamily: "'JetBrains Mono', monospace",
};

const emptyIconStyle: React.CSSProperties = {
  fontSize: "24px",
  marginBottom: "8px",
  display: "block",
  opacity: 0.5,
};

const timelineStyle: React.CSSProperties = {
  borderLeft: "1px solid #1a1a1a",
  marginLeft: "12px",
  paddingLeft: "24px",
};

const entryStyle: React.CSSProperties = {
  position: "relative",
  marginBottom: "4px",
};

const dotStyle: React.CSSProperties = {
  position: "absolute",
  left: "-29px",
  top: "12px",
  width: "8px",
  height: "8px",
  borderRadius: "50%",
};

const glowingDotStyle: React.CSSProperties = {
  background: "#00ffcc",
  boxShadow: "0 0 6px rgba(0, 255, 204, 0.4)",
};

const dimDotStyle: React.CSSProperties = {
  background: "#333",
  boxShadow: "none",
};

const cardStyle: React.CSSProperties = {
  background: "#0d0d0d",
  border: "1px solid #1a1a1a",
  borderRadius: "6px",
  overflow: "hidden",
  transition: "border-color 0.2s",
};

const hasReasoningCardStyle: React.CSSProperties = {
  borderColor: "rgba(0, 255, 204, 0.13)",
};

const headerStyle: React.CSSProperties = {
  padding: "12px 16px",
  display: "flex",
  alignItems: "center",
  gap: "12px",
  cursor: "default",
};

const badgeStyle: React.CSSProperties = {
  fontSize: "10px",
  textTransform: "uppercase",
  letterSpacing: "1px",
  padding: "2px 8px",
  borderRadius: "3px",
  fontWeight: "bold",
  flexShrink: 0,
  fontFamily: "'JetBrains Mono', monospace",
};

const agentNameStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "#00ffcc",
  flexShrink: 0,
  fontFamily: "'JetBrains Mono', monospace",
};

const expandBtnStyle: React.CSSProperties = {
  background: "none",
  border: "1px solid #222",
  color: "#00ffcc",
  fontSize: "10px",
  padding: "3px 8px",
  borderRadius: "3px",
  cursor: "pointer",
  fontFamily: "'JetBrains Mono', monospace",
  letterSpacing: "0.5px",
  transition: "all 0.2s",
  flexShrink: 0,
};

const timestampStyle: React.CSSProperties = {
  fontSize: "10px",
  color: "#444",
  marginLeft: "auto",
  flexShrink: 0,
  fontFamily: "'JetBrains Mono', monospace",
};

const reasonSummaryStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "#999",
  padding: "0 16px 12px 16px",
  lineHeight: 1.5,
  borderTop: "1px solid #111",
  paddingTop: "10px",
  fontStyle: "italic",
  fontFamily: "'JetBrains Mono', monospace",
};

const noReasoningStyle: React.CSSProperties = {
  fontSize: "11px",
  color: "#333",
  fontStyle: "italic",
  padding: "0 16px 12px",
  fontFamily: "'JetBrains Mono', monospace",
};

const transcriptPanelStyle: React.CSSProperties = {
  borderTop: "1px solid #111",
  padding: "12px 16px",
  animation: "fadeIn 0.2s ease",
  fontFamily: "'JetBrains Mono', monospace",
};

const transcriptLabelStyle: React.CSSProperties = {
  fontSize: "10px",
  textTransform: "uppercase",
  letterSpacing: "2px",
  color: "#00ffcc",
  marginBottom: "12px",
  display: "block",
};

const thoughtStepStyle: React.CSSProperties = {
  display: "flex",
  gap: "12px",
  marginBottom: "8px",
  alignItems: "flex-start",
};

const stepNumStyle: React.CSSProperties = {
  fontSize: "10px",
  color: "#333",
  minWidth: "24px",
  textAlign: "right",
  paddingTop: "1px",
};

const stepThoughtStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "#888",
  lineHeight: 1.5,
};

// Inject keyframe animation
const styleSheet = document.createElement("style");
styleSheet.textContent = `
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;
if (!document.head.querySelector('style[data-agent-reasoning-timeline]')) {
  styleSheet.setAttribute("data-agent-reasoning-timeline", "true");
  document.head.appendChild(styleSheet);
}
