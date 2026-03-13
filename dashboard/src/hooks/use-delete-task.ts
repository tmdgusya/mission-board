import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../lib/api-client";

export function useDeleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      return apiClient.deleteTask(id);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
      void queryClient.invalidateQueries({ queryKey: ["logs"] });
    },
  });
}
