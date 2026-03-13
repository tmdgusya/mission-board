import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../lib/api-client";

export function useApproveRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      reviewedBy,
    }: {
      id: string;
      reviewedBy: string;
    }) => {
      return apiClient.approveRequest(id, reviewedBy);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["approvals"] });
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}

export function useDenyRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      reviewedBy,
      notes,
    }: {
      id: string;
      reviewedBy: string;
      notes: string;
    }) => {
      return apiClient.denyRequest(id, reviewedBy, notes);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["approvals"] });
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}
