import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../lib/api-client";
import { POLL_INTERVAL } from "../lib/query-client";
import type { AgentStat, TaskMetrics, TimeTrackingMetrics } from "../lib/api-client";

interface AnalyticsParams {
  projectId?: string;
}

export function useAgentStats(params?: AnalyticsParams) {
  return useQuery({
    queryKey: ["analytics", "agents", params],
    queryFn: () =>
      apiClient.getAgentStats(
        params?.projectId ? { project_id: params.projectId } : undefined
      ),
    refetchInterval: POLL_INTERVAL,
  });
}

export function useTaskMetrics(params?: AnalyticsParams) {
  return useQuery({
    queryKey: ["analytics", "tasks", params],
    queryFn: () =>
      apiClient.getTaskMetrics(
        params?.projectId ? { project_id: params.projectId } : undefined
      ),
    refetchInterval: POLL_INTERVAL,
  });
}

export function useTimeTrackingMetrics(params?: AnalyticsParams) {
  return useQuery({
    queryKey: ["analytics", "time-tracking", params],
    queryFn: () =>
      apiClient.getTimeTrackingMetrics(
        params?.projectId ? { project_id: params.projectId } : undefined
      ),
    refetchInterval: POLL_INTERVAL,
  });
}
