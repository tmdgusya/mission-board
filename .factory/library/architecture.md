# Architecture

Architectural decisions, patterns, and system design.

**What belongs here:** Design decisions, patterns discovered, module organization, conventions.

---

## System Overview

Mission Board is a task management system for agent swarms with:
- **API Server** (Hono + SQLite) - REST API for CRUD operations
- **Dashboard** (React) - Web UI for monitoring and approval
- **CLI Tool** (Bun binary) - Agent interface for task operations

## Tech Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| Runtime | Bun 1.3.10 | Fastest JS runtime |
| Backend | Hono | Ultra-lightweight, fast |
| Database | SQLite (WAL mode) | Fast, embedded, concurrent reads |
| ORM | Drizzle | Type-safe, lightweight |
| Frontend | React 18 | Component-based UI |
| Data Fetching | React Query | Caching, polling, optimistic updates |
| Validation | Zod | Schema validation, type inference |
| CLI | Commander | Standard CLI framework |
| Build | Bun | Native bundler, fast compilation |

## Project Structure

```
mission-board/
├── src/
│   ├── api/           # Hono routes, middleware
│   ├── db/            # Drizzle schema, migrations
│   ├── services/      # Business logic
│   └── types/         # TypeScript types, Zod schemas
├── dashboard/
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── hooks/       # Custom hooks
│   │   ├── pages/       # Page components
│   │   └── lib/         # Utilities
│   └── public/
├── cli/
│   ├── src/
│   │   ├── commands/    # CLI commands
│   │   └── client/      # API client
│   └── dist/            # Compiled binary
├── data/              # SQLite database
└── tests/             # Test files
```

## Data Model

### Core Entities

```
projects
├── id (UUID, PK)
├── name
├── description
├── created_at
└── updated_at

agents
├── id (UUID, PK)
├── name
├── created_at
└── last_seen_at

tasks
├── id (UUID, PK)
├── project_id (FK)
├── agent_id (FK, nullable)
├── title
├── description
├── task_type
├── requires_approval (boolean)
├── status (enum: backlog, ready, in_progress, review, done, blocked)
├── created_at
├── updated_at
└── claimed_at

task_logs
├── id (UUID, PK)
├── task_id (FK)
├── agent_id (FK)
├── action (enum: created, claimed, updated, approved, denied)
├── details (JSON)
└── created_at

approval_requests
├── id (UUID, PK)
├── task_id (FK)
├── agent_id (FK)
├── action_requested
├── status (enum: pending, approved, denied)
├── reviewed_by (nullable)
├── reviewed_at (nullable)
├── created_at
└── notes
```

## API Design

### RESTful Endpoints

```
Projects
GET    /api/projects           - List projects
POST   /api/projects           - Create project
GET    /api/projects/:id       - Get project
PATCH  /api/projects/:id       - Update project
DELETE /api/projects/:id       - Delete project

Tasks
GET    /api/tasks              - List tasks (filter by project, status, agent)
POST   /api/tasks              - Create task
GET    /api/tasks/:id          - Get task
PATCH  /api/tasks/:id          - Update task (status, agent)
DELETE /api/tasks/:id          - Delete task
POST   /api/tasks/:id/claim    - Claim task for agent
POST   /api/tasks/:id/release  - Release task

Agents
GET    /api/agents             - List agents
POST   /api/agents             - Register agent
GET    /api/agents/:id         - Get agent
GET    /api/agents/:id/tasks   - Get agent's tasks

Logs
GET    /api/logs               - List logs (filter by task, agent, project)
GET    /api/logs/stats         - Get statistics

Approvals
GET    /api/approvals          - List pending approvals
POST   /api/approvals          - Request approval
POST   /api/approvals/:id/approve - Approve request
POST   /api/approvals/:id/deny    - Deny request
```

## Patterns & Conventions

### Backend
- Route handlers in `src/api/routes/`
- Business logic in `src/services/`
- Database operations via Drizzle ORM
- Validation with Zod schemas
- Error handling: HTTP status codes + JSON error messages

### Frontend
- Functional components with hooks
- React Query for server state
- Component co-location (tests next to components)
- Responsive design with CSS modules or Tailwind

### CLI
- Commander.js for argument parsing
- Config file at `~/.mission-board/config.json`
- Colored output with chalk
- Exit codes: 0 success, 1 error

## Concurrency Model

- SQLite WAL mode: Multiple readers, single writer
- API: Stateless, can scale horizontally
- React Query polling: 5 second intervals for real-time updates
- No background jobs needed initially
