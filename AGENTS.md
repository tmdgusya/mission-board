# Mission Board Agent Guide

Use the `mission` CLI to find, claim, and complete tasks. All actions are logged. No authentication needed — it's an internal tool.

## Quick Start

Both services are already running:
- **API**: http://localhost:3200
- **Dashboard**: http://localhost:3201

CLI binary: `./dist/mission` (build with `bun run build:cli`)

## Setup

**First time (non-interactive):**
```bash
# Create config file directly
echo '{"agent_id": "your-agent-id", "api_url": "http://localhost:3200"}' > ~/.mission-board/config.json

# Or use set-agent (non-interactive)
./dist/mission set-agent your-agent-id

# Verify
./dist/mission config
```

**Interactive setup (humans only):**
```bash
./dist/mission init  # Uses prompts — not suitable for non-interactive agents
```

You auto-register in the system on your first `claim` or `request-approval` call. No explicit registration needed.

## CLI Commands

```bash
# Setup
./dist/mission config                        # Show current config
./dist/mission set-agent <id>                # Set agent ID

# Discover work
./dist/mission projects                      # List all projects
./dist/mission list                          # Your tasks (filtered by agent_id)
./dist/mission list --project <id>           # Filter by project
./dist/mission list --status <status>        # Filter by status
./dist/mission show <task-id>                # Full task details

# Task lifecycle
./dist/mission claim <task-id>               # Claim → in_progress
./dist/mission update <task-id> --status <status>  # Change status
./dist/mission release <task-id>             # Release → ready

# Create tasks
./dist/mission create --project <id> --title "Task name" --type <type> [--description "..."]

# Approval workflow
./dist/mission request-approval <task-id> --action "What you did"
./dist/mission check-approval <task-id>      # Check approval status
```

**Task types:** `implementation` | `bugfix` | `feature` | `deployment` | `documentation` | `testing` | `research` | `other`

**Statuses:** `backlog` → `ready` → `in_progress` → `review` → `done` (plus `blocked`)

## API Endpoints

For direct HTTP access (all JSON, `Content-Type: application/json`):

```bash
# Projects
GET    /api/projects
POST   /api/projects          {"name": "...", "description": "..."}

# Tasks
GET    /api/tasks?project_id=X&status=Y&agent_id=Z
POST   /api/tasks              {"projectId": "...", "title": "...", "taskType": "...", "description": "...", "requiresApproval": true}
GET    /api/tasks/:id
PATCH  /api/tasks/:id          {"status": "...", "title": "...", "description": "..."}
DELETE /api/tasks/:id
POST   /api/tasks/:id/claim    {"agentId": "..."}
POST   /api/tasks/:id/release

# Approvals
GET    /api/approvals?task_id=X&status=Y
POST   /api/approvals          {"taskId": "...", "agentId": "...", "actionRequested": "..."}
POST   /api/approvals/:id/approve   {"reviewedBy": "..."}
POST   /api/approvals/:id/deny      {"reviewedBy": "...", "notes": "Reason for denial"}

# Analytics
GET    /api/analytics/agents       Per-agent performance stats
GET    /api/analytics/tasks        Task metrics and completion rates
GET    /api/analytics/time-tracking  Avg time: created→claimed, claimed→done
GET    /api/analytics/velocity     Tasks completed per day (default 30 days)
```

Filter analytics by `?project_id=X&date_from=Y&date_to=Z`.

## Dashboard

Humans monitor work at http://localhost:3201:
- Kanban board with drag-and-drop between status columns
- Filter by project, status, agent, or search text
- Approval queue — humans approve or deny agent requests
- Analytics — agent performance, task metrics, velocity charts
- Export data as CSV or JSON

## Agent Workflow

### Finding work
```bash
./dist/mission projects                          # What projects exist?
./dist/mission list --status ready               # Groomed tasks (pick these first)
./dist/mission list --status backlog             # Ungroomed tasks
./dist/mission show <task-id>                    # Read details before committing
```

### Picking the right task
- **Prefer `ready` over `backlog`** — groomed tasks have clearer requirements
- Check `task_type` matches your capabilities
- Note `requires_approval` — means you'll pause for human review before completion
- Use `show` to read the description and understand what's expected

### Claiming and working
```bash
./dist/mission claim <task-id>          # Only works from backlog or ready
                                       # 409 Conflict if another agent claimed it
# ... do the work in the codebase ...
./dist/mission update <task-id> --status review    # Done, ready for review
./dist/mission update <task-id> --status blocked   # Stuck on something
./dist/mission release <task-id>                   # Give up (task → ready)
```

### Approval workflow (for `requires_approval: true` tasks)
```bash
./dist/mission request-approval <task-id> --action "Fixed the login bug, deployed to staging"
                                       # Task auto-transitions to review
./dist/mission check-approval <task-id> # Poll for status
```
- **Approved** → task moves to `ready`, continue to completion
- **Denied** → task moves to `blocked`, read reviewer notes, fix and resubmit

### Completing
```bash
./dist/mission update <task-id> --status done
```

## Status Transitions

```
backlog     → ready, blocked
ready       → backlog, in_progress, blocked
in_progress → ready, review, blocked
review      → in_progress, done, blocked
done        → review, blocked
blocked     → backlog, ready, in_progress, review, done
```

Invalid transitions return an error listing the valid options.

## Common Patterns

| Situation | Action |
|-----------|--------|
| "I'm stuck on this task" | `release` it, pick another one |
| "Task needs human review" | `request-approval --action "..."` |
| "Check what I've done" | `list` (auto-filtered to your agent_id) |
| "Create a task for another agent" | `create --project <id> --title "..." --type <type>` |
| "What happened on a task?" | `show <task-id>` |
| "I need to undo my work" | `update --status <previous-status>` |

## Agent Notes

- **Config file**: `~/.mission-board/config.json` — stores `agent_id` and `api_url`
- **Auto-registration**: first `claim` or `request-approval` call creates your agent record
- **No auth**: internal tool — agent_id is self-provided and trusted
- **Audit trail**: all actions (created, claimed, released, updated, deleted) logged to `task_logs`
- **`mission init` is interactive** — uses readline prompts, write config file directly for scripted/non-interactive use
- **CLI timeout**: 30 seconds per API call
- **409 Conflict**: means another agent already claimed the task — try a different one
