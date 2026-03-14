# Mission Skill — Agent Reasoning Integration

**Date:** 2026-03-14
**Status:** Draft
**Scope:** `.claude/skills/mission/SKILL.md` only (no API or backend changes)

## Problem

The Mission Board API supports structured reasoning data (`reason` and `transcript`) on all state-changing endpoints (claim, release, update, approval). However, the Mission skill (`SKILL.md`) doesn't mention reasoning at all. Agents following the skill never send reasoning data, so audit logs are missing the "why" behind every action.

## Goal

Update SKILL.md so that agents **always include reasoning** when taking actions on tasks. This enables complete audit trails visible in the dashboard's AgentReasoningTimeline.

## API Contract (already implemented)

### Fields

| Field | Type | Constraints | Purpose |
|---|---|---|---|
| `reason` | string | max 280 chars | One-line summary of why the action was taken |
| `transcript` | array of `{step, thought}` | max 50 steps, thought max 2000 chars | Chain-of-thought decision process |

### Endpoints that accept reasoning

| Endpoint | Method | Reasoning in body |
|---|---|---|
| `/api/tasks/:id/claim` | POST | `reason`, `transcript` alongside `agentId` |
| `/api/tasks/:id/release` | POST | `reason`, `transcript` in body |
| `/api/tasks/:id` | PATCH | `reason`, `transcript` alongside update fields |
| `/api/approvals` | POST | `reason`, `transcript` alongside approval fields |

## Changes to SKILL.md

### 1. Add "Agent Reasoning" section (after "Setup Check", before "Subcommands")

New section that explains:

- **What**: Every state-changing action must include `reason` and `transcript`
- **reason**: A concise summary of WHY you're taking this action (max 280 chars). Written in first person, action-oriented.
- **transcript**: Your decision-making steps as an array of `{step, thought}`. Each step captures one discrete reasoning step. Typically 2-5 steps.
- **When to include**: claim, release, update (status/title/description changes), complete, approval requests

#### Guidance for writing good reasoning

**reason** — answer "why am I doing this?" in one sentence:
- Good: `"Task matches my expertise in React; no blockers in description"`
- Good: `"Implementation complete, all 3 acceptance criteria met, tests passing"`
- Good: `"Blocked on upstream API — releasing so another agent can pick up a different approach"`
- Bad: `"Claiming this task"` (restates the action, no insight)
- Bad: `"Done"` (no context)

**transcript** — show your decision process, not a narrative:
- Each step should capture a distinct reasoning moment
- Steps should be substantive, not padding
- 2-5 steps is typical; don't force more

Example transcript for claiming a task:
```json
[
  {"step": 1, "thought": "Task requires implementing a React component with Tailwind — matches my current project context"},
  {"step": 2, "thought": "Checked dependencies: no blockers, design spec is linked in description"},
  {"step": 3, "thought": "No other agent has claimed this; ready status confirmed"}
]
```

Example transcript for completing a task:
```json
[
  {"step": 1, "thought": "Implemented the UserProfile component as specified in the design doc"},
  {"step": 2, "thought": "Added unit tests — 4 tests covering render, props, error state, loading state"},
  {"step": 3, "thought": "Manual verification: component renders correctly in the dashboard"},
  {"step": 4, "thought": "All acceptance criteria from task description are met"}
]
```

### 2. Update `claim` subcommand curl

Before:
```bash
curl -s -X POST "<API_URL>/api/tasks/<TASK_ID>/claim" \
  -H "Content-Type: application/json" \
  -d '{"agentId":"<AGENT_ID>"}'
```

After:
```bash
curl -s -X POST "<API_URL>/api/tasks/<TASK_ID>/claim" \
  -H "Content-Type: application/json" \
  -d '{"agentId":"<AGENT_ID>","reason":"<REASON>","transcript":<TRANSCRIPT_JSON>}'
```

Add instruction: "Before claiming, formulate your `reason` (why you're picking this task) and `transcript` (your decision steps). Include both in the request body."

### 3. Update `update` subcommand curl

Before:
```bash
curl -s -X PATCH "<API_URL>/api/tasks/<TASK_ID>" \
  -H "Content-Type: application/json" \
  -d '{"status":"<STATUS>","title":"<TITLE>","description":"<DESC>"}'
```

After:
```bash
curl -s -X PATCH "<API_URL>/api/tasks/<TASK_ID>" \
  -H "Content-Type: application/json" \
  -d '{"status":"<STATUS>","reason":"<REASON>","transcript":<TRANSCRIPT_JSON>}'
```

Add instruction: "Include `reason` and `transcript` explaining why the update is being made."

### 4. Update `complete` subcommand

For direct completion (no approval needed):
```bash
curl -s -X PATCH "<API_URL>/api/tasks/<TASK_ID>" \
  -H "Content-Type: application/json" \
  -d '{"status":"done","reason":"<REASON>","transcript":<TRANSCRIPT_JSON>}'
```

For approval-required completion:
```bash
curl -s -X POST "<API_URL>/api/approvals" \
  -H "Content-Type: application/json" \
  -d '{"taskId":"<TASK_ID>","agentId":"<AGENT_ID>","actionRequested":"complete","reason":"<REASON>","transcript":<TRANSCRIPT_JSON>}'
```

Add instruction: "The `reason` should summarize what was accomplished. The `transcript` should detail the work done and verification steps."

### 5. Update `release` subcommand

Before:
```bash
curl -s -X POST "<API_URL>/api/tasks/<TASK_ID>/release"
```

After:
```bash
curl -s -X POST "<API_URL>/api/tasks/<TASK_ID>/release" \
  -H "Content-Type: application/json" \
  -d '{"reason":"<REASON>","transcript":<TRANSCRIPT_JSON>}'
```

Add instruction: "The `reason` should explain why you're releasing the task. This helps the next agent understand the context."

## Non-changes

- No API code changes (reasoning is already supported)
- No mission-helper.ts changes (skill operates via curl)
- No dashboard changes (AgentReasoningTimeline already renders reasoning)
- No schema changes (validation already in place)

## Success Criteria

1. An agent following the updated SKILL.md sends `reason` and `transcript` on every claim/update/complete/release action
2. The AgentReasoningTimeline dashboard shows populated reasoning entries (not empty)
3. Audit logs contain meaningful "why" context for every agent action
