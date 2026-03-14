---
name: mission-complete
description: Mark a mission board task as complete
---

# Complete a Mission Board Task

When the user asks to mark a task as done or complete:

1. Run the complete command:
   ```
   bun .claude/skills/mission-helper.ts complete <task-id>
   ```

2. Check the JSON response:
   - If `requiresApproval` is true in the response, inform the user:
     "Completion requires approval. Please approve on the dashboard at http://localhost:3201."
     Then check the approval status:
     ```
     bun .claude/skills/mission-helper.ts check-approval <task-id>
     ```
     - If **approved**: Confirm the task is marked as done.
     - If **denied**: Show the denial reason and stop.
     - If **pending**: Tell the user approval is still needed.

   - If `requiresApproval` is false or not present, confirm to the user:
     "Task <task-id> marked as done."
