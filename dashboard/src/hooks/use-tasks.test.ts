import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const hooksDir = resolve(__dirname, "..", "hooks");

function readHook(name: string): string {
  return readFileSync(resolve(hooksDir, name), "utf-8");
}

// Test that the polling configuration is correct for real-time updates (VAL-DASH-007)

describe("Real-time Updates - Polling Configuration", () => {
  it("POLL_INTERVAL is set to 5000ms (5 seconds)", async () => {
    const { POLL_INTERVAL } = await import("../lib/query-client");
    expect(POLL_INTERVAL).toBe(5000);
  });

  it("QueryClient default refetchInterval is set to POLL_INTERVAL", async () => {
    const { queryClient, POLL_INTERVAL } = await import("../lib/query-client");
    const defaultOptions = queryClient.getDefaultOptions();
    expect(defaultOptions.queries?.refetchInterval).toBe(POLL_INTERVAL);
  });

  it("useTasks hook uses POLL_INTERVAL for refetchInterval", () => {
    const source = readHook("use-tasks.ts");
    expect(source).toContain("refetchInterval: POLL_INTERVAL");
    expect(source).toContain('import { POLL_INTERVAL } from "../lib/query-client"');
  });

  it("useTask (single) hook also uses POLL_INTERVAL", () => {
    const source = readHook("use-tasks.ts");
    // useTask should also have refetchInterval
    const occurrences = (source.match(/refetchInterval: POLL_INTERVAL/g) || []).length;
    expect(occurrences).toBeGreaterThanOrEqual(2);
  });

  it("useProjects hook uses POLL_INTERVAL for refetchInterval", () => {
    const source = readHook("use-projects.ts");
    expect(source).toContain("refetchInterval: POLL_INTERVAL");
    expect(source).toContain('import { POLL_INTERVAL } from "../lib/query-client"');
  });

  it("useAgents hook uses POLL_INTERVAL for refetchInterval", () => {
    const source = readHook("use-agents.ts");
    expect(source).toContain("refetchInterval: POLL_INTERVAL");
    expect(source).toContain('import { POLL_INTERVAL } from "../lib/query-client"');
  });

  it("useAgent (single) hook also uses POLL_INTERVAL", () => {
    const source = readHook("use-agents.ts");
    const occurrences = (source.match(/refetchInterval: POLL_INTERVAL/g) || []).length;
    expect(occurrences).toBeGreaterThanOrEqual(2);
  });

  it("useLogs hook uses POLL_INTERVAL for refetchInterval", () => {
    const source = readHook("use-logs.ts");
    expect(source).toContain("refetchInterval: POLL_INTERVAL");
    expect(source).toContain('import { POLL_INTERVAL } from "../lib/query-client"');
  });

  it("useApiHealth hook uses 5000ms refetchInterval", () => {
    const source = readHook("use-api-health.ts");
    expect(source).toContain("refetchInterval: 5000");
  });

  it("QueryClient staleTime is less than POLL_INTERVAL to ensure fresh data", async () => {
    const { queryClient, POLL_INTERVAL } = await import("../lib/query-client");
    const defaultOptions = queryClient.getDefaultOptions();
    expect(defaultOptions.queries?.staleTime).toBeLessThan(POLL_INTERVAL);
  });

  it("QueryClient retry is configured for resilience", async () => {
    const { queryClient } = await import("../lib/query-client");
    const defaultOptions = queryClient.getDefaultOptions();
    expect(defaultOptions.queries?.retry).toBeGreaterThanOrEqual(1);
  });
});
