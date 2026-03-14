---
name: mission-claim
description: Claim a mission board task with human approval workflow
---

# Claim a Mission Board Task

When the user asks to claim or take a task:

1. **Check agent identity** by running:
   ```
   bun .claude/skills/mission-helper.ts whoami
   ```
   - If the response indicates no agent is configured, ask the user: "What should this agent be called?"
   - Once the user provides a name, run:
     ```
     bun .claude/skills/mission-helper.ts whoami --name <name>
     ```
   - Save the agent name to Claude Code memory so it persists across sessions.

2. **Create a claim approval request** by running:
   ```
   bun .claude/skills/mission-helper.ts claim <task-id>
   ```
   This does NOT claim the task directly. It creates an approval request that a human must approve.

3. **Inform the user** that approval is required:
   "Approval request created. Please approve on the dashboard at http://localhost:3201 or the task will not be claimed."

4. **Check approval status** by running:
   ```
   bun .claude/skills/mission-helper.ts check-approval <task-id>
   ```
   - If **approved**: Confirm to the user that the task is now claimed and you can proceed with work.
   - If **denied**: Display the denial reason from the output and stop. Do not proceed with work.
   - If **pending**: Tell the user that approval is still needed and they should approve on the dashboard.

5. Only begin working on the task after approval is confirmed.
