# Mission Board Unified Skill — Design Spec

## Overview

A single Claude Code skill file (`mission.md`) that provides full access to the Mission Board API. Zero external dependencies — uses only `curl` and `cat`. Anyone with API access can install by copying one file to `~/.claude/skills/`.

## Goals

- **Single file deployment**: one `.md` file, no helper scripts, no Bun/Node dependency
- **CLI parity**: all CLI commands available as subcommands of `/mission`
- **Shared config**: reads/writes `~/.mission-board/config.json`, compatible with the existing CLI
- **First-run setup**: auto-detects missing config and guides user through setup

## Usage

```
/mission                          Dashboard: my tasks + project list
/mission list [--status X] [--project P]   List tasks with optional filters
/mission show <id>                Task details
/mission create                   Create task (interactive field collection)
/mission claim <id>               Claim task (with approval workflow if required)
/mission update <id>              Update task status/title/description
/mission complete <id>            Mark task done (with approval check if required)
/mission release <id>             Release claimed task
/mission review <id>              View review comments on a task
```

## Config File

Path: `~/.mission-board/config.json`

```json
{
  "api_url": "http://localhost:3200",
  "agents": {
    "alice": "a1b2c3d4-..."
  },
  "default_agent": "alice"
}
```

This is the same format used by the CLI (`mission` binary). Users who already have the CLI configured get the skill working immediately with no additional setup.

## First-Run Flow

1. Check if `~/.mission-board/config.json` exists via `cat`
2. If missing or empty:
   - Ask user for API URL (default: `http://localhost:3200`)
   - Ask user for agent name
   - Generate UUID via `uuidgen` or `cat /proc/sys/kernel/random/uuid`
   - Write config file via `mkdir -p ~/.mission-board && cat > config.json`
   - Register agent with API via `curl -s -X POST /api/agents` (best-effort, non-blocking)
3. If present: read and use as-is

## API Interaction Pattern

All API calls use `curl -s` with JSON content type. Responses are parsed by Claude and formatted as readable markdown.

```bash
# List tasks
curl -s "${API_URL}/api/tasks?status=in_progress"

# Show task
curl -s "${API_URL}/api/tasks/${TASK_ID}"

# Create task
curl -s -X POST "${API_URL}/api/tasks" \
  -H "Content-Type: application/json" \
  -d '{"projectId":"...","title":"...","taskType":"..."}'

# Claim task
curl -s -X POST "${API_URL}/api/tasks/${TASK_ID}/claim" \
  -H "Content-Type: application/json" \
  -d '{"agentId":"..."}'

# Update task
curl -s -X PATCH "${API_URL}/api/tasks/${TASK_ID}" \
  -H "Content-Type: application/json" \
  -d '{"status":"review"}'

# Release task
curl -s -X POST "${API_URL}/api/tasks/${TASK_ID}/release"

# List projects
curl -s "${API_URL}/api/projects"

# Request approval
curl -s -X POST "${API_URL}/api/approvals" \
  -H "Content-Type: application/json" \
  -d '{"taskId":"...","agentId":"...","actionRequested":"..."}'

# Check approval
curl -s "${API_URL}/api/approvals?task_id=${TASK_ID}"

# Get comments
curl -s "${API_URL}/api/tasks/${TASK_ID}/comments"
```

## Subcommand Details

### `/mission` (no args) — Dashboard

Show a combined view:
1. Fetch tasks assigned to the current agent
2. Fetch project list
3. Display as: my in-progress tasks, then available projects

### `/mission list`

Flags: `--status <status>`, `--project <project-id>`

Valid statuses: `backlog`, `ready`, `in_progress`, `review`, `done`, `blocked`

Output as markdown table: `| ID (short) | Title | Status | Type | Assignee |`

### `/mission show <id>`

Display all task fields in a structured format: title, description, status, type, project, assignee, timestamps.

### `/mission create`

Interactive — prompt for missing fields:
- **project**: show project list first, let user pick
- **title**: required
- **type**: one of `implementation | bugfix | feature | deployment | documentation | testing | research | other`
- **description**: optional but encouraged

### `/mission claim <id>`

1. Read config to get agent UUID
2. `POST /api/tasks/:id/claim` with `{"agentId": "..."}`
3. If 409 conflict: show who currently owns it
4. If task has `requiresApproval`: inform user and offer to check approval status

### `/mission update <id>`

Prompt for what to change: status, title, or description. At least one required.

Status transitions are validated server-side: `backlog <-> ready <-> in_progress <-> review <-> done`, any -> `blocked`.

### `/mission complete <id>`

1. Fetch task to check `requiresApproval`
2. If approval required: create approval request, inform user to approve on dashboard, offer to poll
3. If not required: `PATCH` status to `done` directly

### `/mission release <id>`

`POST /api/tasks/:id/release`, confirm with task title.

### `/mission review <id>`

Fetch `GET /api/tasks/:id/comments`, display with author, timestamp, content. Summarize actionable feedback.

## Error Handling

- **API unreachable**: "Cannot reach Mission Board API at {url}. Is the server running?"
- **404**: "Task/project not found."
- **409 on claim**: "Task already claimed by {agent}."
- **Invalid status transition**: Show server error message with valid transitions.
- **No config**: Trigger first-run setup flow.

## File Structure

```
~/.claude/skills/mission.md       <- Install this one file
~/.mission-board/config.json      <- Auto-created on first run, shared with CLI
```

## Deployment

Users install by copying `mission.md` to `~/.claude/skills/`:

```bash
# From the mission-board repo
cp .claude/skills/mission.md ~/.claude/skills/mission.md

# Or via the deploy script
bun run deploy:skills
```

The deploy script should be updated to deploy only `mission.md` (replacing the old individual skill files).
