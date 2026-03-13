---
name: frontend-worker
description: Implements React dashboard components, state management, and UI features
---

# Frontend Worker

NOTE: Startup and cleanup are handled by `worker-base`. This skill defines the WORK PROCEDURE.

## When to Use This Skill

Use for features involving:
- React components and pages
- Dashboard UI implementation
- State management (React Query, Context)
- Real-time updates (WebSocket/polling)
- Frontend testing

## Work Procedure

1. **Write tests first (RED)** - Create test file with Vitest + Testing Library
   - Component rendering tests
   - User interaction tests
   - API integration tests (mocked)
   - Run `bun test` to verify tests FAIL

2. **Implement feature (GREEN)** - Make tests pass
   - Create components in `src/components/`
   - Use existing UI patterns and libraries
   - Fetch data from API using React Query
   - Handle loading/error states

3. **Manual verification with agent-browser**
   - Start both API and frontend: `bun run dev:all`
   - Use `agent-browser` to navigate and interact
   - Verify UI updates correctly
   - Check responsive design
   - Document each flow tested

4. **Run validators**
   - `bun run typecheck` - TypeScript validation
   - `bun run lint` - Code style
   - `bun test` - All tests must pass
   - `bun run build` - Production build succeeds

5. **Accessibility check**
   - Keyboard navigation works
   - Screen reader compatible
   - Color contrast acceptable

## Example Handoff

```json
{
  "salientSummary": "Implemented Kanban board component with drag-and-drop, real-time polling every 5s, and task cards showing title/status/agent. Added 8 component tests and verified all interactions with agent-browser.",
  "whatWasImplemented": "KanbanBoard component with columns for backlog, ready, in_progress, review, done, blocked. TaskCard component with drag handle. useTasks hook with React Query for data fetching and 5s polling. DragAndDropContext using dnd-kit library. Task updates on drop call PATCH /api/tasks/:id. Loading spinner and error state UI. Responsive layout for mobile.",
  "whatWasLeftUndone": "",
  "verification": {
    "commandsRun": [
      {
        "command": "bun test src/components/KanbanBoard.test.tsx",
        "exitCode": 0,
        "observation": "8 tests passing: renders columns, displays tasks, drag-and-drop updates status, loading state, error state, empty columns, responsive layout"
      },
      {
        "command": "bun run build",
        "exitCode": 0,
        "observation": "Production build succeeded, no errors"
      }
    ],
    "interactiveChecks": [
      {
        "action": "Started dev server, navigated to http://localhost:3201/board with agent-browser, verified columns rendered",
        "observed": "All 6 columns visible with correct headers"
      },
      {
        "action": "Created task via API, waited 5s for polling update",
        "observed": "New task appeared in backlog column automatically"
      },
      {
        "action": "Dragged task from backlog to in_progress",
        "observed": "Task moved visually, API call succeeded with status update, task remained in new position after page refresh"
      },
      {
        "action": "Resized browser to mobile width",
        "observed": "Layout switched to single-column scrollable view"
      }
    ]
  },
  "tests": {
    "added": [
      {
        "file": "src/components/KanbanBoard.test.tsx",
        "cases": [
          {"name": "renders all columns", "verifies": "6 status columns displayed"},
          {"name": "displays tasks in correct columns", "verifies": "Tasks grouped by status"},
          {"name": "drag-and-drop updates task status", "verifies": "PATCH API called on drop"},
          {"name": "shows loading state", "verifies": "Spinner during fetch"},
          {"name": "shows error state", "verifies": "Error message on API failure"},
          {"name": "handles empty columns", "verifies": "Empty state message"},
          {"name": "responsive layout", "verifies": "Mobile-friendly"},
          {"name": "polling updates tasks", "verifies": "New tasks appear without refresh"}
        ]
      }
    ]
  },
  "discoveredIssues": []
}
```

## When to Return to Orchestrator

- API endpoints not yet implemented
- Design conflicts with existing UI patterns
- Missing dependencies that cannot be installed
- Unclear UX requirements
