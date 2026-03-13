import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../lib/api-client";

export function useApiHealth() {
  return useQuery({
    queryKey: ["health"],
    queryFn: () => apiClient.healthCheck(),
    refetchInterval: 5000,
    retry: 1,
  });
}
