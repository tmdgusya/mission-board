import { Hono } from "hono";
import { cors } from "hono/cors";
import { projectsRouter } from "./api/routes/projects";
import { tasksRouter } from "./api/routes/tasks";
import { agentsRouter } from "./api/routes/agents";
import { logsRouter } from "./api/routes/logs";
import { approvalsRouter } from "./api/routes/approvals";
import { analyticsRouter } from "./api/routes/analytics";

const app = new Hono();

// Enable CORS for dashboard
app.use(
  cors({
    origin: ["http://localhost:3201", "http://127.0.0.1:3201"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  })
);

// Health check endpoint
app.get("/api/health", (c) => {
  return c.json({ status: "ok" });
});

// Mount project routes
app.route("/api/projects", projectsRouter);

// Mount task routes
app.route("/api/tasks", tasksRouter);

// Mount agent routes
app.route("/api/agents", agentsRouter);

// Mount logs routes
app.route("/api/logs", logsRouter);

// Mount approval routes
app.route("/api/approvals", approvalsRouter);

// Mount analytics routes
app.route("/api/analytics", analyticsRouter);

// Global error handler
app.onError((err, c) => {
  console.error("Unhandled error:", err);
  return c.json(
    {
      error: "Internal server error",
      message: err.message,
    },
    500
  );
});

// 404 handler
app.notFound((c) => {
  return c.json({ error: "Not found" }, 404);
});

// Start server
const port = process.env.PORT ? parseInt(process.env.PORT) : 3200;

console.log(`Starting server on port ${port}...`);

// Start server
Bun.serve({
  port,
  fetch: app.fetch,
});

console.log(`Server running at http://localhost:${port}`);

export { app };
