---
name: mission-status
description: Update the status of a mission board task
---

# Update Mission Board Task Status

When the user asks to update a task's status or move a task to a different state:

1. Run the status update command:
   ```
   bun .claude/skills/mission-helper.ts status <task-id> --status <new-status>
   ```
   Valid statuses include: backlog, in_progress, review, done, blocked.

2. If the command fails with an error about an invalid status transition, display the error message to the user. The error will include which transitions are valid from the current status.

3. If the command succeeds, confirm the status change to the user:
   "Task <task-id> status updated to <new-status>."
