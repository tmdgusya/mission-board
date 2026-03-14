---
name: mission-create
description: Create a new task on the mission board
---

# Create a Mission Board Task

When the user asks to create a new task or add something to the backlog:

1. **Gather required parameters.** If the user did not provide all of the following, prompt for each missing one:
   - **project**: Which project this task belongs to. Run `bun .claude/skills/mission-helper.ts list --status backlog` to help the user see existing projects, or ask them to specify a project ID.
   - **title**: A short descriptive title for the task.
   - **type**: One of: `implementation`, `bugfix`, `feature`, `deployment`, `documentation`, `testing`, `research`, `other`.
   - **description**: A detailed description of what needs to be done.

2. **Create the task** by running:
   ```
   bun .claude/skills/mission-helper.ts create --project <project-id> --title "<title>" --type <type> --description "<description>"
   ```

3. **Confirm creation** by showing the user the created task's ID and title from the JSON response.
