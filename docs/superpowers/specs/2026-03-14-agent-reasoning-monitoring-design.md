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

Transcript JSON format:

```json
[
  { "step": 1, "thought": "Analyzed task requirements..." },
  { "step": 2, "thought": "Matched my specialization..." },
  { "step": 3, "thought": "Decided to claim this task." }
]
```

Both fields are nullable — existing log entries and agents that don't send reasoning are unaffected.

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
    step: z.number().int().positive(),
    thought: z.string().min(1)
  })
).optional()
```

`GET /api/logs` response includes `reason` and `transcript` fields (null when absent).

### Dashboard UI

New `AgentReasoningTimeline` component rendered inside `TaskDetail`:

- Vertical timeline with glowing cyan dots for entries with reasoning, dim dots without
- Each entry shows: action badge, agent name, timestamp
- Entries with reasoning show the `reason` summary in italic below the header
- Expand/collapse button reveals the chain-of-thought `transcript` steps
- Palantir aesthetic: dark background, monospace font, cyan accents, scan-line effects

### CLI Changes

Agent CLI commands gain optional flags:

- `--reason <text>` — short reasoning summary
- `--transcript <json-file>` — path to JSON file containing reasoning steps, or piped via stdin

## In Scope (v1)

- Database migration: ALTER TABLE task_logs ADD reason, transcript
- Zod validation schemas for reasoning fields
- API: extend 4 endpoints (claim, update, release, request-approval)
- API: include reasoning in GET /api/logs response
- Dashboard: TaskDetail timeline component with reasoning display
- Dashboard: expandable chain-of-thought transcript
- CLI: --reason and --transcript flags for claim/update/release commands
- Tests: API tests for reasoning fields, migration test
- Palantir-styled UI matching existing theme

## Out of Scope (v1)

- Manager control actions (pause, block, reassign) — view-only
- Real-time streaming (WebSockets) — continue using 5s polling
- Agent-to-manager messaging or instructions
- Alerting or notifications
- Search/filter within reasoning transcripts
- Analytics on reasoning patterns

## Technical Decisions

1. **SQLite ALTER TABLE** — Both new columns DEFAULT NULL, no data migration needed.
2. **JSON text storage** — Transcript stored as JSON text in a single column. SQLite JSON functions can query inside if needed later.
3. **New component, not modification** — Create AgentReasoningTimeline as a new component. Replaces the existing log display in TaskDetail only.
4. **Optional CLI flags** — Agents opt in to sending reasoning. Existing workflow unchanged if flags aren't provided.
5. **Polling over streaming** — Reasoning appears on next 5-second poll cycle. Streaming adds complexity for marginal UX gain at this scale.
