import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient, ApiError } from "../lib/api-client";

export function useUpdateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: { title?: string; description?: string; status?: string };
    }) => {
      return apiClient.updateTask(id, data);
    },
    onSuccess: () => {
      // Invalidate the tasks query to trigger a refetch
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}

export function useHandleApiError() {
  return (error: unknown): string => {
    if (error instanceof ApiError) {
      return error.message;
    }
    if (error instanceof Error) {
      return error.message;
    }
    return "An unexpected error occurred";
  };
}
