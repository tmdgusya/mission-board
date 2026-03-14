import React, { useEffect, useState } from "react";

interface ToastMessage {
  id: string;
  message: string;
  type: "error" | "success" | "info";
}

interface ToastProps {
  messages: ToastMessage[];
  onDismiss: (id: string) => void;
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: ToastMessage;
  onDismiss: (id: string) => void;
}): React.ReactElement {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Trigger animation
    requestAnimationFrame(() => setIsVisible(true));

    // Auto-dismiss after 4 seconds
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => onDismiss(toast.id), 300);
    }, 4000);

    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const accentColor =
    toast.type === "error"
      ? "#ff3333"
      : toast.type === "success"
        ? "#00ff66"
        : "#00ffcc";

  return (
    <div
      role="alert"
      style={{
        backgroundColor: "#0a0a0a",
        color: "#c0c0c0",
        padding: "12px 16px",
        borderRadius: "4px",
        fontSize: "14px",
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
        boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
        borderLeft: `3px solid ${accentColor}`,
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? "translateX(0)" : "translateX(20px)",
        transition: "opacity 0.3s, transform 0.3s",
        maxWidth: "400px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "12px",
      }}
    >
      <span>{toast.message}</span>
      <button
        onClick={() => {
          setIsVisible(false);
          setTimeout(() => onDismiss(toast.id), 300);
        }}
        style={{
          background: "none",
          border: "none",
          color: "#555555",
          cursor: "pointer",
          fontSize: "16px",
          padding: "0 4px",
          lineHeight: 1,
        }}
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}

export function Toast({ messages, onDismiss }: ToastProps): React.ReactElement | null {
  if (messages.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: "16px",
        right: "16px",
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        gap: "8px",
      }}
    >
      {messages.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

export function useToast() {
  const [messages, setMessages] = useState<ToastMessage[]>([]);

  const addToast = (message: string, type: ToastMessage["type"] = "error") => {
    const id = crypto.randomUUID();
    setMessages((prev) => [...prev, { id, message, type }]);
  };

  const dismissToast = (id: string) => {
    setMessages((prev) => prev.filter((t) => t.id !== id));
  };

  return { messages, addToast, dismissToast };
}
