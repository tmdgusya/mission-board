import { z } from "zod";

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Schema for creating a comment
export const createCommentSchema = z.object({
  agentId: z.string().regex(UUID_REGEX, "Invalid agent ID format"),
  content: z.string().min(1, "Content is required"),
});

// Schema for task ID parameter
export const commentTaskIdSchema = z.string().regex(UUID_REGEX, "Invalid UUID format");

// Type exports
export type CreateCommentInput = z.infer<typeof createCommentSchema>;
