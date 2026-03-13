import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../lib/api-client";
import { POLL_INTERVAL } from "../lib/query-client";

export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: () => apiClient.listProjects(),
    refetchInterval: POLL_INTERVAL,
  });
}
