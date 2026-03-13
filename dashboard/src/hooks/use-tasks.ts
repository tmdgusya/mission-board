import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../lib/api-client";
import { POLL_INTERVAL } from "../lib/query-client";
import type { TaskQueryParams } from "../lib/api-client";

export function useTasks(params?: TaskQueryParams) {
  return useQuery({
    queryKey: ["tasks", params],
    queryFn: () => apiClient.listTasks(params),
    refetchInterval: POLL_INTERVAL,
  });
}

export function useTask(id: string) {
  return useQuery({
    queryKey: ["tasks", id],
    queryFn: () => apiClient.getTask(id),
    refetchInterval: POLL_INTERVAL,
    enabled: !!id,
  });
}
