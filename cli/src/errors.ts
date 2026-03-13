/**
 * Shared error formatting and global error handling for Mission Board CLI.
 *
 * This module provides:
 * - Unified error formatting for API, network, and unexpected errors
 * - Timeout handling for API requests
 * - Global unhandled error/rejection handlers
 */
import chalk from "chalk";

/**
 * Shape of an error from the API client that includes response metadata.
 */
export interface ApiErrorLike {
  response?: {
    status: number;
    data: {
      error: string;
      details?: unknown;
      currentOwner?: { agentId: string; claimedAt: string | null };
    };
  };
}

/**
 * Classify an unknown error into a specific error type.
 */
type ErrorCategory =
  | "network_unreachable"
  | "timeout"
  | "api_error"
  | "generic";

function classifyError(error: unknown): ErrorCategory {
  if (error && typeof error === "object" && "response" in error) {
    return "api_error";
  }

  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (
      msg.includes("econnrefused") ||
      msg.includes("econnreset") ||
      msg.includes("fetch failed") ||
      msg.includes("unable to connect") ||
      msg.includes("network") ||
      msg.includes("socket hang up") ||
      msg.includes("enotfound")
    ) {
      return "network_unreachable";
    }
    if (
      msg.includes("timed out") ||
      msg.includes("timeout") ||
      msg.includes("abort") ||
      msg.includes("deadline")
    ) {
      return "timeout";
    }
    // Also classify AbortError from fetch timeout
    if (error.name === "AbortError") {
      return "timeout";
    }
  }

  return "generic";
}

/**
 * Format an API response error (HTTP 4xx/5xx).
 */
function formatApiError(error: ApiErrorLike): string {
  if (!error.response) {
    return chalk.red("Error: An unexpected API error occurred");
  }

  const { status, data } = error.response;

  switch (status) {
    case 400: {
      if (data.details && Array.isArray(data.details)) {
        const details = data.details
          .map((d: { message?: string }) => d.message || String(d))
          .join(", ");
        return chalk.red(`Error (400): Validation failed - ${details}`);
      }
      return chalk.red(`Error (400): ${data.error || "Invalid request"}`);
    }

    case 404:
      return chalk.red(`Error (404): ${data.error || "Not found"}`);

    case 409: {
      if (
        "currentOwner" in data &&
        data.currentOwner
      ) {
        const owner = data.currentOwner as { agentId: string };
        return chalk.red(
          `Error (409): Task is already claimed by another agent (${owner.agentId})`
        );
      }
      return chalk.red(`Error (409): ${data.error || "Conflict"}`);
    }

    case 500:
      return chalk.red(
        `Error (500): Server error - ${data.error || "Please try again later"}`
      );

    default:
      return chalk.red(`Error (${status}): ${data.error || "Unexpected error"}`);
  }
}

/**
 * Format a network connectivity error (server unreachable).
 */
function formatNetworkError(): string {
  const lines: string[] = [
    chalk.red("Error: Unable to connect to the Mission Board API."),
    "",
    chalk.gray("Possible causes:"),
    chalk.gray("  • The API server is not running"),
    chalk.gray("  • The server address is incorrect (check your config)"),
    chalk.gray("  • Network connectivity issues"),
    "",
    chalk.gray("Try:"),
    chalk.gray("  1. Start the API: bun run dev:api"),
    chalk.gray("  2. Check config: mission config"),
  ];
  return lines.join("\n");
}

/**
 * Format a timeout error.
 */
function formatTimeoutError(): string {
  const lines: string[] = [
    chalk.red("Error: The request to the Mission Board API timed out."),
    "",
    chalk.gray("Suggestions:"),
    chalk.gray("  • Check if the server is responding: curl http://localhost:3200/api/health"),
    chalk.gray("  • The server may be under heavy load — try again"),
    chalk.gray("  • Check your network connection"),
  ];
  return lines.join("\n");
}

/**
 * Format a generic/unexpected error.
 */
function formatGenericError(error: unknown): string {
  if (error instanceof Error) {
    return chalk.red(`Error: ${error.message}`);
  }
  return chalk.red("Error: An unexpected error occurred");
}

/**
 * Format any error into a user-friendly, colored message.
 *
 * This is the single entry-point for error display across the entire CLI.
 * Individual commands should use this function instead of duplicating
 * error-formatting logic.
 */
export function formatError(error: unknown): string {
  const category = classifyError(error);

  switch (category) {
    case "api_error":
      return formatApiError(error as ApiErrorLike);
    case "network_unreachable":
      return formatNetworkError();
    case "timeout":
      return formatTimeoutError();
    case "generic":
      return formatGenericError(error);
  }
}

/**
 * Default timeout (in ms) for API requests.
 */
export const API_TIMEOUT_MS = 30_000;

/**
 * Wrap a fetch-like call with an AbortController timeout.
 *
 * Usage:
 * ```ts
 * const response = await withTimeout(fetch(url, opts), 10_000);
 * ```
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number = API_TIMEOUT_MS
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);

  try {
    return await Promise.race([promise, new Promise<never>((_, reject) => {
      controller.signal.addEventListener("abort", () => {
        reject(new Error(`Request timed out after ${ms / 1000}s`));
      });
    })]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Register global error handlers that print a formatted error and exit with code 1.
 *
 * Call this once at CLI startup.
 */
export function registerGlobalErrorHandlers(): void {
  process.on("uncaughtException", (error) => {
    console.error(formatError(error));
    process.exit(1);
  });

  process.on("unhandledRejection", (reason) => {
    console.error(formatError(reason));
    process.exit(1);
  });
}
