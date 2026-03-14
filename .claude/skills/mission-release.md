---
name: mission-release
description: Release a claimed mission board task so others can claim it
---

# Release a Mission Board Task

When the user asks to release or unclaim a task:

1. First, get the task details to retrieve the title:
   ```
   bun .claude/skills/mission-helper.ts show <task-id>
   ```
   Parse the JSON output and note the task title.

2. Release the task:
   ```
   bun .claude/skills/mission-helper.ts release <task-id>
   ```

3. Confirm to the user:
   "Released task: <title>"
