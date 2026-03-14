---
name: mission
description: Manage tasks on a Mission Board kanban — list, create, claim, update, complete, release, and review tasks via the Mission Board API. Use when the user says /mission or asks about missions/tasks on the board.
---

# Mission Board

Unified skill for interacting with the Mission Board API — a central kanban board for coordinating work across agents and humans.

## How It Works

Mission Board is a **central kanban board** that coordinates work across multiple projects and agents. It runs as a standalone API server, and any project can connect to it.

### For project maintainers: installing the skill

Copy this skill into your project so agents working in it can access the board:

```bash
# Option A: project-level (agents in this repo only)
mkdir -p .claude/skills/mission
cp /path/to/SKILL.md .claude/skills/mission/SKILL.md

# Option B: global (all projects on this machine)
mkdir -p ~/.claude/skills/mission
cp /path/to/SKILL.md ~/.claude/skills/mission/SKILL.md
```

Then add guidance in your project's `CLAUDE.md` so agents know how to use it:

```markdown
## Mission Board

This project uses a central Mission Board for task coordination.
- API URL: http://your-server:3200
- Project name on the board: "<your-project-name>"

### Workflow
1. Run `/mission list --status ready` to see available tasks for this project
2. Claim a task with `/mission claim <id>` before starting work
3. Update status as you progress: `/mission update <id>`
4. When done: `/mission complete <id>`

Always check the board before starting new work.
```

### For agents: typical workflow

You are an agent working inside a project. The Mission Board tracks what needs to be done across all projects. Your workflow:

1. **Check your assignments**: `/mission` — shows your current tasks and available projects
2. **Find work**: `/mission list --status ready` — see tasks waiting to be picked up
3. **Claim a task**: `/mission claim <task-id>` — assigns the task to you
4. **Do the work**: implement the task in your project as usual
5. **Update progress**: `/mission update <task-id>` — move to `review` when ready
6. **Complete**: `/mission complete <task-id>` — mark as done when finished
7. **Blocked?**: `/mission update <task-id>` with status `blocked` — flag it and move on
8. **Can't finish?**: `/mission release <task-id>` — put it back for someone else

If `CLAUDE.md` specifies a project name or ID, use `--project` filters to scope your view to the relevant project.

---

## Setup Check

**Before executing ANY subcommand**, read the config file:

```bash
cat ~/.mission-board/config.json 2>/dev/null
```

- If the file exists and contains valid JSON with `api_url`, `agents`, and `default_agent`: proceed. Extract `api_url` and resolve the default agent's UUID from the `agents` map.
- If the file is missing or malformed: run the **First-Run Setup** below.

### First-Run Setup

Ask the user two questions, one at a time:

1. "What is the Mission Board API URL?" (default: `http://localhost:3200`)
2. "What name should this agent use?" (e.g., `alice`, `claude-dev`)

Then run:

```bash
mkdir -p ~/.mission-board && cat > ~/.mission-board/config.json << 'ENDCONFIG'
{
  "api_url": "<API_URL>",
  "agents": {
    "<AGENT_NAME>": "<GENERATED_UUID>"
  },
  "default_agent": "<AGENT_NAME>"
}
ENDCONFIG
```

Generate the UUID with: `cat /proc/sys/kernel/random/uuid` (Linux) or `uuidgen` (macOS).

After writing config, register the agent with the API (best-effort, don't fail if this errors):

```bash
curl -s -X POST "<API_URL>/api/agents" \
  -H "Content-Type: application/json" \
  -d '{"id":"<UUID>","name":"<AGENT_NAME>"}'
```

Then proceed with the original command.

---

## Subcommands

Parse the arguments passed after `/mission`. If no arguments, run **Dashboard**.

---

### Dashboard (no args)

Show the user's current task assignments and available projects.

1. Read config to get `api_url` and the default agent's UUID (`AGENT_ID`).

2. Fetch the agent's tasks:
   ```bash
   curl -s "<API_URL>/api/tasks?agent_id=<AGENT_ID>"
   ```

3. Fetch all projects:
   ```bash
   curl -s "<API_URL>/api/projects"
   ```

4. Display:
   - **My Tasks**: markdown table with `| ID (first 8 chars) | Title | Status | Type |`. If none, say "No tasks assigned."
   - **Projects**: markdown table with `| ID (first 8 chars) | Name |`

---

### `list [--status <status>] [--project <project-id>]`

List tasks with optional filters.

```bash
curl -s "<API_URL>/api/tasks?status=<STATUS>&project_id=<PROJECT_ID>"
```

Omit query params that weren't provided. Valid statuses: `backlog`, `ready`, `in_progress`, `review`, `done`, `blocked`.

Display as markdown table: `| ID (first 8 chars) | Title | Status | Type | Assignee |`

If empty: "No tasks found matching filters."

---

### `show <task-id>`

Show full details of a task.

```bash
curl -s "<API_URL>/api/tasks/<TASK_ID>"
```

Display all fields in a readable format:
- **Title**, **Description**, **Status**, **Type**
- **Project ID**, **Assignee** (agent ID or "unassigned")
- **Created**, **Updated**, **Claimed** timestamps
- **Requires Approval**: yes/no

---

### `create`

Create a new task. Gather required fields interactively.

1. Fetch and show available projects:
   ```bash
   curl -s "<API_URL>/api/projects"
   ```
   Ask user to pick a project or provide a project ID.

2. Ask for **title** (required).

3. Ask for **type** — offer choices: `implementation`, `bugfix`, `feature`, `deployment`, `documentation`, `testing`, `research`, `other`.

4. Ask for **description** (optional but encouraged).

5. Create the task:
   ```bash
   curl -s -X POST "<API_URL>/api/tasks" \
     -H "Content-Type: application/json" \
     -d '{"projectId":"<PROJECT_ID>","title":"<TITLE>","taskType":"<TYPE>","description":"<DESC>"}'
   ```

6. Confirm with the created task's ID and title.

---

### `claim <task-id>`

Claim a task for the configured agent.

1. Read config to get the default agent's UUID.

2. Claim:
   ```bash
   curl -s -X POST "<API_URL>/api/tasks/<TASK_ID>/claim" \
     -H "Content-Type: application/json" \
     -d '{"agentId":"<AGENT_ID>"}'
   ```

3. If successful: confirm "Claimed task: <title>".
4. If 409 response: "Task is already claimed by another agent."
5. If the task response shows `requiresApproval: true`: inform the user that approval may be needed for certain actions on this task.

---

### `update <task-id>`

Update a task's status, title, or description.

Ask the user what to change. At least one field is required. Build a JSON patch:

```bash
curl -s -X PATCH "<API_URL>/api/tasks/<TASK_ID>" \
  -H "Content-Type: application/json" \
  -d '{"status":"<STATUS>","title":"<TITLE>","description":"<DESC>"}'
```

Only include fields that are being changed. Valid status transitions:
- `backlog` <-> `ready` <-> `in_progress` <-> `review` <-> `done`
- Any status -> `blocked`

If the server returns a transition error, display it to the user.

---

### `complete <task-id>`

Mark a task as done, respecting approval requirements.

1. Fetch task details:
   ```bash
   curl -s "<API_URL>/api/tasks/<TASK_ID>"
   ```

2. If `requiresApproval` is `true`:
   - Create an approval request:
     ```bash
     curl -s -X POST "<API_URL>/api/approvals" \
       -H "Content-Type: application/json" \
       -d '{"taskId":"<TASK_ID>","agentId":"<AGENT_ID>","actionRequested":"complete"}'
     ```
   - Tell the user: "Approval required. Please approve on the Mission Board dashboard."
   - Offer to check approval status:
     ```bash
     curl -s "<API_URL>/api/approvals?task_id=<TASK_ID>"
     ```
     Check the latest entry's `status` field: `approved`, `denied`, or `pending`.

3. If `requiresApproval` is `false` (or after approval is confirmed):
   ```bash
   curl -s -X PATCH "<API_URL>/api/tasks/<TASK_ID>" \
     -H "Content-Type: application/json" \
     -d '{"status":"done"}'
   ```
   Confirm: "Task marked as done."

---

### `release <task-id>`

Release a claimed task back to the pool.

1. Fetch task title first:
   ```bash
   curl -s "<API_URL>/api/tasks/<TASK_ID>"
   ```

2. Release:
   ```bash
   curl -s -X POST "<API_URL>/api/tasks/<TASK_ID>/release"
   ```

3. Confirm: "Released task: <title>"

---

### `review <task-id>`

View review comments and feedback on a task.

```bash
curl -s "<API_URL>/api/tasks/<TASK_ID>/comments"
```

Display each comment with:
- **Author** (agent name or reviewer)
- **Timestamp** (formatted readably)
- **Content**

If comments contain actionable feedback (requested changes, bugs, suggestions), summarize what needs to be done as a bullet list.

---

## Error Handling

- **Config missing**: trigger First-Run Setup
- **API unreachable** (curl fails / connection refused): "Cannot reach Mission Board API at <url>. Is the server running?"
- **404**: "Task not found."
- **409 on claim**: "Task already claimed by another agent."
- **400 validation error**: display the error message from the response
- **Invalid status transition**: display the server's error message showing valid transitions
