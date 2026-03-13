import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// Projects table
export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

// Agents table
export const agents = sqliteTable("agents", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  lastSeenAt: integer("last_seen_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

// Tasks table
export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  agentId: text("agent_id").references(() => agents.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  description: text("description"),
  taskType: text("task_type").notNull(),
  requiresApproval: integer("requires_approval", { mode: "boolean" })
    .notNull()
    .default(false),
  status: text("status").notNull().default("backlog"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  claimedAt: integer("claimed_at", { mode: "timestamp" }),
});

// Task logs table
// Note: task_id is not a foreign key to allow logs to persist after task deletion
// This is important for audit trails
export const taskLogs = sqliteTable("task_logs", {
  id: text("id").primaryKey(),
  taskId: text("task_id"), // Not a foreign key - allows logs to persist after task deletion
  agentId: text("agent_id").references(() => agents.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  details: text("details"), // JSON stored as text
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

// Approval requests table
export const approvalRequests = sqliteTable("approval_requests", {
  id: text("id").primaryKey(),
  taskId: text("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  agentId: text("agent_id")
    .notNull()
    .references(() => agents.id, { onDelete: "cascade" }),
  actionRequested: text("action_requested").notNull(),
  status: text("status").notNull().default("pending"),
  reviewedBy: text("reviewed_by").references(() => agents.id, { onDelete: "set null" }),
  reviewedAt: integer("reviewed_at", { mode: "timestamp" }),
  notes: text("notes"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

// Export types
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type Agent = typeof agents.$inferSelect;
export type NewAgent = typeof agents.$inferInsert;
export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
export type TaskLog = typeof taskLogs.$inferSelect;
export type NewTaskLog = typeof taskLogs.$inferInsert;
export type ApprovalRequest = typeof approvalRequests.$inferSelect;
export type NewApprovalRequest = typeof approvalRequests.$inferInsert;
