import { z } from "zod";

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Schema for a single transcript step
const transcriptStepSchema = z.object({
  step: z.number().int().positive().max(100),
  thought: z.string().min(1).max(2000),
});

// Schema for agent reasoning
const reasoningSchema = z.object({
  reason: z.string().max(280).optional(),
  transcript: z.array(transcriptStepSchema).max(50).optional(),
}).strict();

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
}).merge(reasoningSchema);

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
