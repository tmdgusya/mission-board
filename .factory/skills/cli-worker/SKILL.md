---
name: cli-worker
description: Implements CLI tool with command handlers, API client, and Bun compilation to standalone binary
---

# CLI Worker

NOTE: Startup and cleanup are handled by `worker-base`. This skill defines the WORK PROCEDURE.

## When to Use This Skill

Use for features involving:
- CLI command implementation
- API client for agent interactions
- Binary compilation and distribution
- CLI testing

## Work Procedure

1. **Write tests first (RED)** - Create test file in `cli/tests/`
   - Command parsing tests
   - API client integration tests (mocked server)
   - Output formatting tests
   - Run `bun test` to verify tests FAIL

2. **Implement feature (GREEN)** - Make tests pass
   - Add command in `cli/src/commands/`
   - Use commander.js or similar for CLI framework
   - Implement API client methods
   - Format output with chalk/colors
   - Handle errors gracefully

3. **Manual verification**
   - Build CLI: `bun run build:cli`
   - Test with actual API server running
   - Test error scenarios (offline, invalid input)
   - Verify binary size is reasonable

4. **Run validators**
   - `bun run typecheck` - TypeScript validation
   - `bun run lint` - Code style
   - `bun test` - All tests must pass
   - `bun run build:cli` - Binary compilation succeeds

5. **Integration test**
   - Test CLI with live API server
   - Verify all commands work end-to-end
   - Test binary on target platform

## Example Handoff

```json
{
  "salientSummary": "Implemented 'mission claim' and 'mission update' commands with status validation, added API client methods, compiled to 15MB binary, verified with live server.",
  "whatWasImplemented": "CLI command 'mission claim <task-id>' that calls PATCH /api/tasks/:id with status=in_progress and agent_id from config. Command 'mission update <task-id> --status <status>' with validation against allowed statuses. Added ApiClient class with claimTask() and updateTask() methods. Config file support at ~/.mission-board/config.json for agent_id. Binary compilation via 'bun build --compile'. Help text and usage examples.",
  "whatWasLeftUndone": "",
  "verification": {
    "commandsRun": [
      {
        "command": "bun test cli/tests/commands.test.ts",
        "exitCode": 0,
        "observation": "6 tests passing: claim command success, claim already claimed task, update status, invalid status error, missing task-id error, config file reading"
      },
      {
        "command": "bun run build:cli",
        "exitCode": 0,
        "observation": "Binary created at ./dist/mission-cli, size 15MB"
      }
    ],
    "interactiveChecks": [
      {
        "action": "Started API server, ran './dist/mission-cli mission claim task-123'",
        "observed": "Output: '✓ Task task-123 claimed successfully', status changed to in_progress in database"
      },
      {
        "action": "Ran './dist/mission-cli mission update task-123 --status review'",
        "observed": "Output: '✓ Task task-123 updated to review', status changed in database"
      },
      {
        "action": "Ran './dist/mission-cli mission claim task-123' again (already claimed)",
        "observed": "Output: '✗ Error: Task already claimed by agent-456', exit code 1"
      },
      {
        "action": "Ran './dist/mission-cli --help'",
        "observed": "Help text displayed with all commands and options"
      }
    ]
  },
  "tests": {
    "added": [
      {
        "file": "cli/tests/commands.test.ts",
        "cases": [
          {"name": "claim command success", "verifies": "API call and output"},
          {"name": "claim already claimed task", "verifies": "Error handling"},
          {"name": "update status success", "verifies": "PATCH request"},
          {"name": "invalid status error", "verifies": "Validation"},
          {"name": "missing task-id error", "verifies": "Arg parsing"},
          {"name": "config file reading", "verifies": "Agent ID from config"}
        ]
      }
    ]
  },
  "discoveredIssues": []
}
```

## When to Return to Orchestrator

- API endpoints not yet implemented
- Binary compilation fails
- Missing dependencies that cannot be installed
- Platform-specific issues
