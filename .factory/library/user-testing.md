# User Testing

Testing surface, validation approach, and resource constraints for the mission board.

## Validation Surface

### Primary Surfaces
1. **Dashboard (Web)** - React application at http://localhost:3201
   - Tool: agent-browser
   - Coverage: Kanban board, task management, approval workflow, analytics

2. **API** - Hono REST API at http://localhost:3200
   - Tool: curl / HTTP client
   - Coverage: All endpoints, validation, error handling

3. **CLI** - Standalone binary
   - Tool: Shell execution (no tuistory available)
   - Coverage: Command parsing, API integration, error messages

### Tool Availability
- ✅ Bun test runner (v1.3.10)
- ✅ agent-browser (v0.17.1)
- ✅ curl (v8.5.0)
- ❌ tuistory (not installed - CLI TUI testing unavailable)
- ✅ Chrome/Chromium at /usr/bin/google-chrome

### Port Allocation
- API server: 3200
- Dashboard dev server: 3201

## Validation Concurrency

**Max Concurrent Validators: 5**

### Resource Analysis

| Component | Memory Usage | Notes |
|-----------|-------------|-------|
| Bun API server | 50-100 MB | Hono + SQLite |
| React dev server | 100-200 MB | Vite dev server |
| agent-browser instance | 200-400 MB | Chrome + automation |

**Machine Resources:**
- Total Memory: ~31 GB
- Available: ~30 GB
- CPU Cores: 8
- Current Load: Low (0.61)

**Concurrency Calculation:**
- 5 validators × 400 MB = 2 GB (max)
- API + Dashboard = 300 MB
- Total = 2.3 GB
- Headroom used: ~7.7% of 30 GB (well within 70% safety margin)

### Isolation Strategy

1. **API tests**: Can run in parallel (stateless endpoints)
2. **Dashboard UI tests**: Use separate browser contexts (CDP ports)
3. **CLI tests**: Sequential or parallel with different task IDs
4. **Database state**: Use transactions or separate test databases per validator

## Flow Validator Guidance: API

### Isolation Rules
- Each validator should use unique resource IDs (project names, agent IDs) to avoid conflicts
- Tests can run in parallel - API is stateless and handles concurrent requests
- Use descriptive prefixes for test resources (e.g., `val-proj-001-test`, `val-agent-abc`)

### Testing Approach
- Use `curl` for all API requests
- Verify response status codes match expected values
- Verify response body structure matches contract
- Test both success and error cases

### API Base URL
- http://localhost:3200

### Evidence Collection
- Save curl commands and their output
- Note any unexpected behavior or error messages
- Record timing if relevant to assertion

## Flow Validator Guidance: CLI

### Isolation Rules
- CLI tests MUST run sequentially — they share the same config file (~/.mission-board/config.json) and database
- Use unique task titles to avoid confusion but share the same agent_id and projects
- CLI binary is at ./dist/mission (compiled ELF binary)
- Config file exists at ~/.mission-board/config.json with agent_id and api_url

### Testing Approach
- Execute compiled binary directly: `./dist/mission <command>`
- Check exit codes: `$?` — 0 for success, 1 for error
- Verify terminal output contains expected strings
- For VAL-CLI-009, verify binary runs standalone (not requiring Bun)

### CLI Binary
- Path: /home/roach/mission-board/dist/mission
- Config: ~/.mission-board/config.json (agent_id: 00000001-0000-0000-0000-000000000001, api_url: http://localhost:3200)
- API must be running on port 3200 for commands that interact with the API

### Seeded Data
- Project "test-project" (ID: varies per seed, use `./dist/mission projects` to get ID)
- Project "another-project" (ID: varies per seed)
- Agent ID in config: 00000001-0000-0000-0000-000000000001

## Flow Validator Guidance: Dashboard

### Isolation Rules
- Dashboard tests MUST use separate browser sessions to avoid conflicts
- Each validator gets its own agent-browser session (CDP port)
- Do NOT create/delete tasks that other validators are testing — read-only for shared state
- For assertions that create tasks (VAL-DASH-013), use unique task titles to avoid collisions
- The real-time update test (VAL-DASH-007) creates tasks via curl — use a unique title prefix

### Testing Approach
- Use agent-browser for all dashboard UI validation
- Navigate to http://localhost:3201
- Take screenshots at each step for evidence
- Check for console errors after each action
- For drag-drop tests: use mouse drag actions and verify card moves

### Dashboard URL
- http://localhost:3201

### Seeded Data (for dashboard milestone)
- 2 Projects: "Alpha Project" (PROJ1), "Beta Project" (PROJ2)
- 3 Agents: aaaaaaaa-aaaa-..., bbbbbbbb-bbbb-..., cccccccc-cccc-...
- 6 Tasks across all statuses:
  - 1 backlog task ("Backlog task one") in Alpha Project
  - 1 ready task ("Backlog task two") in Alpha Project
  - 1 in_progress task ("In progress task") claimed by AGENT2 in Alpha Project
  - 1 review task ("Review task") claimed by AGENT1 in Beta Project
  - 1 done task ("Done task") in Alpha Project
  - 1 blocked task ("Blocked task") in Beta Project

### API Field Naming Convention
- API uses camelCase: agentId, projectId, taskType, createdAt, updatedAt
- Task types: implementation, bugfix, feature, deployment, documentation, testing, research, other

### Evidence Collection
- Save screenshots for each assertion
- Note any console errors
- Record timing for real-time update assertions

---

## Testing Notes

- Greenfield project: validation starts after each milestone completes
- No auth required (internal network)
- Agent identification via agent_id in requests
