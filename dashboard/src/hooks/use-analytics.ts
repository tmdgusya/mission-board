import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../lib/api-client";
import { POLL_INTERVAL } from "../lib/query-client";
import type { AgentStat, TaskMetrics, TimeTrackingMetrics, VelocityDataPoint } from "../lib/api-client";

interface AnalyticsParams {
  projectId?: string;
  dateFrom?: string;
  dateTo?: string;
}

function buildParams(params?: AnalyticsParams) {
  const result: { project_id?: string; date_from?: string; date_to?: string } = {};
  if (params?.projectId) result.project_id = params.projectId;
  if (params?.dateFrom) result.date_from = params.dateFrom;
  if (params?.dateTo) result.date_to = params.dateTo;
  return Object.keys(result).length > 0 ? result : undefined;
}

export function useAgentStats(params?: AnalyticsParams) {
  return useQuery({
    queryKey: ["analytics", "agents", params],
    queryFn: () => apiClient.getAgentStats(buildParams(params)),
    refetchInterval: POLL_INTERVAL,
  });
}

export function useTaskMetrics(params?: AnalyticsParams) {
  return useQuery({
    queryKey: ["analytics", "tasks", params],
    queryFn: () => apiClient.getTaskMetrics(buildParams(params)),
    refetchInterval: POLL_INTERVAL,
  });
}

export function useTimeTrackingMetrics(params?: AnalyticsParams) {
  return useQuery({
    queryKey: ["analytics", "time-tracking", params],
    queryFn: () => apiClient.getTimeTrackingMetrics(buildParams(params)),
    refetchInterval: POLL_INTERVAL,
  });
}

export function useVelocity(params?: AnalyticsParams) {
  return useQuery({
    queryKey: ["analytics", "velocity", params],
    queryFn: () => apiClient.getVelocity(buildParams(params)),
    refetchInterval: POLL_INTERVAL,
  });
}
