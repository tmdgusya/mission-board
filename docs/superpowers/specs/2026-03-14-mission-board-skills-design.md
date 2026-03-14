# Mission Board Claude Code Skills

**Date:** 2026-03-14
**Status:** Draft (Rev 2 — addresses spec review)
**Scope:** Claude Code skills for mission board interaction + multi-agent config update + API additions

## Problem

Claude Code agents working in separate terminal sessions have no ergonomic way to interact with the mission board. The existing CLI tool works for standalone agents but lacks:

- Discoverable slash-command integration with Claude Code
- Multi-agent identity support (current config only holds one `agent_id`)
- Human approval gates on task claiming
- Review feedback loops

## Solution

Create 7 Claude Code skills backed by a shared Bun helper script, update the CLI config to support multiple named agents, and add a deploy mechanism to install skills globally.

## Multi-Agent Config Format

### New format (`~/.mission-board/config.json`)

```json
{
  "api_url": "http://localhost:3200",
  "agents": {
    "alice": "550e8400-e29b-41d4-a716-446655440000",
    "bob": "6ba7b810-9dad-11d1-80b4-00c04fd430c8"
  },
  "default_agent": "alice"
}
```

### Migration

If the old format is detected (`{ agent_id, api_url }`), auto-migrate:

- Old `agent_id` becomes a new entry under `agents` with generated name `agent-1`
- `default_agent` set to `agent-1`
- Old fields removed

### Agent name registration flow

1. Skill runs `bun mission-helper.ts whoami`
2. If no default agent exists, skill prompts: "What should this agent be called?"
3. User provides name (e.g., "alice")
4. UUID generated, saved to config under `agents.alice`
5. `default_agent` set to `alice`
6. Agent name saved to Claude Code memory for future sessions
7. On next session, skill checks memory: "You were 'alice' last time — continue as alice?"

## API Additions (Required)

The following API changes must be implemented as deliverables of this spec. None of these exist yet in the codebase — they are new work:

### 1. Agent registration with name — `POST /api/agents`

Currently agents are auto-registered with UUID as name. Add an explicit registration endpoint:

```
POST /api/agents
Body: { "id": "<uuid>", "name": "alice" }
Response: { "id": "<uuid>", "name": "alice", "createdAt": "...", "lastSeenAt": "..." }
```

Also add `PATCH /api/agents/:id` to update the name of an existing agent.

The `whoami` helper command calls this endpoint to register an agent with a human-readable name. The dashboard and "claimed by" messages will show the human name instead of a raw UUID.

### 2. Task comments — `POST /api/tasks/:id/comments`

Add a `task_comments` table for review feedback:

```sql
task_comments:
  id          TEXT PRIMARY KEY
  taskId      TEXT REFERENCES tasks(id) ON DELETE CASCADE
  agentId     TEXT REFERENCES agents(id)  -- author (agent or human via dashboard)
  content     TEXT NOT NULL
  createdAt   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
```

Endpoints:
- `POST /api/tasks/:id/comments` — Add comment `{ agentId, content }`
- `GET /api/tasks/:id/comments` — List comments for a task

The `/mission-review` skill reads these comments. Reviewers (human or agent) post feedback here via the dashboard or API.

### 3. Claim-with-approval flow

The `claim` helper command implements a two-step flow:

1. **Step 1:** Call `POST /api/approvals` with `{ taskId, agentId, actionRequested: "claim" }`
   - This creates a pending approval request. The task is NOT claimed yet.
2. **Step 2 (after human approves):** Helper polls `GET /api/approvals?task_id=<id>&status=approved`
   - Once approved, helper calls `POST /api/tasks/:id/claim` with the agent's UUID
   - Task moves to `in_progress`

The `complete` helper command follows the same pattern:
1. If `requiresApproval`, call `POST /api/approvals` with `actionRequested: "complete"`
2. Poll for approval
3. Once approved, call `PATCH /api/tasks/:id` with `status: "done"`

### 4. Approval denial handling

When polling for approval, the helper must also check for denial:

- Poll `GET /api/approvals?task_id=<id>` and check the `status` field
- If `status === "approved"` → proceed with the action (claim or complete)
- If `status === "denied"` → exit with code 1 and message: `"Request denied by <reviewer-name>. Reason: <notes>"`
- If `status === "pending"` → continue polling (skill instructs agent to wait or tell user to approve)

This prevents agents from polling forever when a human denies a request.

## Helper Script

**Location:** `.claude/skills/mission-helper.ts`
**Runtime:** `bun`
**Output:** JSON (stdout), errors on stderr with exit code 1

### Commands

| Command | Args | Description |
|---------|------|-------------|
| `whoami` | `--name <name>` (optional) | Returns agent identity; registers if name is new |
| `list` | `--project <id>` `--status <status>` | List tasks with optional filters |
| `show` | `<task-id>` | Get task details |
| `claim` | `<task-id> --name <agent-name>` | Create approval request to claim task |
| `status` | `<task-id> --status <new-status>` | Update task status |
| `release` | `<task-id>` | Release a claimed task |
| `create` | `--project <id> --title "..." --type <type> --description "..."` | Create task in backlog |
| `check-approval` | `<task-id>` | Check approval status |
| `review` | `<task-id>` | Get review feedback/comments |
| `complete` | `<task-id>` | Mark done; request approval if `requiresApproval` is set |

### Key behaviors

- All commands resolve agent name to UUID via config
- Atomic config writes: read → modify → write to temp file → rename
- Exit codes: 0 success, 1 error (JSON error on stderr)

## Skills

**Location (source):** `/home/roach/mission-board/.claude/skills/`
**Location (deployed):** `~/.claude/skills/`

### `/mission-list`

**File:** `mission-list.md`
**Trigger:** "show me tasks", "what's available", "list missions"

- Runs `bun mission-helper.ts list` with optional filters
- Formats output as readable table
- Supports `--status` and `--project` filters

### `/mission-claim`

**File:** `mission-claim.md`
**Trigger:** "claim task X", "take task X"

1. Check identity via `whoami`; prompt for name if first use
2. Run `bun mission-helper.ts claim <task-id>` — creates approval request
3. Tell agent to **wait for human approval**
4. Agent polls `check-approval` or tells user to approve on dashboard
5. Only proceed to work after approval is confirmed

### `/mission-status`

**File:** `mission-status.md`
**Trigger:** "update status", "move task to review"

- Runs `bun mission-helper.ts status <task-id> --status <new-status>`
- Shows valid transitions if an invalid one is attempted

### `/mission-release`

**File:** `mission-release.md`
**Trigger:** "release task", "unclaim task"

- Runs `bun mission-helper.ts release <task-id>`
- Confirms release with task title

### `/mission-create`

**File:** `mission-create.md`
**Trigger:** "create a task", "add task to backlog"

- Prompts for project, title, type, description if not provided
- Runs `bun mission-helper.ts create ...`
- Returns created task ID

### `/mission-review`

**File:** `mission-review.md`
**Trigger:** "check review", "review feedback"

- Runs `bun mission-helper.ts review <task-id>`
- Displays feedback from reviewers (agents or humans)
- Instructs agent to update code based on feedback
- After fixes, agent moves status back to `review`

### `/mission-complete`

**File:** `mission-complete.md`
**Trigger:** "mark done", "complete task"

- Runs `bun mission-helper.ts complete <task-id>`
- If `requiresApproval` is set, creates approval request and waits
- Otherwise marks `done` directly

## Multi-Session Safety

### Atomic config writes

Helper script uses read → modify → write-to-temp → rename pattern to prevent corruption when multiple agents register simultaneously.

### Agent name memory

- After first skill use that prompts for name, the skill saves the agent name to Claude Code memory
- On subsequent sessions in the same project, the skill checks memory first: "You were 'alice' last time — continue as alice?"
- User can confirm or pick a different name

### Concurrent claim protection

- API returns 409 if a task is already claimed by another agent
- Helper resolves the owning agent's UUID to their human name via `GET /api/agents/:id`
- Skills display clear message: "Task already claimed by alice" (not a raw UUID)

## CLI Updates

### Config changes

- Update `cli/src/config.ts` to support new multi-agent format
- `Config` interface changes to `{ api_url, agents, default_agent }`
- Add `--agent <name>` flag to all CLI commands
- Auto-migrate old config format on first read
- Replace `node:fs/promises` with `Bun.file` / `Bun.write` per CLAUDE.md guidelines
- Replace `writeFile` with atomic write (write to temp → rename) in `saveConfig`

### Backward compatibility

- Old config auto-migrated on first read
- CLI without `--agent` flag uses `default_agent`

### Migration edge case

- If old config has no agent name, generate name from first 8 chars of the UUID (e.g., `agent-550e8400`) to avoid collisions across machines with synced dotfiles

## Deployment

### File structure (source)

```
/home/roach/mission-board/.claude/skills/
├── mission-helper.ts
├── mission-list.md
├── mission-claim.md
├── mission-status.md
├── mission-release.md
├── mission-create.md
├── mission-review.md
└── mission-complete.md
```

### Deploy script

**Location:** `/home/roach/mission-board/scripts/deploy-skills.ts`
**Run via:** `bun run deploy:skills`

- Copies all skill `.md` files to `~/.claude/skills/`
- Copies `mission-helper.ts` to `~/.claude/skills/`
- All skill `.md` files reference the helper via `MISSION_HELPER_PATH` — in source this is a relative path (`.claude/skills/mission-helper.ts`), the deploy script rewrites it to the absolute path (`~/.claude/skills/mission-helper.ts` expanded to full home path)
- Skills invoke the helper as: `bun <MISSION_HELPER_PATH> <command> <args>`

### Package.json addition

```json
{
  "scripts": {
    "deploy:skills": "bun scripts/deploy-skills.ts"
  }
}
```

## Agent Lifecycle (Full Flow)

```
/mission-list                    → browse available tasks
/mission-claim <task-id>         → request claim (creates approval request)
  ... human approves on dashboard ...
  ... agent works on the task ...
/mission-status <id> → review   → submit for review
/mission-review <id>             → check feedback, fix code
/mission-complete <id>           → mark done (approval if required)
```

## Implementation via Team Agents

Implementation should be parallelized using Claude Code team agent mode, spawning at least 5 agents:

1. **api-agent** — API additions: add `task_comments` table to `schema.ts`, add `POST/PATCH /api/agents`, add `GET/POST /api/tasks/:id/comments` routes, add comments route file
2. **config-agent** — Multi-agent config format + migration + atomic writes in `cli/src/config.ts`
3. **helper-agent** — `mission-helper.ts` shared helper script
4. **skills-agent** — All 7 skill markdown files
5. **deploy-agent** — Deploy script + package.json updates + CLI `--agent` flag

Dependencies: config-agent and api-agent should complete first, as helper-agent and skills-agent depend on them.

## Out of Scope

- Authentication/authorization layer
- WebSocket-based real-time approval notifications (polling is sufficient)
- Dashboard UI changes for comments (existing dashboard already supports approvals; comment UI is a follow-up)
- Skill auto-discovery/installation from a registry
