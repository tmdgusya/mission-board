import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../lib/api-client";
import { POLL_INTERVAL } from "../lib/query-client";
import type { ApprovalQueryParams } from "../lib/api-client";

export function useApprovals(params?: ApprovalQueryParams) {
  return useQuery({
    queryKey: ["approvals", params],
    queryFn: () => apiClient.listApprovals(params),
    refetchInterval: POLL_INTERVAL,
  });
}
