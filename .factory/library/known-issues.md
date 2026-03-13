# Known Pre-Existing Issues

These issues are noted for awareness but do not block mission progress.

## Known Issues (Do Not Fix)

- **ENOENT unhandled errors in CLI tests**: The CLI config module reads `~/.mission-board/config.json` on import, which can trigger unhandled rejection before test setup. This causes `bun test` to exit with code 1 even when all 240 tests pass. Root cause: config module needs lazy initialization or try/catch at import scope. Reported by scrutiny-validator in agent-cli milestone.

- **Lint not configured**: `bun run lint` outputs "Linting not configured yet" — no actual linting is performed. This is a placeholder that should be replaced with an ESLint config in a follow-up.

- **Toast tests fail under bun test**: 3 Toast component tests (renders toast messages, renders nothing when no messages, can be dismissed manually) fail under `bun test` because `@testing-library/react` requires a DOM. They pass under `bunx vitest run --config dashboard/vitest.config.ts` (25/25 pass). This is expected behavior — dashboard tests must be run with vitest, not bun test.

- **Vitest 4.x + bun:test alias**: Vitest 4.x cannot bundle `bun:test` natively. The vitest config includes a resolve alias mapping `bun:test` to `dashboard/src/__mocks__/bun-test.ts` which re-exports vitest globals. This is needed because some dependencies (e.g., @testing-library/jest-dom) reference `bun:test` in their type declarations.
