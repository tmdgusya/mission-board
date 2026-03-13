import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../lib/api-client";

export function useAgents() {
  return useQuery({
    queryKey: ["agents"],
    queryFn: () => apiClient.listAgents(),
  });
}

export function useAgent(id: string) {
  return useQuery({
    queryKey: ["agents", id],
    queryFn: () => apiClient.getAgent(id),
    enabled: !!id,
  });
}
