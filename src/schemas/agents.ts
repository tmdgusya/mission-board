import { z } from "zod";

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Schema for creating/registering an agent
export const createAgentSchema = z.object({
  id: z.string().regex(UUID_REGEX, "Invalid UUID format"),
  name: z.string().min(1, "Name is required"),
});

// Schema for updating an agent
export const updateAgentSchema = z.object({
  name: z.string().min(1, "Name is required"),
});

// Schema for agent ID parameter
export const agentIdSchema = z.string().regex(UUID_REGEX, "Invalid UUID format");

// Type exports
export type CreateAgentInput = z.infer<typeof createAgentSchema>;
export type UpdateAgentInput = z.infer<typeof updateAgentSchema>;
