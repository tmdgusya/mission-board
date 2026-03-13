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
- `DATABASE_PATH` - SQLite file path (default: ./data/mission-board.db)

## Setup Notes

1. Run `bun install` to install dependencies
2. Database created automatically on first run
3. No migrations needed for initial setup (Drizzle handles schema)
