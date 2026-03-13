import React, { useState, useMemo } from "react";
import { useTasks } from "../hooks/use-tasks";
import { KanbanBoard } from "./KanbanBoard";
import {
  Filters,
  DEFAULT_FILTERS,
  buildApiParams,
  applyClientFilters,
  type FilterState,
} from "./Filters";

export function DashboardContent(): React.ReactElement {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const apiParams = useMemo(() => buildApiParams(filters), [filters]);
  const {
    data: tasks = [],
    isLoading,
    error: tasksError,
    refetch: refetchTasks,
  } = useTasks(apiParams);

  const filteredTasks = useMemo(
    () => applyClientFilters(tasks, filters),
    [tasks, filters]
  );

  return (
    <div style={{ padding: "24px", maxWidth: "100%" }}>
      <Filters
        filters={filters}
        onFiltersChange={setFilters}
        tasks={filteredTasks}
      />
      <KanbanBoard
        tasks={filteredTasks}
        isLoading={isLoading}
        error={tasksError}
        onRetry={refetchTasks}
      />
    </div>
  );
}
