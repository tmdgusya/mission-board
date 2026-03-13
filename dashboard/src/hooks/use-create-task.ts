import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../lib/api-client";

export function useCreateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      title: string;
      projectId: string;
      agentId?: string;
      description?: string;
      taskType: string;
      requiresApproval?: boolean;
    }) => {
      return apiClient.createTask(data);
    },
    onSuccess: () => {
      // Invalidate the tasks query to trigger a refetch
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
      void queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}
