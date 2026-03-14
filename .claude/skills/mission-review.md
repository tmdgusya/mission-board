---
name: mission-review
description: Check review feedback and comments on a mission board task
---

# Review Mission Board Task Feedback

When the user asks to check review feedback or comments on a task:

1. Run the review command to fetch comments:
   ```
   bun .claude/skills/mission-helper.ts review <task-id>
   ```

2. Parse the JSON output and display each comment with:
   - **Author** (agent name or human reviewer)
   - **Timestamp** (formatted readably)
   - **Content** of the comment

3. If the comments contain actionable feedback (requested changes, bug reports, suggestions), summarize what needs to be done in a clear list.

4. Instruct the user: after making the requested fixes, run `/mission-status <task-id> review` to resubmit the task for review.
