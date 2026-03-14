import React from "react";

interface AgentProgressBarProps {
  isActive: boolean;
}

const indeterminateKeyframes = `
@keyframes agent-indeterminate-1 {
  0% { left: -35%; width: 35%; }
  60% { left: 100%; width: 35%; }
  100% { left: 100%; width: 35%; }
}
@keyframes agent-indeterminate-2 {
  0% { left: -200%; width: 100%; }
  60% { left: 107%; width: 100%; }
  100% { left: 107%; width: 100%; }
}
`;

export function AgentProgressBar({ isActive }: AgentProgressBarProps): React.ReactElement | null {
  if (!isActive) return null;

  return (
    <>
      <style>{indeterminateKeyframes}</style>
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "3px",
          overflow: "hidden",
          zIndex: 10,
          backgroundColor: "rgba(0,255,66,0.08)",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            height: "100%",
            backgroundColor: "#00ff66",
            boxShadow: "0 0 8px rgba(0,255,66,0.6), 0 0 20px rgba(0,255,66,0.3)",
            borderRadius: "2px",
            animation: "agent-indeterminate-1 2s cubic-bezier(0.65, 0.815, 0.735, 0.395) infinite",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 0,
            height: "100%",
            backgroundColor: "#00ff66",
            boxShadow: "0 0 8px rgba(0,255,66,0.6), 0 0 20px rgba(0,255,66,0.3)",
            borderRadius: "2px",
            animation: "agent-indeterminate-2 2s cubic-bezier(0.165, 0.84, 0.44, 1) 1.15s infinite",
          }}
        />
      </div>
    </>
  );
}
