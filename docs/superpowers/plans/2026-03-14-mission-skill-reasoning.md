# Mission Skill — Agent Reasoning Integration Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update `.claude/skills/mission/SKILL.md` so agents always send `reason` and `transcript` with every state-changing API call.

**Architecture:** Pure documentation change — add an "Agent Reasoning" reference section, then update each subcommand's curl examples and instructions to include reasoning fields.

**Tech Stack:** Markdown (SKILL.md)

**Spec:** `docs/superpowers/specs/2026-03-14-mission-skill-reasoning-design.md`

---

## Task 1: Add "Agent Reasoning" section

**Files:**
- Modify: `.claude/skills/mission/SKILL.md:107` (insert before `## Subcommands`)

- [ ] **Step 1: Insert the Agent Reasoning section**

Insert the following between the `---` after Setup Check (line 107) and `## Subcommands` (line 109):

```markdown
## Agent Reasoning

**Every state-changing action MUST include reasoning.** This creates an audit trail visible in the Mission Board dashboard.

Include two fields in the request body:

| Field | Type | Constraint | What to write |
|---|---|---|---|
| `reason` | string | max 280 chars | One sentence: why you are taking this action |
| `transcript` | array of `{step, thought}` | max 50 steps, thought max 2000 chars | Your decision-making steps (typically 2-5) |

### Writing good reasoning

**`reason`** — answer "why am I doing this?":
- Good: `"Task matches my expertise in React; no blockers in description"`
- Good: `"Implementation complete, all 3 acceptance criteria met, tests passing"`
- Good: `"Blocked on upstream API — releasing so another agent can pick up a different approach"`
- Bad: `"Claiming this task"` (restates the action, no insight)
- Bad: `"Done"` (no context)

**`transcript`** — show your decision process, not a narrative:
- Each step should capture a distinct reasoning moment
- Steps should be substantive, not padding
- 2-5 steps is typical; don't force more

**Example (claiming):**
```json
{
  "reason": "Task requires React component work — matches my current project context",
  "transcript": [
    {"step": 1, "thought": "Task requires implementing a React component with Tailwind — matches my current project context"},
    {"step": 2, "thought": "Checked dependencies: no blockers, design spec is linked in description"},
    {"step": 3, "thought": "No other agent has claimed this; ready status confirmed"}
  ]
}
```

**Example (completing):**
```json
{
  "reason": "All acceptance criteria met, 4 unit tests passing, manually verified",
  "transcript": [
    {"step": 1, "thought": "Implemented the UserProfile component as specified in the design doc"},
    {"step": 2, "thought": "Added unit tests — 4 tests covering render, props, error state, loading state"},
    {"step": 3, "thought": "Manual verification: component renders correctly in the dashboard"},
    {"step": 4, "thought": "All acceptance criteria from task description are met"}
  ]
}
```

**Applies to:** `claim`, `update`, `complete`, `release`, and approval requests.
```

- [ ] **Step 2: Verify the section is placed correctly**

Read the file and confirm the new section appears between "Setup Check" and "Subcommands".

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/mission/SKILL.md
git commit -m "docs(skill): add Agent Reasoning section to mission skill"
```

---

## Task 2: Update `claim` subcommand with reasoning

**Files:**
- Modify: `.claude/skills/mission/SKILL.md` — `### claim <task-id>` section

- [ ] **Step 1: Update claim instructions and curl**

Replace the current claim section content (steps 1-5) with:

```markdown
### `claim <task-id>`

Claim a task for the configured agent.

1. Read config to get the default agent's UUID.

2. Formulate your reasoning:
   - `reason`: Why are you picking this task? (e.g., relevant expertise, priority, no blockers)
   - `transcript`: Your decision steps for choosing this task

3. Claim:
   ```bash
   curl -s -X POST "<API_URL>/api/tasks/<TASK_ID>/claim" \
     -H "Content-Type: application/json" \
     -d '{"agentId":"<AGENT_ID>","reason":"<REASON>","transcript":[{"step":1,"thought":"<THOUGHT>"}]}'
   ```

4. If successful: confirm "Claimed task: <title>".
5. If 409 response: "Task is already claimed by another agent."
6. If the task response shows `requiresApproval: true`: inform the user that approval may be needed for certain actions on this task.
```

- [ ] **Step 2: Commit**

```bash
git add .claude/skills/mission/SKILL.md
git commit -m "docs(skill): add reasoning to claim subcommand"
```

---

## Task 3: Update `update` subcommand with reasoning

**Files:**
- Modify: `.claude/skills/mission/SKILL.md` — `### update <task-id>` section

- [ ] **Step 1: Update the update section**

Replace the current update section with:

```markdown
### `update <task-id>`

Update a task's status, title, or description.

Ask the user what to change. At least one field is required. Formulate your reasoning:
- `reason`: Why is this change being made?
- `transcript`: Your decision steps for this update

Build a JSON patch:

```bash
curl -s -X PATCH "<API_URL>/api/tasks/<TASK_ID>" \
  -H "Content-Type: application/json" \
  -d '{"status":"<STATUS>","reason":"<REASON>","transcript":[{"step":1,"thought":"<THOUGHT>"}]}'
```

Only include fields that are being changed (plus `reason` and `transcript`). Valid status transitions:
- `backlog` <-> `ready` <-> `in_progress` <-> `review` <-> `done`
- Any status -> `blocked`

If the server returns a transition error, display it to the user.
```

- [ ] **Step 2: Commit**

```bash
git add .claude/skills/mission/SKILL.md
git commit -m "docs(skill): add reasoning to update subcommand"
```

---

## Task 4: Update `complete` subcommand with reasoning

**Files:**
- Modify: `.claude/skills/mission/SKILL.md` — `### complete <task-id>` section

- [ ] **Step 1: Update the complete section**

Replace the current complete section with:

```markdown
### `complete <task-id>`

Mark a task as done, respecting approval requirements.

1. Fetch task details:
   ```bash
   curl -s "<API_URL>/api/tasks/<TASK_ID>"
   ```

2. Formulate your reasoning:
   - `reason`: Summarize what was accomplished and how it was verified
   - `transcript`: Detail the work done and verification steps

3. If `requiresApproval` is `true`:
   - Create an approval request with reasoning:
     ```bash
     curl -s -X POST "<API_URL>/api/approvals" \
       -H "Content-Type: application/json" \
       -d '{"taskId":"<TASK_ID>","agentId":"<AGENT_ID>","actionRequested":"complete","reason":"<REASON>","transcript":[{"step":1,"thought":"<THOUGHT>"}]}'
     ```
   - Tell the user: "Approval required. Please approve on the Mission Board dashboard."
   - Offer to check approval status:
     ```bash
     curl -s "<API_URL>/api/approvals?task_id=<TASK_ID>"
     ```
     Check the latest entry's `status` field: `approved`, `denied`, or `pending`.

4. If `requiresApproval` is `false` (or after approval is confirmed):
   ```bash
   curl -s -X PATCH "<API_URL>/api/tasks/<TASK_ID>" \
     -H "Content-Type: application/json" \
     -d '{"status":"done","reason":"<REASON>","transcript":[{"step":1,"thought":"<THOUGHT>"}]}'
   ```
   Confirm: "Task marked as done."
```

- [ ] **Step 2: Commit**

```bash
git add .claude/skills/mission/SKILL.md
git commit -m "docs(skill): add reasoning to complete subcommand"
```

---

## Task 5: Update `release` subcommand with reasoning

**Files:**
- Modify: `.claude/skills/mission/SKILL.md` — `### release <task-id>` section

- [ ] **Step 1: Update the release section**

Replace the current release section with:

```markdown
### `release <task-id>`

Release a claimed task back to the pool.

1. Fetch task title first:
   ```bash
   curl -s "<API_URL>/api/tasks/<TASK_ID>"
   ```

2. Formulate your reasoning:
   - `reason`: Why are you releasing this task? (e.g., blocked, wrong expertise, reprioritized)
   - `transcript`: Your decision steps — this helps the next agent understand the context

3. Release:
   ```bash
   curl -s -X POST "<API_URL>/api/tasks/<TASK_ID>/release" \
     -H "Content-Type: application/json" \
     -d '{"reason":"<REASON>","transcript":[{"step":1,"thought":"<THOUGHT>"}]}'
   ```

4. Confirm: "Released task: <title>"
```

- [ ] **Step 2: Commit**

```bash
git add .claude/skills/mission/SKILL.md
git commit -m "docs(skill): add reasoning to release subcommand"
```

---

## Task 6: Final review and single squash commit

- [ ] **Step 1: Read the complete updated SKILL.md**

Verify all sections are consistent and well-formatted.

- [ ] **Step 2: Verify no reasoning mentions are missing**

Check that every state-changing curl example includes `reason` and `transcript`.

- [ ] **Step 3: Squash into a single commit (if multiple commits were made)**

```bash
git add .claude/skills/mission/SKILL.md
git commit -m "docs(skill): add agent reasoning to all mission skill subcommands

Agents now include reason (280 char summary) and transcript
(chain-of-thought steps) in every state-changing API call:
claim, update, complete, release, and approval requests.

This enables full audit trails in the Mission Board dashboard's
AgentReasoningTimeline."
```
