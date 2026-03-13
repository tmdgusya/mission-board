# Task Management Interactions - Complete Enumeration

## Overview
This document exhaustively enumerates all possible user/agent interactions for the Task Management feature area in a mission board system.

**Task Fields:** id, project_id, agent_id, title, description, task_type, requires_approval, status, created_at, updated_at, claimed_at

**Task Statuses:** backlog, ready, in_progress, review, done, blocked

---

## 1. Creating Tasks

### 1.1 Create Task - Basic
**What user/agent does:**
- Provides: project_id, title, task_type
- Optional: description, requires_approval

**Expected behavior:**
- Task is created with status `backlog` by default
- `created_at` and `updated_at` are set to current timestamp
- `agent_id` and `claimed_at` are null
- Returns created task with generated `id`

**Error conditions:**
- Invalid or non-existent `project_id` → 404 Project not found
- Missing required field `title` → 400 Validation error
- Missing required field `task_type` → 400 Validation error
- Empty string `title` → 400 Validation error
- `title` exceeds max length → 400 Validation error
- Invalid `task_type` (not in configured types) → 400 Invalid task type
- User lacks permission to create tasks in project → 403 Forbidden

**Edge cases:**
- `title` with only whitespace → Should be trimmed or rejected
- Very long `description` → Should have max length limit
- Special characters/HTML in `title` or `description` → Should be sanitized
- Unicode characters in fields → Should be supported
- Creating task with `requires_approval=true` when user lacks approval authority → Should this be allowed?

### 1.2 Create Task with Status
**What user/agent does:**
- Provides: project_id, title, task_type, status

**Expected behavior:**
- Task is created with specified status
- If status is anything other than `backlog`, validation may be required

**Error conditions:**
- Invalid status value → 400 Invalid status
- Creating task directly in `in_progress` without claiming → Should this be allowed?
- Creating task in `done` status → May require special permissions

**Edge cases:**
- Can create task in any status? Or are there restrictions?
- Does creating in `in_progress` automatically set `agent_id` to creator?

### 1.3 Create Task with Pre-assignment
**What user/agent does:**
- Provides: project_id, title, task_type, agent_id (assign to specific agent)

**Expected behavior:**
- Task is created and assigned to specified agent
- `claimed_at` is set to current timestamp
- Status may automatically be set to `ready` or `in_progress`

**Error conditions:**
- Invalid `agent_id` → 404 Agent not found
- Agent doesn't have permission for this project → 403 Forbidden
- Assigning to inactive/disabled agent → 400 Invalid agent

**Edge cases:**
- Self-assignment vs. assignment by manager
- Can task be assigned to multiple agents? (Design decision needed)

---

## 2. Viewing Tasks

### 2.1 List All Tasks
**What user/agent does:**
- Requests task list (no filters)

**Expected behavior:**
- Returns paginated list of all tasks user has access to
- Includes task metadata (id, title, status, project, assigned agent, etc.)
- Ordered by default sort (e.g., `created_at` DESC)

**Error conditions:**
- User not authenticated → 401 Unauthorized
- No tasks exist → Returns empty array

**Edge cases:**
- Large number of tasks → Pagination required
- Tasks across many projects → Filter by user's accessible projects only

### 2.2 List Tasks with Status Filter
**What user/agent does:**
- Requests tasks filtered by single or multiple statuses
- Query params: `?status=backlog` or `?status=backlog,ready`

**Expected behavior:**
- Returns only tasks matching specified status(es)
- Case-insensitive status matching

**Error conditions:**
- Invalid status value → 400 Invalid status filter
- Empty status filter → Returns all tasks or empty result

**Edge cases:**
- Multiple status filters → Should support comma-separated or array
- Non-existent status → Return empty or error?

### 2.3 List Tasks by Project
**What user/agent does:**
- Requests tasks for specific project
- Query params: `?project_id=123`

**Expected behavior:**
- Returns all tasks belonging to specified project
- User must have access to project

**Error conditions:**
- Invalid `project_id` → 400 Invalid project ID
- Project doesn't exist → 404 Project not found
- User lacks permission for project → 403 Forbidden

**Edge cases:**
- Project with no tasks → Returns empty array
- Archived/deleted project → Should return error or empty?

### 2.4 List Tasks by Agent
**What user/agent does:**
- Requests tasks assigned to specific agent
- Query params: `?agent_id=456`

**Expected behavior:**
- Returns all tasks claimed by specified agent
- Agents can view their own tasks; managers can view all

**Error conditions:**
- Invalid `agent_id` → 400 Invalid agent ID
- Agent doesn't exist → 404 Agent not found
- User lacks permission to view other agent's tasks → 403 Forbidden

**Edge cases:**
- Unassigned tasks filter (`agent_id=null` or `agent_id=unassigned`)
- Agent has no tasks → Returns empty array
- Inactive agent → Should their tasks still be visible?

### 2.5 List Tasks - Combined Filters
**What user/agent does:**
- Requests tasks with multiple filters
- Query params: `?project_id=123&status=in_progress,review&agent_id=456`

**Expected behavior:**
- Returns tasks matching ALL filter criteria (AND logic)
- All filters are optional

**Error conditions:**
- Any invalid filter value → 400 Validation error
- Conflicting filters (e.g., status=done AND in_progress) → Returns empty

**Edge cases:**
- No results matching all filters → Returns empty array
- Very specific filters → Performance implications

### 2.6 Get Task Detail
**What user/agent does:**
- Requests single task by ID
- Path: `GET /tasks/{task_id}`

**Expected behavior:**
- Returns complete task object with all fields
- May include related data (project name, agent name, task type details)

**Error conditions:**
- Invalid `task_id` format → 400 Invalid ID
- Task doesn't exist → 404 Task not found
- User lacks permission → 403 Forbidden

**Edge cases:**
- Task was recently deleted → 404
- Task is in archived project → Access depends on permissions

### 2.7 Search Tasks
**What user/agent does:**
- Searches tasks by text query
- Query params: `?q=search+term`

**Expected behavior:**
- Searches in `title` and `description` fields
- Returns matching tasks

**Error conditions:**
- Empty search query → Returns all or empty
- Special characters in search → Should be escaped/sanitized

**Edge cases:**
- Case-insensitive search
- Partial word matching
- Very long search queries
- No results → Empty array

---

## 3. Claiming Tasks

### 3.1 Claim Available Task
**What user/agent does:**
- Requests to claim an unclaimed task
- Path: `POST /tasks/{task_id}/claim`

**Expected behavior:**
- `agent_id` is set to current user/agent
- `claimed_at` is set to current timestamp
- `status` transitions to `in_progress` (or stays `ready`?)
- `updated_at` is updated
- Returns updated task

**Error conditions:**
- Task already claimed by another agent → 409 Conflict
- Task doesn't exist → 404 Not found
- User not authenticated → 401 Unauthorized
- Task is in `done` status → 400 Cannot claim completed task
- Task is `blocked` → 400 Cannot claim blocked task
- User lacks permission for this project → 403 Forbidden

**Edge cases:**
- Idempotency: Re-claiming own already-claimed task → Should succeed (no-op) or return 200
- Race condition: Two agents claim simultaneously → Only one succeeds (optimistic locking)
- Agent already has max tasks → Policy-based limit?
- Claiming task in `backlog` vs `ready` status → Should this matter?
- Task requires approval and not yet approved → 400 Task requires approval first

### 3.2 Force Claim (Admin/Manager)
**What user/agent does:**
- Admin claims task on behalf of another agent or reassigns
- Path: `POST /tasks/{task_id}/claim` with body `{agent_id: "target_agent"}`

**Expected behavior:**
- Task is assigned to specified agent
- Previous assignment is overridden

**Error conditions:**
- Non-admin trying to force claim → 403 Forbidden
- Target agent doesn't exist → 404 Agent not found
- Target agent lacks permission for project → 400 Invalid assignment

**Edge cases:**
- Reassigning task currently in progress → Should previous agent be notified?
- Reassigning completed task → Should this be allowed?

---

## 4. Releasing Tasks

### 4.1 Release Claimed Task
**What user/agent does:**
- Releases a task they previously claimed
- Path: `POST /tasks/{task_id}/release`

**Expected behavior:**
- `agent_id` is set to null
- `claimed_at` is set to null
- `status` transitions back to `ready` or `backlog`
- `updated_at` is updated
- Returns updated task

**Error conditions:**
- Task not claimed by current user → 403 Forbidden (or 409 Conflict)
- Task doesn't exist → 404 Not found
- User not authenticated → 401 Unauthorized
- Task is in `done` status → 400 Cannot release completed task
- Task is in `review` status → May require review completion first

**Edge cases:**
- Releasing task claimed by another agent (as manager) → Permission check
- Releasing task in `blocked` status → Should this be allowed?
- Idempotency: Releasing already unclaimed task → Should succeed (no-op) or 400

### 4.2 Force Release (Admin/Manager)
**What user/agent does:**
- Admin releases any task regardless of who claimed it
- Path: `POST /tasks/{task_id}/release` (admin override)

**Expected behavior:**
- Task is unclaimed regardless of current assignee

**Error conditions:**
- Non-admin trying to release another's task → 403 Forbidden

**Edge cases:**
- Should previous assignee be notified?
- Work already done on task → Should it be preserved?

---

## 5. Updating Tasks

### 5.1 Update Task Fields
**What user/agent does:**
- Updates one or more task fields
- Path: `PATCH /tasks/{task_id}`
- Body: `{title: "New title", description: "New desc", ...}`

**Expected behavior:**
- Specified fields are updated
- `updated_at` is set to current timestamp
- Returns updated task

**Error conditions:**
- Task doesn't exist → 404 Not found
- Invalid field in request body → 400 Invalid field
- Validation failure for any field → 400 Validation error
- User lacks permission → 403 Forbidden
- Empty request body → 400 No updates provided
- Immutable field attempted (e.g., `id`, `created_at`) → 400 Cannot update field

**Edge cases:**
- Partial updates (only some fields) → Should be supported
- Updating `task_type` → May affect `requires_approval` flag
- Updating `title` to same value → Should succeed (no-op)
- Very long field values → Should have limits

### 5.2 Who Can Update What Fields?

**General fields (title, description):**
- Task creator → Can update
- Assigned agent → Can update
- Project manager → Can update
- Admin → Can update
- Unrelated user → Cannot update (403)

**Task type:**
- Project manager → Can update
- Admin → Can update
- Assigned agent → Maybe (depends on policy)
- Regular user → Cannot update

**requires_approval flag:**
- Project manager → Can update
- Admin → Can update
- Others → Cannot update

**project_id (moving task to different project):**
- Admin only → Can update
- Others → Cannot update (403)

**agent_id (assignment):**
- Should use claim/release endpoints, not direct update
- Direct update may be restricted to admins only

**Status field:**
- See Status Transitions section below

### 5.3 Update Validation Rules

**Title validation:**
- Required field
- Min length: 1 character (after trimming)
- Max length: 255 characters (or project-defined)
- Cannot be empty string
- Cannot be only whitespace

**Description validation:**
- Optional field (can be null or empty)
- Max length: 10,000 characters (or project-defined)
- Supports markdown? Plain text?

**task_type validation:**
- Must match configured task type in project
- Cannot be null/empty
- Changing type may reset or preserve `requires_approval`

**project_id validation:**
- Must reference existing project
- User must have access to target project

---

## 6. Deleting Tasks

### 6.1 Delete Task
**What user/agent does:**
- Requests deletion of a task
- Path: `DELETE /tasks/{task_id}`

**Expected behavior:**
- Task is removed from database
- Returns 204 No Content (or 200 with confirmation)
- `updated_at` on project may be updated

**Error conditions:**
- Task doesn't exist → 404 Not found
- User lacks permission → 403 Forbidden
- Task is currently in progress → 400 Cannot delete active task
- Task is in review → 400 Cannot delete task under review

**Edge cases:**
- Hard delete vs soft delete (archive)
- Task has dependencies → Should deletion be blocked?
- Task has history/audit log → Should it be preserved?
- Deleting task claimed by another agent → Permission check
- Can delete own tasks only? Or project-level permission?
- What happens to `agent_id` reference if soft delete?

### 6.2 Who Can Delete Tasks?

**Creator of task:**
- Can delete if status is `backlog` or `ready`
- Cannot delete if `in_progress`, `review`, or `done`

**Project manager:**
- Can delete tasks in any status

**Admin:**
- Can delete any task

**Assigned agent:**
- Cannot delete (only release)

**Regular user:**
- Cannot delete

### 6.3 Cascade Effects of Deletion

**What happens when task is deleted:**
- Task is removed from all lists
- `agent_id` reference is removed (no cascade to agent)
- `project_id` reference is removed (no cascade to project)
- Task history/audit entries → Should be preserved or deleted?
- Any linked resources → Should be handled (orphaned or cascade delete?)

---

## 7. Task Type Configuration

### 7.1 Create Task Type
**What user/agent does:**
- Creates new task type for a project
- Path: `POST /projects/{project_id}/task-types`
- Body: `{name: "bug", requires_approval: false, ...}`

**Expected behavior:**
- Task type is created and associated with project
- Can now be used when creating tasks

**Error conditions:**
- Project doesn't exist → 404 Not found
- User lacks permission → 403 Forbidden
- Task type name already exists → 409 Conflict
- Invalid name → 400 Validation error

**Edge cases:**
- Default task types for new projects
- Global task types vs project-specific
- Task type with same name in different projects

### 7.2 Update Task Type
**What user/agent does:**
- Modifies existing task type
- Path: `PATCH /projects/{project_id}/task-types/{type_id}`

**Expected behavior:**
- Task type is updated
- Existing tasks with this type are affected (or not)

**Error conditions:**
- Task type doesn't exist → 404 Not found
- User lacks permission → 403 Forbidden
- Changing to duplicate name → 409 Conflict

**Edge cases:**
- Changing `requires_approval` flag → Affects existing tasks?
- Tasks using this type → Should they be updated?
- Can name be changed if tasks exist?

### 7.3 Delete Task Type
**What user/agent does:**
- Removes a task type
- Path: `DELETE /projects/{project_id}/task-types/{type_id}`

**Expected behavior:**
- Task type is removed
- Or returns 400 if tasks exist with this type

**Error conditions:**
- Task type doesn't exist → 404 Not found
- User lacks permission → 403 Forbidden
- Tasks exist with this type → 400 Cannot delete in-use type
- Default task type → Cannot be deleted

**Edge cases:**
- What happens to tasks using deleted type?
- Migration path to another type?
- Soft delete vs hard delete

### 7.4 List Task Types
**What user/agent does:**
- Requests all task types for a project
- Path: `GET /projects/{project_id}/task-types`

**Expected behavior:**
- Returns list of task types with metadata

**Error conditions:**
- Project doesn't exist → 404 Not found
- User lacks permission → 403 Forbidden

**Edge cases:**
- Project with no custom types → Returns default types only
- Include global task types in response

---

## 8. Status Transitions

### 8.1 Valid Status Transitions

**From `backlog`:**
- → `ready` (task is groomed and ready to be worked on)
- → `done` (cancelled or completed without work)
- Cannot go to `in_progress` directly (must be claimed first)
- Cannot go to `review` directly
- Cannot go to `blocked` directly (blocked from what?)

**From `ready`:**
- → `in_progress` (agent claims task)
- → `backlog` (moved back to backlog)
- → `done` (cancelled or completed without work)
- Cannot go to `review` directly
- Cannot go to `blocked` directly

**From `in_progress`:**
- → `review` (work complete, ready for review)
- → `blocked` (blocked by dependency)
- → `ready` (released back to pool)
- → `done` (completed, skip review if allowed)
- Cannot go to `backlog` directly (must be released first)

**From `review`:**
- → `done` (review passed)
- → `in_progress` (review failed, more work needed)
- → `blocked` (blocked during review)
- Cannot go to `ready` or `backlog` directly

**From `blocked`:**
- → `in_progress` (blocker resolved)
- → `ready` (released while blocked)
- → `backlog` (moved back to backlog)
- Cannot go to `review` directly
- Cannot go to `done` directly

**From `done`:**
- → `in_progress` (reopened for more work)
- → `review` (sent back to review)
- Cannot go to `ready` or `backlog` directly
- Cannot go to `blocked` (done is final unless reopened)

### 8.2 Status Transition Rules

**Who can transition status:**
- `backlog` → `ready`: Project manager or admin
- `ready` → `in_progress`: Agent claiming the task
- `in_progress` → `review`: Assigned agent
- `review` → `done`: Reviewer or project manager
- `in_progress` → `blocked`: Assigned agent
- `blocked` → `in_progress`: Assigned agent or manager
- Any → `done`: Project manager or admin
- `done` → `in_progress`: Project manager or admin (reopen)

### 8.3 Status Transition Side Effects

**Transitioning to `in_progress`:**
- Must have `agent_id` set (task must be claimed)
- `claimed_at` must be set
- If no `agent_id`, auto-assign to current user

**Transitioning to `done`:**
- `updated_at` is set
- `agent_id` remains set (for history)
- May require `review` status first (based on task type)
- If task requires approval, must have been approved

**Transitioning to `blocked`:**
- Should have reason for blocking (metadata)
- `agent_id` remains set (agent still owns it)

**Transitioning from `done`:**
- Reopening task
- May require justification
- Audit trail should be created

### 8.4 Status Transition Error Conditions

**Invalid transitions:**
- `backlog` → `review` → 400 Invalid transition
- `review` → `ready` → 400 Invalid transition
- `done` → `backlog` → 400 Invalid transition
- `done` → `ready` → 400 Invalid transition

**Permission errors:**
- Non-assignee trying to move to `review` → 403 Forbidden
- Non-reviewer trying to approve to `done` → 403 Forbidden
- Regular user trying to move from `backlog` → 403 Forbidden

**State errors:**
- Moving to `in_progress` without `agent_id` → 400 Task must be claimed
- Moving `done` task that requires approval but not approved → 400 Approval required
- Moving to `review` when no reviewer assigned → 400 No reviewer

### 8.5 Bulk Status Transitions
**What user/agent does:**
- Updates status of multiple tasks at once
- Path: `POST /tasks/bulk-update-status`
- Body: `{task_ids: [1,2,3], status: "ready"}`

**Expected behavior:**
- All valid transitions are applied
- Returns summary of successes and failures

**Error conditions:**
- Any task has invalid transition → Partial success or all fail?
- Mixed permissions → Some succeed, some fail
- Empty task_ids array → 400 No tasks specified

**Edge cases:**
- Large number of tasks → Performance considerations
- Atomic transaction (all or nothing) vs best-effort
- Some tasks don't exist → Should be reported

---

## 9. Additional Edge Cases & Scenarios

### 9.1 Concurrent Modifications
**Scenario:** Two users update same task simultaneously

**Expected behavior:**
- Optimistic locking with version/timestamp check
- Later update fails with 409 Conflict
- Or last-write-wins (not recommended)

**Error conditions:**
- Version mismatch → 409 Conflict (stale data)
- Resolution: User must refresh and retry

### 9.2 Task History/Audit Trail
**What gets logged:**
- Creation
- Field updates (what changed, who, when)
- Status transitions
- Assignment changes
- Deletion

**Access:**
- Project managers can view history
- Assigned agent can view history
- Audit logs cannot be modified

### 9.3 Empty States

**No tasks in project:**
- List returns empty array
- UI shows "Create your first task" message

**No tasks matching filters:**
- List returns empty array
- UI shows "No tasks match your filters"

**No claimed tasks for agent:**
- List returns empty array
- UI shows "No tasks assigned to you"

**No task types configured:**
- Use system defaults
- Or require configuration before task creation

### 9.4 Agent Permissions

**Can any agent claim any task?**
- Generally: Yes, if they have project access
- Exceptions:
  - Task requires specific skill/role
  - Agent has reached task limit
  - Task requires approval and agent lacks authority
  - Task is already claimed

**Can a task be claimed by multiple agents?**
- No, one agent per task
- `agent_id` is single value
- For collaboration, use alternative mechanism (subtasks, shared project)

### 9.5 Task Dependencies (if supported)
**Scenario:** Task depends on another task

**Interactions:**
- Cannot start task if dependency not complete
- Dependency is blocked → Task becomes blocked
- Dependency is completed → Task may auto-transition to `ready`

**This would require additional fields:**
- `depends_on` (array of task IDs)
- Dependency resolution logic

### 9.6 Batch Operations

**Batch create:**
- Create multiple tasks at once
- Path: `POST /tasks/batch`
- Body: `{tasks: [{...}, {...}]}`

**Batch delete:**
- Delete multiple tasks at once
- Path: `POST /tasks/batch-delete`
- Body: `{task_ids: [1,2,3]}`

**Batch assign:**
- Assign multiple tasks to one agent
- Path: `POST /tasks/batch-assign`
- Body: `{task_ids: [1,2,3], agent_id: 456}`

### 9.7 Export/Import Tasks

**Export tasks:**
- Download tasks as CSV/JSON
- Path: `GET /tasks/export?format=csv`

**Import tasks:**
- Upload CSV/JSON to create tasks
- Path: `POST /tasks/import`
- Validation errors reported per-row

---

## 10. API Endpoint Summary

### Task CRUD
- `GET /tasks` - List tasks (with optional filters)
- `GET /tasks/{id}` - Get task detail
- `POST /tasks` - Create task
- `PATCH /tasks/{id}` - Update task
- `DELETE /tasks/{id}` - Delete task

### Task Actions
- `POST /tasks/{id}/claim` - Claim task
- `POST /tasks/{id}/release` - Release task
- `POST /tasks/{id}/transition` - Change status (or PATCH with status field)

### Batch Operations
- `POST /tasks/batch` - Create multiple tasks
- `POST /tasks/batch-delete` - Delete multiple tasks
- `POST /tasks/batch-assign` - Assign multiple tasks
- `POST /tasks/bulk-update-status` - Update status for multiple tasks

### Task Types
- `GET /projects/{id}/task-types` - List task types
- `POST /projects/{id}/task-types` - Create task type
- `PATCH /projects/{id}/task-types/{type_id}` - Update task type
- `DELETE /projects/{id}/task-types/{type_id}` - Delete task type

### Export/Import
- `GET /tasks/export` - Export tasks
- `POST /tasks/import` - Import tasks

---

## 11. Summary of Key Questions/Decisions Needed

1. **Multi-agent assignment:** Can multiple agents work on one task? (Assumed: No)
2. **Status on claim:** Does claiming auto-set status to `in_progress`? (Assumed: Yes)
3. **Status on release:** Does releasing set status to `ready` or `backlog`? (Assumed: `ready`)
4. **Task deletion:** Hard delete or soft delete/archive?
5. **Task history:** Is audit trail required?
6. **Approval workflow:** How is approval granted and by whom?
7. **Task limits:** Can agents have max concurrent tasks?
8. **Task dependencies:** Are dependencies between tasks supported?
9. **Bulk operations:** Are batch endpoints needed?
10. **Permissions model:** Role-based (creator, assignee, manager, admin)?

---

## Document Metadata
- Generated: 2026-03-13
- Feature Area: Task Management
- System: Mission Board
