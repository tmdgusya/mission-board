# Agent Reasoning Monitoring

**Date:** 2026-03-14
**Status:** Approved
**Scope:** v1 — View-only agent decision transparency

## Problem

Mission Board tracks *what* agents do (task_logs: claim, update, release) but not *why* they do it. Managers operating the system need to understand agent decision-making to trust and direct the AI workforce effectively. The Palantir-inspired dashboard aesthetic demands a surveillance-grade monitoring experience.

## Solution

Extend the existing task_logs audit trail to capture agent reasoning alongside every action. Each log entry can carry a short summary (`reason`) and a structured chain-of-thought (`transcript`). The dashboard renders these as a timeline with expandable entries in the TaskDetail view.

## Architecture

### Data Model

Add two nullable columns to `task_logs`:

```
task_logs (altered)
├── reason      TEXT     — short summary, max 280 chars, NULL by default
└── transcript  TEXT     — JSON array of reasoning steps, NULL by default
```

Semantic distinction: `details` captures the structured facts of *what* changed; `reason` and `transcript` capture the agent's motivation and thought process for *why*.

Transcript JSON format:

```json
[
  { "step": 1, "thought": "Analyzed task requirements..." },
  { "step": 2, "thought": "Matched my specialization..." },
  { "step": 3, "thought": "Decided to claim this task." }
]
```

Both fields are nullable — existing log entries and agents that don't send reasoning are unaffected.

### Database Migration

The project uses manual migrations in `src/db/migrate.ts` with `CREATE TABLE IF NOT EXISTS` patterns. The migration must be idempotent (safe to re-run):

1. **Update `src/db/schema.ts`** — Add `reason` and `transcript` columns to the Drizzle `taskLogs` table definition:
   ```ts
   reason: text("reason"),
   transcript: text("transcript"),
   ```

2. **Update `src/db/migrate.ts`** — Add an idempotent ALTER TABLE block after the existing `CREATE TABLE IF NOT EXISTS task_logs` block. Use `PRAGMA table_info(task_logs)` to check if columns already exist before attempting ALTER:
   ```ts
   // Add reasoning columns if they don't exist
   const taskLogColumns = db.query("PRAGMA table_info(task_logs)").all() as { name: string }[];
   const columnNames = taskLogColumns.map(c => c.name);

   if (!columnNames.includes("reason")) {
     db.exec("ALTER TABLE task_logs ADD COLUMN reason TEXT");
   }
   if (!columnNames.includes("transcript")) {
     db.exec("ALTER TABLE task_logs ADD COLUMN transcript TEXT");
   }
   ```

### Service Layer Changes

The `createTaskLog` function in `src/services/taskLogs.ts` must accept an optional reasoning parameter:

```ts
interface Reasoning {
  reason?: string;
  transcript?: { step: number; thought: string }[];
}

export async function createTaskLog(
  taskId: string,
  agentId: string | null,
  action: TaskLogAction,
  details: LogDetails,
  reasoning?: Reasoning       // NEW
): Promise<string>
```

The transcript array is JSON.stringify'd before insertion into the TEXT column.

Helper functions (`logTaskClaimed`, `logTaskReleased`, `logTaskUpdated`) gain an optional `reasoning?: Reasoning` parameter and pass it through to `createTaskLog`.

### API Changes

Four endpoints gain optional `reason` and `transcript` fields:

| Endpoint | Fields Added |
|----------|-------------|
| `POST /api/tasks/:id/claim` | `reason?: string`, `transcript?: Step[]` |
| `PATCH /api/tasks/:id` | `reason?: string`, `transcript?: Step[]` |
| `POST /api/tasks/:id/release` | `reason?: string`, `transcript?: Step[]` |
| `POST /api/approvals` | `reason?: string`, `transcript?: Step[]` |

Zod validation:

```ts
reason: z.string().max(280).optional(),
transcript: z.array(
  z.object({
    step: z.number().int().positive().max(100),
    thought: z.string().min(1).max(2000)
  })
).max(50).optional()
```

Constraints: reason max 280 chars, transcript max 50 steps, each step number max 100, each thought max 2000 chars.

**Approval endpoint handling:** `POST /api/approvals` currently creates an entry in `approval_requests` but does NOT write to `task_logs`. To store reasoning on `task_logs`, add a new action type `"approval_requested"` to the `TaskLogAction` union type and call `createTaskLog` when an approval is created. Update `VALID_ACTIONS` in the logs route.

`GET /api/logs` response includes `reason` and `transcript` fields (null when absent). Update the response formatter in `src/api/routes/logs.ts` to include these fields in the output.

### Dashboard UI

New `AgentReasoningTimeline` component rendered inside `TaskDetail`:

- Vertical timeline with glowing cyan dots for entries with reasoning, dim dots without
- Each entry shows: action badge, agent name, timestamp
- Entries with reasoning show the `reason` summary in italic below the header
- Expand/collapse button reveals the chain-of-thought `transcript` steps
- Palantir aesthetic: dark background, monospace font, cyan accents, scan-line effects

**Type updates required:**

Update `TaskLog` interface in `dashboard/src/lib/api-client.ts`:

```ts
export interface TaskLog {
  id: string;
  taskId: string;
  agentId: string | null;    // also fix existing type to match API (can be null after agent deletion)
  action: string;
  details: Record<string, unknown>;
  reason: string | null;      // NEW
  transcript: { step: number; thought: string }[] | null;  // NEW
  createdAt: string;
}
```

Handle null `agentId` gracefully in the timeline — display "Unknown agent" or "System" when agent is null.

### CLI Changes

Agent CLI commands gain optional flags:

- `--reason <text>` — short reasoning summary
- `--transcript <json-file>` — path to JSON file containing reasoning steps. Use `-` to read from stdin.

**CLI functions that need signature changes in `cli/src/client.ts`:**

| Function | Current Body | New Fields |
|----------|-------------|------------|
| `claimTask()` | `{ taskId, agentId }` | `+ reason?: string, transcript?: Step[]` |
| `updateTask()` | `{ ...updates }` | `+ reason?: string, transcript?: Step[]` |
| `releaseTask()` | currently sends **no body** | `+ body: { reason?: string, transcript?: Step[] }` |
| `requestApproval()` | `{ taskId, agentId, actionRequested }` | `+ reason?: string, transcript?: Step[]` |

**CLI validation:** If `--transcript` is provided, validate the file exists and contains parseable JSON matching the Step[] schema before sending. Show a clear error if validation fails.

**Stdin handling:** When `--transcript -` is passed, read stdin synchronously before sending the API request. This avoids conflicts with commander's argument parsing.

## In Scope (v1)

- Database migration: ALTER TABLE task_logs ADD reason, transcript (idempotent)
- Drizzle schema update in `src/db/schema.ts`
- Service layer: extend `createTaskLog` and helper functions with reasoning parameter
- New action type: `"approval_requested"` in TaskLogAction union
- Zod validation schemas for reasoning fields (with size/count limits)
- API: extend 4 endpoints (claim, update, release, request-approval)
- API: include reasoning in GET /api/logs response formatter
- Dashboard: update TaskLog interface in api-client.ts
- Dashboard: new AgentReasoningTimeline component in TaskDetail
- Dashboard: expandable chain-of-thought transcript
- CLI: --reason and --transcript flags for claim/update/release/approval commands
- CLI: update all 4 client.ts functions to send reasoning fields
- CLI: stdin support via --transcript - flag
- Tests: API tests for reasoning fields with DATABASE_PATH isolation
- Palantir-styled UI matching existing theme

## Out of Scope (v1)

- Manager control actions (pause, block, reassign) — view-only
- Real-time streaming (WebSockets) — continue using 5s polling
- Agent-to-manager messaging or instructions
- Alerting or notifications
- Search/filter within reasoning transcripts
- Analytics on reasoning patterns

## Testing Strategy

All tests must set `DATABASE_PATH=./data/test.db` before importing the connection module (per project isolation rules).

**API tests (DATABASE_PATH=./data/test.db bun test):**
- Migration idempotency: running migrate() twice doesn't fail, columns exist after second run
- Claim with reasoning: POST /api/tasks/:id/claim with reason + transcript, verify GET /api/logs returns them
- Claim without reasoning: POST /api/tasks/:id/claim without reason/transcript, verify GET /api/logs returns null for both fields
- Backwards compatibility: existing API clients that omit reasoning fields continue to work
- Validation: transcript with malformed step objects returns 400
- Validation: reason exceeding 280 chars returns 400
- Validation: transcript exceeding 50 steps returns 400
- Approval with reasoning: POST /api/approvals with reasoning creates task_logs entry with "approval_requested" action

**Dashboard tests:**
- AgentReasoningTimeline renders correctly with reasoning data (expanded and collapsed states)
- AgentReasoningTimeline renders correctly without reasoning data (dimmed dots, "No agent reasoning available")
- Handles null agentId gracefully

## Technical Decisions

1. **SQLite ALTER TABLE** — Both new columns DEFAULT NULL, no data migration needed. Idempotent via PRAGMA table_info check.
2. **JSON text storage** — Transcript stored as JSON text in a single column. SQLite JSON functions can query inside if needed later.
3. **New component, not modification** — Create AgentReasoningTimeline as a new component. Replaces the existing log display in TaskDetail only.
4. **Optional CLI flags** — Agents opt in to sending reasoning. Existing workflow unchanged if flags aren't provided.
5. **Polling over streaming** — Reasoning appears on next 5-second poll cycle. Streaming adds complexity for marginal UX gain at this scale.
6. **Approval logging** — POST /api/approvals now also writes to task_logs with new "approval_requested" action type, so reasoning has a home there.
7. **Size constraints** — Reason max 280 chars, transcript max 50 steps, each thought max 2000 chars. Prevents unbounded row growth.
