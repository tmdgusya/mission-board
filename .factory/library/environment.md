# Environment

Environment variables, external dependencies, and setup notes.

**What belongs here:** Required env vars, external API keys/services, dependency quirks, platform-specific notes.
**What does NOT belong here:** Service ports/commands (use `.factory/services.yaml`).

---

## Platform

- OS: Linux (WSL2)
- Shell: bash
- Runtime: Bun 1.3.10

## Dependencies

All managed via Bun's package manager (bun install).

### Runtime Dependencies
- hono - Fast web framework
- drizzle-orm - TypeScript ORM for SQLite
- better-sqlite3 - SQLite bindings
- zod - Schema validation
- react - UI framework
- react-dom - React DOM
- @tanstack/react-query - Data fetching
- commander - CLI framework
- chalk - Terminal colors

### Dev Dependencies
- typescript - Type checking
- vitest - Testing framework
- @testing-library/react - Component testing
- drizzle-kit - Database migrations

## External Services

None required. SQLite runs embedded.

## Environment Variables

No external env vars required. Application uses:
- `PORT` - API server port (default: 3200)
- `PORT` - Dashboard port (default: 3201, set via `bun run dev:dashboard`)
- `DATABASE_PATH` - SQLite file path (default: ./data/mission-board.db)
- `VITE_API_URL` - Dashboard API base URL (default: http://localhost:3200)

## Dashboard

- Uses **Bun.serve() with HTML imports** (NOT Vite). `dashboard/server.ts` serves `index.html` which imports `src/main.tsx`.
- Hot reload is built-in via Bun's development mode (`hmr: true`).
- Dashboard has its own `tsconfig.json` with DOM lib included.
- Run with: `bun run dev:dashboard` (sets PORT=3201)
- React Query configured with 5s polling interval (`POLL_INTERVAL` in `dashboard/src/lib/query-client.ts`)
- API client singleton at `dashboard/src/lib/api-client.ts` (configurable base URL via `VITE_API_URL`)
- Root tsconfig excludes dashboard files (separate typecheck needed: `cd dashboard && bunx tsc --noEmit`)

### Dashboard - IMPORTANT NOTES

- **Do NOT use `import.meta.env`** - Bun's HTML imports don't support Vite-style env vars. Use `process.env` instead. Example: `process.env?.VITE_API_URL || "http://localhost:3200"`
- **API returns camelCase** - The API server returns camelCase field names (e.g., `taskType`, `projectId`, `agentId`), NOT snake_case. The `api-client.ts` types must match.
- **Bun test + Testing Library** - `bun test` does NOT provide a DOM environment by default. Testing Library (`@testing-library/react`) requires DOM and will fail with `ReferenceError: document is not defined`. For dashboard tests, use pure logic tests (status transitions, data grouping) without DOM rendering.
- **Drag-and-drop** - Uses `@dnd-kit/core` v6 with `useDraggable`/`useDroppable` hooks. Column droppable IDs follow the pattern `column-{status}`.

## Setup Notes

1. Run `bun install` to install dependencies
2. Database created automatically on first run
3. No migrations needed for initial setup (Drizzle handles schema)
