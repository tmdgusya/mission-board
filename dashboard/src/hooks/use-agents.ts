import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../lib/api-client";
import { POLL_INTERVAL } from "../lib/query-client";

export function useAgents() {
  return useQuery({
    queryKey: ["agents"],
    queryFn: () => apiClient.listAgents(),
    refetchInterval: POLL_INTERVAL,
  });
}

export function useAgent(id: string) {
  return useQuery({
    queryKey: ["agents", id],
    queryFn: () => apiClient.getAgent(id),
    refetchInterval: POLL_INTERVAL,
    enabled: !!id,
  });
}
