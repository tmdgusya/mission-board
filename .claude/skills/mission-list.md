---
name: mission-list
description: List mission board tasks with optional project and status filters
---

# List Mission Board Tasks

When the user asks to list tasks, show available missions, or browse the backlog:

1. Run the helper to fetch tasks:
   ```
   bun .claude/skills/mission-helper.ts list [--project <project-id>] [--status <status>]
   ```
   - Include `--project` if the user specified a project name or ID
   - Include `--status` if the user specified a status filter (e.g., backlog, in_progress, review, done)

2. Parse the JSON array output from stdout.

3. Format the results as a readable markdown table with these columns:
   | ID | Title | Status | Assignee | Type |
   - For the ID column, show only the first 8 characters of the task ID
   - Show all other fields as-is from the JSON output

4. If the result is an empty array or no tasks are returned, respond with:
   "No tasks found matching filters."
