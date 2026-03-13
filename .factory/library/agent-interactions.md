# Agent Management Interactions

Complete enumeration of all agent interactions in the Mission Board system.

---

## 1. Agent Registration

### 1.1 Automatic Registration (Recommended)

**Interaction:** Agent uses CLI for first time without explicit registration

**What happens:**
- Agent runs any CLI command with `--agent-id <uuid>` or `MISSION_AGENT_ID` env var
- System detects agent_id doesn't exist
- System automatically creates agent record with:
  - `id`: provided UUID
  - `name`: null or auto-generated (e.g., "Agent-{short-uuid}")
  - `created_at`: current timestamp
  - `last_seen_at`: current timestamp
- Command proceeds normally

**Agent expects:**
- Seamless first-use experience
- No extra registration step
- Immediate access to all agent operations

**Error conditions:**
- Invalid UUID format → 400 error, command fails
- UUID collision with existing agent → Uses existing agent (no error)
- Database write failure → 500 error, command fails

**Edge cases:**
- What if agent provides empty string? → Reject with validation error
- What if agent provides very long string? → Validate UUID format only
- Concurrent first-use from same agent_id → One wins, both proceed

### 1.2 Explicit Registration

**Interaction:** Agent explicitly registers via `agent register` command

```
mission-agent agent register --name "My Worker"
```

**What happens:**
- Agent provides name (optional)
- System generates new UUID
- Creates agent record with provided name
- Returns agent_id to agent
- Agent should save this ID for future use

**Agent expects:**
- Unique agent_id returned
- Ability to set custom name
- Confirmation of successful registration

**Error conditions:**
- Name too long (>255 chars) → 400 error
- Name contains invalid characters → Validate: alphanumeric, spaces, hyphens, underscores
- Database failure → 500 error

**Edge cases:**
- Duplicate name allowed? → Yes, names not unique
- Empty name provided → Accept and store null
- Name with emojis → Accept if UTF-8 supported

---

## 2. Viewing Agents

### 2.1 List All Agents

**Interaction:** Human views all agents via CLI or Dashboard

**CLI:**
```
mission-agent agent list
mission-agent agent list --format json
mission-agent agent list --sort last_seen
```

**What happens:**
- System queries all agents from database
- Returns ordered list with: id, name, created_at, last_seen_at
- Optional sorting by: name, created_at, last_seen_at
- Optional filtering by: active (seen in last X hours)

**User expects:**
- Quick overview of all agents
- See which agents are active/stale
- Pagination for large numbers of agents

**Error conditions:**
- No agents exist → Empty list, not an error
- Database failure → 500 error
- Invalid sort parameter → 400 error

**Edge cases:**
- 1000+ agents → Pagination required (default limit: 50)
- Agent never seen (last_seen_at null) → Show as "Never"
- Sorting by null last_seen_at → Nulls last or first?

### 2.2 Get Agent Detail

**Interaction:** View single agent's full information

**CLI:**
```
mission-agent agent show <agent-id>
mission-agent agent show <agent-id> --stats
```

**API:**
```
GET /api/agents/:id
```

**What happens:**
- System retrieves agent by ID
- Returns: id, name, created_at, last_seen_at
- Optional: include aggregated stats (tasks completed, active tasks, etc.)

**User expects:**
- Complete agent information
- Optional performance metrics
- 404 if agent doesn't exist

**Error conditions:**
- Agent not found → 404 error
- Invalid UUID format → 400 error
- Database failure → 500 error

**Edge cases:**
- Agent with no activity → Stats all zeros
- Very long agent name → Display truncation in CLI
- Include deleted agent? → No, agents not soft-deleted

---

## 3. Agent Task History

### 3.1 List Agent's Tasks

**Interaction:** View all tasks associated with an agent

**CLI:**
```
mission-agent agent tasks <agent-id>
mission-agent agent tasks <agent-id> --status done
mission-agent agent tasks <agent-id> --limit 20
```

**API:**
```
GET /api/agents/:id/tasks?status=done&limit=20
```

**What happens:**
- System queries tasks where agent_id matches
- Supports filtering by status
- Supports pagination
- Returns task list with basic fields

**User expects:**
- See agent's workload
- Filter by task status
- Chronological order (most recent first)

**Error conditions:**
- Agent not found → 404 error
- Invalid filter parameters → 400 error
- Database failure → 500 error

**Edge cases:**
- Agent has no tasks → Empty list
- Agent has 500+ tasks → Pagination required
- Tasks spanning multiple projects → All returned, include project info

### 3.2 Agent's Task Log History

**Interaction:** View all task logs for an agent

**CLI:**
```
mission-agent agent logs <agent-id>
mission-agent agent logs <agent-id> --action claimed
```

**API:**
```
GET /api/logs?agent_id=<agent-id>
```

**What happens:**
- System queries task_logs where agent_id matches
- Returns: action, task_id, details, created_at
- Filterable by action type

**User expects:**
- Audit trail of agent actions
- Timeline of activity
- Details of what changed

**Error conditions:**
- Agent not found → 404 (or empty list if agent might exist)
- Invalid action filter → 400 error
- Database failure → 500 error

**Edge cases:**
- No logs → Empty list
- Logs older than X days → Include all by default, optional date filter
- Large detail JSON → Return as-is or summary?

---

## 4. Agent Activity/Performance

### 4.1 Agent Statistics

**Interaction:** View aggregated performance metrics for an agent

**CLI:**
```
mission-agent agent stats <agent-id>
```

**API:**
```
GET /api/agents/:id/stats
```

**What happens:**
- System calculates:
  - Total tasks created
  - Total tasks claimed
  - Tasks completed (status = done)
  - Tasks in progress
  - Average time to completion
  - Approval rate (approved / total approvals requested)
  - Last activity timestamp

**User expects:**
- Performance overview
- Comparison capability between agents
- Real-time metrics

**Error conditions:**
- Agent not found → 404 error
- Database failure → 500 error

**Edge cases:**
- Agent with no activity → All stats return 0/null
- Division by zero (approval rate) → Return null or N/A
- Very old tasks → Include in historical stats

### 4.2 Activity Timeline

**Interaction:** View agent's activity over time

**CLI:**
```
mission-agent agent activity <agent-id> --days 7
```

**API:**
```
GET /api/agents/:id/activity?days=7
```

**What happens:**
- System aggregates task_logs by day/hour
- Returns: timestamp buckets with action counts
- Useful for visualizations

**User expects:**
- See activity patterns
- Identify peak activity times
- Detect inactive periods

**Error conditions:**
- Agent not found → 404 error
- Invalid days parameter → 400 error
- Database failure → 500 error

**Edge cases:**
- No activity in range → Empty buckets
- Future dates requested → 400 error or empty
- Very large date range → Limit to max 365 days

---

## 5. Agent Heartbeat/Last_Seen Tracking

### 5.1 Automatic Heartbeat

**Interaction:** Agent performs any CLI operation

**What happens:**
- Every CLI command updates `last_seen_at` to current timestamp
- Update happens at start of request processing
- Agent doesn't need to explicitly call heartbeat
- Implicit tracking via task operations, queries, etc.

**Agent expects:**
- Transparent tracking
- No extra API calls needed
- Always up-to-date last_seen

**Error conditions:**
- Update fails → Don't fail the main operation, log warning
- Concurrent updates → Last write wins (acceptable)

**Edge cases:**
- Agent crashes mid-operation → last_seen_at already updated (acceptable)
- Very frequent operations → Throttling? No, SQLite handles it
- Clock skew → Use server timestamp always

### 5.2 Explicit Heartbeat

**Interaction:** Agent sends explicit keep-alive signal

**CLI:**
```
mission-agent agent heartbeat
mission-agent agent heartbeat --agent-id <uuid>
```

**API:**
```
POST /api/agents/:id/heartbeat
```

**What happens:**
- Updates `last_seen_at` to current timestamp
- Returns success acknowledgment
- Used when agent is idle but still alive

**Agent expects:**
- Simple, fast operation
- Confirmation of liveness update
- Low overhead

**Error conditions:**
- Agent not found → Auto-create if using auto-registration, else 404
- Database failure → 500 error

**Edge cases:**
- Heartbeat flood from same agent → Rate limit? Optional
- Agent sends heartbeat while performing other ops → Redundant but harmless

### 5.3 Stale Agent Detection

**Interaction:** System/Dashboard identifies inactive agents

**Dashboard view:**
- Agents with `last_seen_at` older than threshold highlighted
- Configurable threshold (default: 1 hour, 24 hours, 7 days)
- Visual indicators: green (active), yellow (stale), red (very stale)

**API:**
```
GET /api/agents?active_within=3600  # seconds
```

**User expects:**
- Identify dead/abandoned agents
- Clean up old agents
- Monitor agent health

**Error conditions:**
- Invalid threshold parameter → 400 error
- Database failure → 500 error

**Edge cases:**
- Agent intentionally idle → Distinguish from dead?
- Threshold of 0 → Return all agents
- Negative threshold → 400 error

---

## 6. Agent Management Operations

### 6.1 Update Agent Name

**Interaction:** Agent or admin updates agent's display name

**CLI:**
```
mission-agent agent rename <agent-id> --name "Better Name"
```

**API:**
```
PATCH /api/agents/:id
{ "name": "Better Name" }
```

**What happens:**
- Validates new name (length, characters)
- Updates agent record
- Returns updated agent

**User expects:**
- Name change reflected immediately
- Validation feedback if name invalid

**Error conditions:**
- Agent not found → 404 error
- Invalid name → 400 error with details
- Database failure → 500 error

**Edge cases:**
- Name unchanged → Return success without update
- Empty name → Set to null or reject?
- Concurrent updates → Last write wins

### 6.2 Delete Agent (Optional Feature)

**Interaction:** Admin removes an agent from the system

**CLI:**
```
mission-agent agent delete <agent-id> --force
```

**API:**
```
DELETE /api/agents/:id
```

**What happens:**
- Without `--force`: Fails if agent has any tasks
- With `--force`: Deletes agent, sets agent_id to null on all tasks
- Creates audit log entry

**User expects:**
- Clear warning about task orphaning
- Confirmation prompt (CLI)
- Ability to preserve task history

**Error conditions:**
- Agent not found → 404 error
- Agent has tasks (no force) → 409 Conflict error
- Database failure → 500 error

**Edge cases:**
- Agent has logs → Logs preserved with agent_id (or cascade delete?)
- Concurrent task creation during delete → Use transaction
- Re-register with same UUID → Creates new agent (no resurrection)

---

## 7. Error Handling Summary

| Error Type | HTTP Code | CLI Exit Code | Example |
|------------|-----------|---------------|---------|
| Invalid input | 400 | 1 | Bad UUID, invalid name |
| Not found | 404 | 1 | Agent doesn't exist |
| Conflict | 409 | 1 | Agent has tasks, can't delete |
| Server error | 500 | 2 | Database failure |

---

## 8. Security Considerations

### 8.1 No Authentication

**Implications:**
- Any agent_id can access any agent's data
- Deletion should be restricted (admin only?)
- Consider rate limiting per agent_id

### 8.2 Input Validation

**Required validations:**
- UUID format validation
- Name length (max 255)
- Name characters (alphanumeric, spaces, -, _)
- Pagination limits (max 100)

---

## 9. Open Questions

1. **Agent naming convention enforcement?**
   - Enforce unique names? Currently: No
   - Validate format? Suggested: alphanumeric + spaces + -_

2. **Agent deletion strategy?**
   - Soft delete vs hard delete?
   - Orphan task handling: null or preserve agent_id?

3. **Heartbeat throttling?**
   - Rate limit explicit heartbeats?
   - Implicit updates always allowed?

4. **Stale agent cleanup?**
   - Auto-delete agents inactive for X days?
   - Archive instead of delete?

5. **Agent metadata?**
   - Store additional agent info (version, capabilities)?
   - Extend schema with JSON metadata field?
