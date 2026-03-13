# Cross-Area Flows for Mission Board System

Complete enumeration of all cross-area flows involving CLI (Agent), Dashboard (Human), and API interactions.

---

## Flow 1: Agent Creates Task via CLI → Human Sees It on Dashboard

### Sequence of Actions
1. **CLI** → Agent runs: `mission create --project <project-id> --title "Task Title" --type implementation`
2. **CLI** → Reads agent_id from `~/.mission-board/config.json`
3. **API Client** → POST `/api/tasks` with `{ agent_id, project_id, title, task_type, description?, requires_approval? }`
4. **API** → Validates input with Zod schema
5. **API** → Creates task record with `status: "backlog"`, generates UUID
6. **API** → Creates `task_logs` entry with `{ action: "created", agent_id, details: {...} }`
7. **API** → Returns 201 with created task object
8. **CLI** → Displays: `✓ Task <task-id> created successfully`
9. **Dashboard** → React Query polling (5s interval) fetches updated task list
10. **Dashboard** → Kanban board shows new task in "Backlog" column

### What Updates in Each System
| System | Update |
|--------|--------|
| Database | `tasks` table: new row with status=backlog |
| Database | `task_logs` table: new row with action=created |
| CLI | Console output confirming creation |
| Dashboard | New task card appears in Backlog column (within 5s) |

### What User/Agent Sees at Each Step
| Step | Agent (CLI) | Human (Dashboard) |
|------|-------------|-------------------|
| 1-3 | Command in progress (spinner) | No change |
| 4-7 | Waiting for response | No change |
| 8 | Success message with task ID | No change |
| 9-10 | Command complete | New task card appears |

### Error Scenarios
| Error | API Response | CLI Behavior | Dashboard Impact |
|-------|--------------|--------------|------------------|
| Invalid project_id | 404 Not Found | `✗ Error: Project not found` | None |
| Missing required fields | 400 Bad Request | `✗ Error: Missing required field: title` | None |
| Duplicate task title in project | 409 Conflict | `✗ Error: Task with this title already exists in project` | None |
| API server unreachable | Network error | `✗ Error: Cannot connect to API server` | None |
| Invalid agent_id | 400 Bad Request | `✗ Error: Invalid agent ID` | None |

---

## Flow 2: Agent Claims Task → Dashboard Updates in Real-Time

### Sequence of Actions
1. **CLI** → Agent runs: `mission claim <task-id>`
2. **CLI** → Reads agent_id from config file
3. **API Client** → POST `/api/tasks/<task-id>/claim` with `{ agent_id }`
4. **API** → Validates task exists
5. **API** → Checks task status is `backlog` or `ready` (not already claimed)
6. **API** → Updates task: `status: "in_progress"`, `agent_id`, `claimed_at: now()`
7. **API** → Creates `task_logs` entry with `{ action: "claimed", agent_id, details: {...} }`
8. **API** → Returns 200 with updated task
9. **CLI** → Displays: `✓ Task <task-id> claimed successfully. Status: in_progress`
10. **Dashboard** → Polling detects change (within 5s)
11. **Dashboard** → Task card moves from "Backlog/Ready" to "In Progress" column
12. **Dashboard** → Task card shows agent name/avatar

### What Updates in Each System
| System | Update |
|--------|--------|
| Database | `tasks` table: status=in_progress, agent_id set, claimed_at set |
| Database | `task_logs` table: action=claimed |
| CLI | Success message with new status |
| Dashboard | Task moves to In Progress, agent badge appears |

### What User/Agent Sees at Each Step
| Step | Agent (CLI) | Human (Dashboard) |
|------|-------------|-------------------|
| 1-3 | Command in progress | No change |
| 4-8 | Waiting for response | No change |
| 9 | Success message | No change |
| 10-12 | Command complete | Task moves to In Progress, agent shown |

### Conflict Scenarios
| Conflict | Detection | Resolution | User Experience |
|----------|-----------|------------|-----------------|
| Two agents claim same task simultaneously | Database constraint or optimistic lock | First write wins, second gets 409 | Second agent sees `✗ Task already claimed by agent-xxx` |
| Task status changed between read and claim | Status check in claim handler | Reject with 409 | Agent sees `✗ Task cannot be claimed (current status: review)` |
| Agent claims task they already own | agent_id check | Idempotent success (200) | Agent sees success, no state change |

### Error Scenarios
| Error | API Response | CLI Behavior | Dashboard Impact |
|-------|--------------|--------------|------------------|
| Task not found | 404 Not Found | `✗ Error: Task not found` | None |
| Task already claimed | 409 Conflict | `✗ Error: Task already claimed by agent-xxx` | None |
| Invalid task status for claim | 400 Bad Request | `✗ Error: Cannot claim task with status: done` | None |

---

## Flow 3: Agent Requests Approval → Human Approves → Agent Sees Result

### Sequence of Actions
1. **CLI** → Agent completes work, runs: `mission request-approval <task-id> --action "complete" --notes "Feature implemented"`
2. **API Client** → POST `/api/approvals` with `{ task_id, agent_id, action_requested, notes }`
3. **API** → Creates `approval_requests` row with `status: "pending"`
4. **API** → Updates task status to `review`
5. **API** → Creates `task_logs` entries for status change and approval request
6. **API** → Returns 201 with approval request
7. **CLI** → Displays: `✓ Approval request submitted. Task moved to Review status.`
8. **Dashboard** → Polling updates (within 5s)
9. **Dashboard** → Task appears in "Review" column
10. **Dashboard** → Approval indicator/badge on task
11. **Human** → Navigates to task detail or approvals queue
12. **Human** → Clicks "Approve" button
13. **Dashboard** → POST `/api/approvals/<approval-id>/approve`
14. **API** → Updates approval_requests: `status: "approved"`, `reviewed_by`, `reviewed_at`
15. **API** → Updates task status to `done` (or action-specific status)
16. **API** → Creates `task_logs` entry with `{ action: "approved", details: {...} }`
17. **API** → Returns 200
18. **Dashboard** → Shows success toast
19. **Dashboard** → Task moves to "Done" column
20. **Agent CLI** → Agent runs: `mission status <task-id>` or polling in long-running command
21. **CLI** → Displays: `✓ Task approved. Status: done`

### What Updates in Each System
| System | Update |
|--------|--------|
| Database | `approval_requests`: new row pending → approved |
| Database | `tasks`: status review → done, updated_at |
| Database | `task_logs`: approval_requested, approved entries |
| CLI (agent) | Approval request confirmation, later status update |
| Dashboard | Task in Review with badge → Task in Done, approval notification |

### What User/Agent Sees at Each Step
| Step | Agent (CLI) | Human (Dashboard) |
|------|-------------|-------------------|
| 1-7 | Approval request submitted | No change |
| 8-10 | No change | Task appears in Review with approval badge |
| 11-12 | No change | Viewing approval request |
| 13-18 | No change | Success toast, task moves to Done |
| 20-21 | Sees approved status | No change |

### Denial Flow (Alternative)
| Step | Action | Result |
|------|--------|--------|
| 1-10 | Same as approval flow | Task in Review |
| 11-12 | Human clicks "Deny" | Confirmation dialog |
| 13-17 | POST `/api/approvals/<id>/deny` | status=denied, task status=backlog or blocked |
| 18-19 | Dashboard shows denial | Task returns to appropriate column |
| 20-21 | Agent sees denial with notes | `✗ Task denied. Reason: [notes]. Status: blocked` |

### Error Scenarios
| Error | API Response | CLI/Dashboard Behavior |
|-------|--------------|------------------------|
| Task not eligible for approval | 400 Bad Request | `✗ Task status must be in_progress or review` |
| Approval already processed | 409 Conflict | Dashboard shows "Approval already processed" |
| Non-existent approval | 404 Not Found | Dashboard shows error toast |

---

## Flow 4: Agent Completes Task → Stats Update in Analytics

### Sequence of Actions
1. **CLI** → Agent runs: `mission complete <task-id>` (if no approval required)
2. **API Client** → PATCH `/api/tasks/<task-id>` with `{ status: "done" }`
3. **API** → Validates status transition
4. **API** → Updates task: `status: "done"`, `updated_at: now()`
5. **API** → Creates `task_logs` entry with `{ action: "updated", details: { old_status, new_status: "done" } }`
6. **API** → Returns 200 with updated task
7. **CLI** → Displays: `✓ Task <task-id> completed`
8. **Dashboard** → Polling detects change
9. **Dashboard** → Task moves to "Done" column
10. **Dashboard** → Analytics component recalculates stats
11. **Dashboard** → Charts update: tasks completed +1, velocity metrics recalculate

### What Updates in Each System
| System | Update |
|--------|--------|
| Database | `tasks`: status=done, updated_at |
| Database | `task_logs`: action=updated |
| CLI | Completion confirmation |
| Dashboard | Task in Done, analytics charts updated |

### Analytics Impact
| Metric | Update |
|--------|--------|
| Tasks completed (period) | +1 |
| Agent velocity (tasks/week) | Recalculated |
| Project progress % | Recalculated |
| Average task duration | Recalculated |
| Bottleneck detection | Updated |

### Error Scenarios
| Error | API Response | CLI Behavior |
|-------|--------------|--------------|
| Task requires approval | 400 Bad Request | `✗ Task requires approval. Use 'mission request-approval'` |
| Invalid status transition | 400 Bad Request | `✗ Cannot transition from 'backlog' to 'done'` |
| Task not found | 404 Not Found | `✗ Task not found` |

---

## Flow 5: Project Creation → Multiple Tasks Created → Agents Claim Tasks

### Sequence of Actions
1. **Dashboard** → Human creates project via form
2. **Dashboard** → POST `/api/projects` with `{ name, description }`
3. **API** → Creates `projects` row
4. **API** → Returns 201 with project
5. **Dashboard** → Shows project created, navigates to project view
6. **Dashboard** → Human creates tasks (bulk or individual)
7. **Dashboard** → POST `/api/tasks` for each task with `{ project_id, title, ... }`
8. **API** → Creates `tasks` rows with `status: "backlog"`
9. **API** → Creates `task_logs` for each
10. **Dashboard** → Kanban shows all tasks in Backlog
11. **Agent CLI** → Agent lists available tasks: `mission list --project <project-id> --status ready`
12. **API** → GET `/api/tasks?project_id=xxx&status=ready`
13. **API** → Returns task list
14. **CLI** → Displays tasks in table format
15. **Agent CLI** → Agent claims task: `mission claim <task-id>`
16. **API** → Updates task: status=in_progress, agent_id
17. **Dashboard** → Task moves to In Progress with agent badge
18. **Repeat 11-17** for other agents/tasks

### What Updates in Each System
| System | Update |
|--------|--------|
| Database | `projects`: new row |
| Database | `tasks`: multiple rows for project |
| Database | `task_logs`: creation entries |
| Dashboard | New project card, task cards in Backlog |
| CLI (multiple agents) | Task lists, claimed tasks |

### Concurrent Claim Scenario
| Scenario | Behavior |
|----------|----------|
| 3 agents list same tasks | All see same task list |
| 3 agents claim different tasks | All succeed, tasks distributed |
| 2 agents claim same task | First wins, second gets 409 Conflict |

### Error Scenarios
| Error | System | Behavior |
|-------|--------|----------|
| Project name duplicate | API | 409 Conflict, dashboard shows error |
| Task creation fails mid-batch | API | Partial success, show which failed |
| Project deleted while tasks created | API | 404 for remaining creates |

---

## Flow 6: Multi-Project: Agent Works Across Projects

### Sequence of Actions
1. **CLI** → Agent lists all projects: `mission projects`
2. **API** → GET `/api/projects`
3. **API** → Returns project list
4. **CLI** → Displays projects in table
5. **CLI** → Agent lists tasks across projects: `mission list --all`
6. **API** → GET `/api/tasks` (no project filter)
7. **API** → Returns all tasks (optionally filtered by agent_id)
8. **CLI** → Displays tasks grouped by project
9. **CLI** → Agent claims task in Project A: `mission claim <task-a-id>`
10. **API** → Updates task in Project A
11. **CLI** → Agent claims task in Project B: `mission claim <task-b-id>`
12. **API** → Updates task in Project B
13. **CLI** → Agent views their workload: `mission my-tasks`
14. **API** → GET `/api/agents/<agent-id>/tasks`
15. **API** → Returns all tasks assigned to agent
16. **CLI** → Displays tasks across all projects
17. **Dashboard** → Shows tasks from both projects in agent's name

### What Updates in Each System
| System | Update |
|--------|--------|
| CLI | Project list, task lists from multiple projects |
| Dashboard | Agent's tasks visible in multiple project views |
| Database | Tasks in Project A and B both reference same agent_id |

### Cross-Project View in Dashboard
| View | Content |
|------|---------|
| Project A board | Tasks from Project A (some assigned to agent) |
| Project B board | Tasks from Project B (some assigned to agent) |
| Agent detail view | All tasks assigned to agent across projects |
| Global analytics | Metrics aggregated across projects |

### Error Scenarios
| Error | Behavior |
|-------|----------|
| Project deleted while agent has tasks | Tasks orphaned, show warning in dashboard |
| Agent exceeds concurrent task limit (if configured) | 400 Bad Request on claim |

---

## Flow 7: Full Lifecycle: Create → Claim → In Progress → Review → Done

### Complete Sequence

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           TASK LIFECYCLE                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  [backlog] ──► [ready] ──► [in_progress] ──► [review] ──► [done]           │
│      │           │              │              │             │               │
│      │           │              │              │             │               │
│   Created    Prioritized   Agent claimed   Submitted for   Approved/       │
│   (CLI/API)  (Dashboard)   (CLI)          review (CLI)     Auto-complete   │
│                                            or blocked                        │
│                                                                              │
│                           Alternative paths:                                 │
│  [in_progress] ──► [blocked] ──► [in_progress]                             │
│  [review] ──► [denied] ──► [backlog/blocked]                               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Detailed Steps

| Phase | Action | Actor | System | API Call | Status Change |
|-------|--------|-------|--------|----------|---------------|
| 1. Create | Create task | Agent | CLI | POST /api/tasks | null → backlog |
| 2. Ready | Mark ready | Human | Dashboard | PATCH /api/tasks/:id | backlog → ready |
| 3. Claim | Claim task | Agent | CLI | POST /api/tasks/:id/claim | ready → in_progress |
| 4. Work | Work on task | Agent | CLI | (no API call, local work) | - |
| 5. Review | Request approval | Agent | CLI | POST /api/approvals | in_progress → review |
| 6. Approve | Approve request | Human | Dashboard | POST /api/approvals/:id/approve | review → done |
| | OR Deny | Human | Dashboard | POST /api/approvals/:id/deny | review → blocked |

### Each Step Details

#### Phase 1: Create
- **CLI**: `mission create --project proj-123 --title "Implement auth"`
- **API**: Creates task with status=backlog
- **Dashboard**: Task appears in Backlog within 5s

#### Phase 2: Ready
- **Dashboard**: Human clicks "Ready" on task card
- **API**: PATCH updates status to ready
- **CLI**: Agent can now see task in `mission list --status ready`

#### Phase 3: Claim
- **CLI**: `mission claim task-456`
- **API**: Sets status=in_progress, agent_id, claimed_at
- **Dashboard**: Task moves to In Progress, shows agent

#### Phase 4: Work
- **CLI**: Agent works locally (no system updates)
- **Optional**: `mission update task-456 --notes "50% complete"`

#### Phase 5: Review
- **CLI**: `mission request-approval task-456 --notes "Ready for review"`
- **API**: Creates approval_request, sets status=review
- **Dashboard**: Task in Review column, approval badge

#### Phase 6: Approve/Deny
- **Approve Path**:
  - Dashboard: Click Approve
  - API: Update approval status=approved, task status=done
  - Dashboard: Task moves to Done
  - CLI: `mission status task-456` shows done

- **Deny Path**:
  - Dashboard: Click Deny, add reason
  - API: Update approval status=denied, task status=blocked
  - Dashboard: Task in Blocked column
  - CLI: Agent sees denial reason

### Status Transition Rules
| From | To | Allowed Actors | Conditions |
|------|-----|----------------|------------|
| null | backlog | Agent, Human | Valid project_id |
| backlog | ready | Human only | - |
| backlog | in_progress | Agent (claim) | Not claimed |
| ready | in_progress | Agent (claim) | Not claimed |
| in_progress | review | Agent | requires_approval=true |
| in_progress | done | Agent | requires_approval=false |
| in_progress | blocked | Agent, Human | - |
| review | done | Human | Approval approved |
| review | blocked | Human | Approval denied |
| blocked | in_progress | Agent, Human | - |

---

## Flow 8: Blocked Task Flow

### Sequence of Actions

#### Blocking a Task
1. **CLI** → Agent encounters blocker: `mission block <task-id> --reason "Waiting for API credentials"`
2. **API Client** → PATCH `/api/tasks/<task-id>` with `{ status: "blocked" }`
3. **API** → Validates transition from current status
4. **API** → Updates task: `status: "blocked"`, `updated_at`
5. **API** → Creates `task_logs` entry with `{ action: "updated", details: { reason, blocked_at } }`
6. **API** → Returns 200
7. **CLI** → Displays: `✓ Task blocked. Reason: Waiting for API credentials`
8. **Dashboard** → Task moves to "Blocked" column
9. **Dashboard** → Blocked indicator with reason shown

#### Unblocking a Task
10. **CLI/Dashboard** → Blocker resolved
11. **CLI**: `mission unblock <task-id>` OR Dashboard: Click "Unblock"
12. **API Client** → PATCH `/api/tasks/<task-id>` with `{ status: "in_progress" }`
13. **API** → Updates task status back to in_progress
14. **API** → Creates `task_logs` entry
15. **CLI/Dashboard** → Task returns to In Progress

### What Updates in Each System
| System | Update |
|--------|--------|
| Database | tasks: status=blocked → in_progress |
| Database | task_logs: blocked/unblocked events |
| CLI | Block confirmation with reason |
| Dashboard | Task in Blocked column with reason badge |

### Blocked Task Visibility
| View | What's Shown |
|------|--------------|
| Kanban Blocked column | All blocked tasks |
| Task detail | Block reason, time blocked |
| Agent's task list | Blocked tasks with indicator |
| Analytics | Blocked task count, avg block time |

### Error Scenarios
| Error | Response | Behavior |
|-------|----------|----------|
| Cannot block completed task | 400 Bad Request | `✗ Cannot block task with status: done` |
| Missing block reason | 400 Bad Request | `✗ Block reason required` |
| Unblock non-blocked task | 400 Bad Request | `✗ Task is not blocked` |

---

## Flow 9: Agent Registration on First CLI Use

### Sequence of Actions

#### First-Time Setup (No Config)
1. **CLI** → Agent runs any command (e.g., `mission list`)
2. **CLI** → Checks for `~/.mission-board/config.json`
3. **CLI** → File not found, prompts (or auto-generates) agent registration
4. **CLI** → Generates unique agent name (e.g., `agent-<hostname>-<timestamp>`)
5. **API Client** → POST `/api/agents` with `{ name: "agent-xxx" }`
6. **API** → Creates `agents` row with new UUID
7. **API** → Returns 201 with `{ id, name, created_at }`
8. **CLI** → Creates `~/.mission-board/config.json` with `{ agent_id, agent_name, api_url }`
9. **CLI** → Displays: `✓ Agent registered: agent-xxx (ID: <uuid>)`
10. **CLI** → Proceeds with original command

#### Subsequent Uses
11. **CLI** → Agent runs command
12. **CLI** → Reads agent_id from config
13. **API Client** → Includes agent_id in request
14. **API** → Updates `agents.last_seen_at` (optional, on any request)

### Config File Structure
```json
{
  "agent_id": "uuid-here",
  "agent_name": "agent-hostname-123",
  "api_url": "http://localhost:3200",
  "created_at": "2026-03-13T12:00:00Z"
}
```

### What Updates in Each System
| System | Update |
|--------|--------|
| Database | `agents`: new row |
| Filesystem | `~/.mission-board/config.json` created |
| CLI | Agent ID stored, used in subsequent requests |
| Dashboard | Agent appears in agents list |

### Error Scenarios
| Error | Response | CLI Behavior |
|-------|----------|--------------|
| API unreachable during registration | Network error | `✗ Cannot connect to API. Set API_URL env var or use --api-url flag` |
| Agent name already exists | 409 Conflict | Auto-generate new unique name and retry |
| Config directory not writable | Filesystem error | `✗ Cannot create config directory. Check permissions` |
| Config corrupted | Parse error | Prompt for re-registration |

### Dashboard Agent View
After registration:
- Agents list shows new agent
- Agent detail shows: name, created_at, last_seen_at, tasks count

---

## Flow 10: Error Propagation from API to CLI and Dashboard

### Error Categories

| Category | HTTP Status | Examples |
|----------|-------------|----------|
| Validation | 400 | Missing fields, invalid enum values |
| Not Found | 404 | Task/project/agent doesn't exist |
| Conflict | 409 | Duplicate, already claimed |
| Server Error | 500 | Database error, unexpected exception |

### Error Response Format
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid status value. Must be one of: backlog, ready, in_progress, review, done, blocked",
    "details": {
      "field": "status",
      "received": "invalid_status"
    }
  }
}
```

### API → CLI Error Flow

1. **API** → Validation fails or business rule violated
2. **API** → Returns error response with status code and JSON body
3. **API Client** → Parses error response
4. **CLI** → Maps error code to user-friendly message
5. **CLI** → Displays error with colored output (red for errors)
6. **CLI** → Exits with code 1

#### CLI Error Display Examples
```
# Validation Error
✗ Error: Invalid status 'invalid_status'
  Valid options: backlog, ready, in_progress, review, done, blocked

# Not Found
✗ Error: Task 'task-123' not found

# Conflict
✗ Error: Task already claimed by agent-456

# Network Error
✗ Error: Cannot connect to API at http://localhost:3200
  Check if the server is running or set API_URL environment variable
```

### API → Dashboard Error Flow

1. **API** → Returns error response
2. **React Query** → Catches error, sets error state
3. **Dashboard** → Error boundary or error state UI
4. **Dashboard** → Shows toast notification or inline error
5. **Dashboard** → Offers retry action

#### Dashboard Error Display

| Error Type | UI Treatment |
|------------|--------------|
| Validation (form) | Field-level error message |
| Not Found | Empty state with message |
| Conflict | Toast notification with action |
| Network | Banner with retry button |
| Server Error | Error boundary with refresh option |

### Real-Time Sync Error Handling

| Scenario | CLI Behavior | Dashboard Behavior |
|----------|--------------|-------------------|
| Poll fails (network) | N/A (not polling) | Show "Disconnected" indicator, retry automatically |
| Poll fails (auth) | N/A | Show login prompt (if auth added) |
| Optimistic update fails | N/A | Rollback UI, show error toast |
| Conflict on save | Show conflict message | Merge prompt or error |

### Data Consistency Error Scenarios

| Scenario | Detection | Resolution |
|----------|-----------|------------|
| Task deleted while editing | 404 on PATCH | CLI: "Task no longer exists"; Dashboard: Remove from list |
| Task modified by another agent | Status mismatch in response | Dashboard: Show latest data, notify user |
| Database constraint violation | 500 or 409 | Rollback, show error, suggest retry |

### Error Logging

| System | What's Logged |
|--------|---------------|
| API | Request details, error stack traces, timestamps |
| CLI | Errors written to `~/.mission-board/logs/` |
| Dashboard | Console errors, optionally sent to monitoring |

---

## Data Consistency & Conflict Summary

### Concurrency Model
- **Database**: SQLite WAL mode (multiple readers, single writer)
- **API**: Stateless, horizontally scalable
- **Dashboard**: React Query polling every 5 seconds
- **CLI**: Synchronous operations, no local caching

### Conflict Detection Points
| Operation | Conflict Type | Detection |
|-----------|--------------|-----------|
| Claim task | Race condition | Database constraint / status check |
| Update status | Lost update | Optimistic locking (updated_at check) |
| Create task | Duplicate | Unique constraint on (project_id, title) |
| Approve request | Double approval | Status check in approval handler |

### Consistency Guarantees
| Guarantee | Implementation |
|-----------|----------------|
| Task status is always valid | Status transition validation in API |
| Agent can only claim unclaimed tasks | Database-level check |
| Approval processed once | Status check before approve/deny |
| Logs are immutable | Append-only task_logs table |

### Real-Time Sync Latency
| Action | CLI Visibility | Dashboard Visibility |
|--------|----------------|----------------------|
| Create task | Immediate | Within 5s (polling) |
| Claim task | Immediate | Within 5s (polling) |
| Status change | Immediate | Within 5s (polling) |
| Approval | On next status check | Within 5s (polling) |

---

## Summary: Cross-Area Flow Matrix

| Flow | CLI → API | Dashboard → API | API → CLI | API → Dashboard | Real-Time |
|------|-----------|-----------------|-----------|-----------------|-----------|
| 1. Create Task | ✓ | - | ✓ Response | ✓ Polling | 5s delay |
| 2. Claim Task | ✓ | - | ✓ Response | ✓ Polling | 5s delay |
| 3. Approval | ✓ Request | ✓ Approve | ✓ Status | ✓ Polling | 5s delay |
| 4. Complete Task | ✓ | - | ✓ Response | ✓ Polling | 5s delay |
| 5. Project + Tasks | - | ✓ Create | ✓ List/Claim | ✓ Polling | 5s delay |
| 6. Multi-Project | ✓ Query | ✓ View | ✓ Response | ✓ Polling | 5s delay |
| 7. Full Lifecycle | ✓ All | ✓ Transitions | ✓ Responses | ✓ Polling | 5s delay |
| 8. Blocked | ✓ Block | ✓ Unblock | ✓ Response | ✓ Polling | 5s delay |
| 9. Registration | ✓ Register | - | ✓ Config | ✓ List | N/A |
| 10. Error | ✓ Request | ✓ Request | ✓ Error | ✓ Error | Immediate |

---

## Files Created/Modified
- `/home/roach/mission-board/.factory/library/cross-area-flows.md` - This document
