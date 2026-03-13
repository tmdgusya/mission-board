import { z } from "zod";

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Valid approval statuses
export const APPROVAL_STATUSES = [
  "pending",
  "approved",
  "denied",
] as const;

// Schema for creating an approval request
export const createApprovalRequestSchema = z.object({
  taskId: z.string().regex(UUID_REGEX, "Invalid task ID format"),
  agentId: z.string().regex(UUID_REGEX, "Invalid agent ID format"),
  actionRequested: z.string().min(1, "Action requested is required"),
});

// Schema for approval ID parameter
export const approvalIdSchema = z.string().regex(UUID_REGEX, "Invalid UUID format");

// Type exports
export type CreateApprovalRequestInput = z.infer<typeof createApprovalRequestSchema>;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];
