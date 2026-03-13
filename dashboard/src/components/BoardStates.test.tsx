import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  LoadingState,
  ErrorState,
  EmptyState,
} from "./BoardStates";

// =============================================
// LoadingState tests
// =============================================

describe("LoadingState", () => {
  it("renders with default message", () => {
    render(<LoadingState />);
    expect(screen.getByTestId("loading-state")).toBeInTheDocument();
    expect(screen.getByText("Loading board...")).toBeInTheDocument();
  });

  it("renders with custom message", () => {
    render(<LoadingState message="Fetching tasks..." />);
    expect(screen.getByText("Fetching tasks...")).toBeInTheDocument();
  });

  it("has role='status' for accessibility", () => {
    render(<LoadingState />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("has aria-live='polite' for screen readers", () => {
    render(<LoadingState />);
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
  });

  it("contains a spinner element", () => {
    const { container } = render(<LoadingState />);
    const spinner = container.querySelector(".board-spinner");
    expect(spinner).toBeInTheDocument();
  });

  it("renders aria-label matching message", () => {
    render(<LoadingState message="Loading board..." />);
    expect(screen.getByRole("status")).toHaveAttribute(
      "aria-label",
      "Loading board..."
    );
  });
});

// =============================================
// ErrorState tests
// =============================================

describe("ErrorState", () => {
  it("renders with default error message", () => {
    render(<ErrorState />);
    expect(screen.getByTestId("error-state")).toBeInTheDocument();
    expect(screen.getByText("Connection Error")).toBeInTheDocument();
  });

  it("renders with custom message", () => {
    render(<ErrorState message="Network Failure" />);
    expect(screen.getByText("Network Failure")).toBeInTheDocument();
  });

  it("renders with custom details", () => {
    render(<ErrorState details="Custom error details here." />);
    expect(screen.getByText("Custom error details here.")).toBeInTheDocument();
  });

  it("has role='alert' for accessibility", () => {
    render(<ErrorState />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("has aria-live='assertive' for screen readers", () => {
    render(<ErrorState />);
    expect(screen.getByRole("alert")).toHaveAttribute("aria-live", "assertive");
  });

  it("renders retry button when onRetry is provided", () => {
    const onRetry = vi.fn();
    render(<ErrorState onRetry={onRetry} />);
    expect(screen.getByTestId("retry-button")).toBeInTheDocument();
    expect(screen.getByText("Retry")).toBeInTheDocument();
  });

  it("does not render retry button when onRetry is not provided", () => {
    render(<ErrorState />);
    expect(screen.queryByTestId("retry-button")).not.toBeInTheDocument();
  });

  it("calls onRetry when retry button is clicked", async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    render(<ErrorState onRetry={onRetry} />);
    await user.click(screen.getByTestId("retry-button"));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("shows retry button disabled when isRetrying is true", () => {
    render(<ErrorState onRetry={() => {}} isRetrying={true} />);
    expect(screen.getByTestId("retry-button")).toBeDisabled();
  });

  it("shows 'Retrying...' text when isRetrying is true", () => {
    render(<ErrorState onRetry={() => {}} isRetrying={true} />);
    expect(screen.getByText("Retrying...")).toBeInTheDocument();
  });

  it("shows retry button aria-label for accessibility", () => {
    render(<ErrorState onRetry={() => {}} />);
    expect(screen.getByTestId("retry-button")).toHaveAttribute(
      "aria-label",
      "Retry connection"
    );
  });

  it("renders warning icon", () => {
    const { container } = render(<ErrorState />);
    const icon = container.querySelector('[aria-hidden="true"]');
    expect(icon).toBeInTheDocument();
    expect(icon?.textContent).toBe("⚠");
  });
});

// =============================================
// EmptyState tests
// =============================================

describe("EmptyState", () => {
  it("renders with data-testid", () => {
    render(<EmptyState />);
    expect(screen.getByTestId("empty-state")).toBeInTheDocument();
  });

  it("shows default message when no filters are active", () => {
    render(<EmptyState hasActiveFilters={false} />);
    expect(screen.getByText("No tasks yet")).toBeInTheDocument();
    expect(
      screen.getByText("Create your first task to get started with the Mission Board.")
    ).toBeInTheDocument();
  });

  it("shows filter-related message when filters are active", () => {
    render(<EmptyState hasActiveFilters={true} />);
    expect(screen.getByText("No matching tasks")).toBeInTheDocument();
    expect(
      screen.getByText(
        "No tasks match the current filters. Try adjusting or clearing your filters."
      )
    ).toBeInTheDocument();
  });

  it("shows clear filters button when filters are active and handler provided", () => {
    render(<EmptyState hasActiveFilters={true} onClearFilters={() => {}} />);
    expect(screen.getByTestId("clear-filters-button")).toBeInTheDocument();
    expect(screen.getByText("Clear Filters")).toBeInTheDocument();
  });

  it("does not show clear filters button when filters are not active", () => {
    render(<EmptyState hasActiveFilters={false} onClearFilters={() => {}} />);
    expect(screen.queryByTestId("clear-filters-button")).not.toBeInTheDocument();
  });

  it("does not show clear filters button when no handler provided", () => {
    render(<EmptyState hasActiveFilters={true} />);
    expect(screen.queryByTestId("clear-filters-button")).not.toBeInTheDocument();
  });

  it("calls onClearFilters when clear button is clicked", async () => {
    const onClearFilters = vi.fn();
    const user = userEvent.setup();
    render(
      <EmptyState hasActiveFilters={true} onClearFilters={onClearFilters} />
    );
    await user.click(screen.getByTestId("clear-filters-button"));
    expect(onClearFilters).toHaveBeenCalledTimes(1);
  });

  it("has role='status' for accessibility", () => {
    render(<EmptyState />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("has aria-live='polite' for screen readers", () => {
    render(<EmptyState />);
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
  });

  it("shows clipboard icon when no filters", () => {
    const { container } = render(<EmptyState hasActiveFilters={false} />);
    const icon = container.querySelector('[aria-hidden="true"]');
    expect(icon?.textContent).toBe("📋");
  });

  it("shows search icon when filters are active", () => {
    const { container } = render(<EmptyState hasActiveFilters={true} />);
    const icon = container.querySelector('[aria-hidden="true"]');
    expect(icon?.textContent).toBe("🔍");
  });

  it("clear filters button has correct aria-label", () => {
    render(<EmptyState hasActiveFilters={true} onClearFilters={() => {}} />);
    expect(screen.getByTestId("clear-filters-button")).toHaveAttribute(
      "aria-label",
      "Clear all filters"
    );
  });
});
