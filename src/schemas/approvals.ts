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

// Schema for approving an approval request
export const approveRequestSchema = z.object({
  reviewedBy: z.string().regex(UUID_REGEX, "Invalid reviewer ID format"),
});

// Schema for denying an approval request
export const denyRequestSchema = z.object({
  reviewedBy: z.string().regex(UUID_REGEX, "Invalid reviewer ID format"),
  notes: z.string().min(1, "Notes are required when denying an approval request"),
});

// Type exports
export type CreateApprovalRequestInput = z.infer<typeof createApprovalRequestSchema>;
export type ApproveRequestInput = z.infer<typeof approveRequestSchema>;
export type DenyRequestInput = z.infer<typeof denyRequestSchema>;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];
