---
name: backend-worker
description: Implements Hono API endpoints, database operations, and business logic with Bun/SQLite
---

# Backend Worker

NOTE: Startup and cleanup are handled by `worker-base`. This skill defines the WORK PROCEDURE.

## When to Use This Skill

Use for features involving:
- API endpoint implementation (REST routes with Hono)
- Database schema changes (migrations, tables)
- Business logic and validation
- Data models and repositories
- Backend testing

## Work Procedure

1. **Write tests first (RED)** - Create test file in `tests/` or alongside source
   - Use Bun's built-in test runner: `bun test`
   - Cover: happy path, validation errors, edge cases, database operations
   - Run `bun test --watch` to verify tests FAIL before implementing

2. **Implement feature (GREEN)** - Make tests pass
   - Follow existing patterns in `src/` directory
   - Use Drizzle ORM for database operations
   - Validate inputs with Zod schemas
   - Add proper error handling and status codes

3. **Manual verification**
   - Start server: `bun run dev`
   - Test with `curl` or HTTP client
   - Verify database state with SQLite queries
   - Check logs for errors

4. **Run validators**
   - `bun run typecheck` - TypeScript validation
   - `bun run lint` - Code style
   - `bun test` - All tests must pass

5. **Document API changes**
   - Update API documentation if adding new endpoints
   - Include request/response examples

## Example Handoff

```json
{
  "salientSummary": "Implemented POST /api/tasks endpoint with Zod validation, created tasks table with Drizzle, added 5 tests covering creation, validation, and duplicate prevention.",
  "whatWasImplemented": "POST /api/tasks endpoint that accepts agent_id, project_id, title, description, task_type. Creates task in 'backlog' status. Returns 201 with created task. Returns 400 for invalid input. Returns 404 for non-existent project. Returns 409 for duplicate task title in same project. Added tasks table migration with indexes on project_id and status.",
  "whatWasLeftUndone": "",
  "verification": {
    "commandsRun": [
      {
        "command": "bun test tests/tasks.test.ts",
        "exitCode": 0,
        "observation": "5 tests passing: creates task, validates required fields, rejects invalid status, prevents duplicates, returns 404 for missing project"
      },
      {
        "command": "bun run typecheck",
        "exitCode": 0,
        "observation": "No type errors"
      },
      {
        "command": "bun run dev & sleep 2 && curl -X POST http://localhost:3200/api/tasks -H 'Content-Type: application/json' -d '{\"agent_id\":\"agent-1\",\"project_id\":\"proj-1\",\"title\":\"Test task\",\"task_type\":\"implementation\"}'",
        "exitCode": 0,
        "observation": "Returns 201 with {id, title, status: 'backlog', created_at, ...}"
      }
    ],
    "interactiveChecks": []
  },
  "tests": {
    "added": [
      {
        "file": "tests/tasks.test.ts",
        "cases": [
          {"name": "creates task with valid data", "verifies": "POST /api/tasks returns 201"},
          {"name": "rejects missing required fields", "verifies": "400 validation"},
          {"name": "rejects invalid status", "verifies": "400 for bad enum"},
          {"name": "prevents duplicate titles in project", "verifies": "409 conflict"},
          {"name": "returns 404 for missing project", "verifies": "Project existence check"}
        ]
      }
    ]
  },
  "discoveredIssues": []
}
```

## When to Return to Orchestrator

- Database migration conflicts with existing schema
- API design conflicts with existing endpoints
- Missing dependencies that cannot be installed
- Unclear requirements about business logic
