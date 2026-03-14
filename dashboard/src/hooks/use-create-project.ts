import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../lib/api-client";

export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { name: string; description?: string }) => {
      return apiClient.createProject(data);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}
