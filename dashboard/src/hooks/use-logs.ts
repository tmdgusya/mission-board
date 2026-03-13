import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../lib/api-client";
import { POLL_INTERVAL } from "../lib/query-client";
import type { LogQueryParams } from "../lib/api-client";

export function useLogs(params?: LogQueryParams) {
  return useQuery({
    queryKey: ["logs", params],
    queryFn: () => apiClient.listLogs(params),
    refetchInterval: POLL_INTERVAL,
  });
}
