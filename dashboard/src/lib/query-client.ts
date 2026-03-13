import { QueryClient } from "@tanstack/react-query";

export const POLL_INTERVAL = 5000; // 5 seconds

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchInterval: POLL_INTERVAL,
      retry: 2,
      staleTime: 3000,
      refetchIntervalInBackground: false,
    },
  },
});
