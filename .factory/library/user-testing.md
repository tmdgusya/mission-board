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

## Testing Notes

- Greenfield project: validation starts after each milestone completes
- No auth required (internal network)
- Agent identification via agent_id in requests
