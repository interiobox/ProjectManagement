# ArchPM — Full Project Prompt

Use this prompt to recreate ArchPM from scratch with an AI coding assistant.

---

## Overview

Build **ArchPM**, a project management web application tailored for architecture firms. It lets admins and team members track projects, tasks, RFIs, file uploads, and site activity in one place. The app has two roles — **admin** and **member** — with role-based access controlling who can create projects, manage users, and configure integrations.

The app is a full-stack TypeScript monorepo:

- **Frontend** — React + Vite SPA, Tailwind CSS, shadcn/ui components, Wouter routing, TanStack Query for server state
- **Backend** — Express 5 REST API, JWT authentication, Drizzle ORM, PostgreSQL
- **Shared** — OpenAPI spec as the source of truth; Orval generates typed API hooks and Zod validation schemas from it
- **Monorepo** — pnpm workspaces with these packages:
  - `artifacts/arch-pm` — React frontend
  - `artifacts/api-server` — Express API
  - `lib/db` — Drizzle schema + migrations
  - `lib/api-spec` — OpenAPI YAML + Orval config
  - `lib/api-zod` — generated Zod schemas (output of codegen)
  - `lib/api-client-react` — generated TanStack Query hooks (output of codegen)

---

## Tech Stack

| Layer | Choice |
|---|---|
| Language | TypeScript 5.9, Node.js 22+ |
| Frontend framework | React 18, Vite 7 |
| Styling | Tailwind CSS v4, shadcn/ui (Radix UI primitives) |
| Routing | Wouter |
| Server state | TanStack Query v5 |
| Forms | React Hook Form + Zod resolvers |
| Icons | Lucide React |
| Animation | Framer Motion |
| Charts | Recharts |
| Backend framework | Express 5 |
| ORM | Drizzle ORM |
| Database | PostgreSQL |
| Validation | Zod (`zod/v4`), drizzle-zod |
| Auth | JWT (jsonwebtoken), bcryptjs |
| File uploads | Multer (memory storage) |
| Logging | Pino + pino-http |
| API codegen | Orval (OpenAPI → React Query hooks + Zod schemas) |
| API build | esbuild (CJS bundle with sourcemaps) |
| Google integration | googleapis (OAuth2 + Drive API v3) |
| Deployment | Netlify (frontend static + Express as serverless function via serverless-http) |

---

## Database Schema

All tables use PostgreSQL via Drizzle ORM. Define them in `lib/db/src/schema/`.

### `users`
| Column | Type | Notes |
|---|---|---|
| `id` | serial | Primary key |
| `email` | text | Unique, not null |
| `name` | text | Not null |
| `passwordHash` | text | bcrypt hash, not null |
| `role` | enum (`admin`, `member`) | Default `member` |
| `createdAt` | timestamp | Default `now()` |

### `projects`
| Column | Type | Notes |
|---|---|---|
| `id` | serial | Primary key |
| `name` | text | Not null |
| `description` | text | Nullable |
| `status` | enum (`active`, `on_hold`, `completed`, `archived`) | Default `active` |
| `createdById` | int | FK → `users.id` |
| `createdAt` | timestamp | Default `now()` |
| `updatedAt` | timestamp | Updated on every write |

### `categories`
| Column | Type | Notes |
|---|---|---|
| `id` | serial | Primary key |
| `name` | text | Not null |
| `color` | text | Hex color string |
| `projectId` | int | FK → `projects.id` |
| `createdAt` | timestamp | Default `now()` |

### `tasks`
| Column | Type | Notes |
|---|---|---|
| `id` | serial | Primary key |
| `title` | text | Not null |
| `description` | text | Nullable |
| `status` | enum (`todo`, `in_progress`, `review`, `done`) | Default `todo` |
| `priority` | enum (`low`, `medium`, `high`, `urgent`) | Default `medium` |
| `projectId` | int | FK → `projects.id` |
| `categoryId` | int | FK → `categories.id`, nullable |
| `assignedToId` | int | FK → `users.id`, nullable (primary assignee) |
| `createdById` | int | FK → `users.id` |
| `dueDate` | date | Nullable |
| `createdAt` | timestamp | Default `now()` |
| `updatedAt` | timestamp | Updated on every write |

### `task_assignees` (many-to-many)
| Column | Type | Notes |
|---|---|---|
| `taskId` | int | FK → `tasks.id`, part of composite PK |
| `userId` | int | FK → `users.id`, part of composite PK |

### `files`
| Column | Type | Notes |
|---|---|---|
| `id` | serial | Primary key |
| `name` | text | Original filename |
| `mimeType` | text | e.g. `application/pdf` |
| `size` | int | Bytes |
| `version` | int | Default `1`, increments on re-upload of same name |
| `url` | text | Local path or Google Drive file URL |
| `taskId` | int | FK → `tasks.id` |
| `uploadedById` | int | FK → `users.id` |
| `createdAt` | timestamp | Default `now()` |

### `file_upload_logs`
Tracks the full version history and deletions for audit purposes.

| Column | Type | Notes |
|---|---|---|
| `id` | serial | Primary key |
| `fileId` | int | FK → `files.id`, nullable (null after deletion) |
| `taskId` | int | FK → `tasks.id` |
| `projectId` | int | FK → `projects.id` |
| `name` | text | Filename at time of upload |
| `mimeType` | text | |
| `size` | int | |
| `version` | int | Version number at time of upload |
| `url` | text | |
| `uploadedById` | int | FK → `users.id` |
| `removedAt` | timestamp | Null until deleted |
| `removedById` | int | FK → `users.id`, null until deleted |

### `notes`
Shared notes attached to a project or to a specific task within a project.

| Column | Type | Notes |
|---|---|---|
| `id` | serial | Primary key |
| `content` | text | Not null |
| `projectId` | int | FK → `projects.id` |
| `taskId` | int | FK → `tasks.id`, **nullable** — null means project-level note |
| `userId` | int | FK → `users.id` (author) |
| `createdAt` | timestamp | |
| `updatedAt` | timestamp | |

### `personal_notes`
Private notes visible only to the owning user.

| Column | Type | Notes |
|---|---|---|
| `id` | serial | Primary key |
| `content` | text | Not null |
| `userId` | int | FK → `users.id` |
| `createdAt` | timestamp | |
| `updatedAt` | timestamp | |

### `google_drive_tokens`
Stores a single workspace-wide Google Drive OAuth connection (not per-user).

| Column | Type | Notes |
|---|---|---|
| `id` | serial | Primary key |
| `accessToken` | text | |
| `refreshToken` | text | |
| `expiresAt` | timestamp | |
| `driveRootFolderId` | text | Drive folder ID for uploads |
| `connectedByEmail` | text | Google account email |
| `createdAt` | timestamp | |
| `updatedAt` | timestamp | |

### `activity_logs`
Append-only log of actions across the workspace.

| Column | Type | Notes |
|---|---|---|
| `id` | serial | Primary key |
| `action` | text | Human-readable description, e.g. `"created task"` |
| `entityType` | enum (`project`, `task`, `file`, `user`, `note`) | |
| `entityId` | int | ID of the affected entity |
| `entityName` | text | Snapshot of entity name at time of action |
| `projectId` | int | FK → `projects.id`, nullable |
| `userId` | int | FK → `users.id` (who did it) |
| `createdAt` | timestamp | Default `now()` |

---

## Authentication

- Login endpoint issues a **JWT** signed with `SESSION_SECRET` (env var), expiry 7 days.
- Token is stored in `localStorage` under key `arch_token`.
- Every API request attaches `Authorization: Bearer <token>`.
- `requireAuth` middleware verifies the token and attaches `req.user = { id, email, role }`.
- `requireAdmin` middleware runs after `requireAuth` and returns `403` if `role !== "admin"`.
- `requireAdminFlexible` is a variant that also accepts the token in the `?token=` query param — used for the Google Drive OAuth callback redirect which can't carry headers.
- On cold start the API seeds a default admin: `admin@archfirm.com` / `admin123` (idempotent).

---

## API Routes

All routes are mounted under `/api`. Base: `Express app → app.use("/api", router)`.

### Auth — `/api/auth`
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/login` | Public | Body: `{ email, password }`. Returns `{ token, user }`. |
| GET | `/auth/me` | `requireAuth` | Returns the current user object. |

### Users — `/api/users`
All user routes require `requireAdmin`.

| Method | Path | Description |
|---|---|---|
| GET | `/users` | List all users. |
| POST | `/users` | Create a user. Body: `{ email, name, password, role }`. |
| GET | `/users/:id` | Get single user. |
| PATCH | `/users/:id` | Update user fields. |
| DELETE | `/users/:id` | Delete user. |

### Projects — `/api/projects`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/projects` | `requireAuth` | List all projects (all members see all). |
| POST | `/projects` | `requireAdmin` | Create a project. Body: `{ name, description, status }`. |
| GET | `/projects/:id` | `requireAuth` | Get project with categories and task summary. |
| PATCH | `/projects/:id` | `requireAdmin` | Update project fields. |
| DELETE | `/projects/:id` | `requireAdmin` | Delete project and cascade. |

### Categories — `/api/projects/:projectId/categories`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/projects/:projectId/categories` | `requireAuth` | List categories for a project. |
| POST | `/projects/:projectId/categories` | `requireAuth` | Create a category. Body: `{ name, color }`. |
| PATCH | `/projects/:projectId/categories/:id` | `requireAuth` | Rename / recolor. |
| DELETE | `/projects/:projectId/categories/:id` | `requireAuth` | Delete. Tasks in this category have their `categoryId` set to null. |

### Tasks — `/api/projects/:projectId/tasks`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/projects/:projectId/tasks` | `requireAuth` | List tasks. Supports query filters: `status`, `priority`, `assignedToId`, `categoryId`. |
| POST | `/projects/:projectId/tasks` | `requireAuth` | Create a task. Body: `{ title, description, status, priority, categoryId, assignedToId, dueDate }`. |
| GET | `/projects/:projectId/tasks/:id` | `requireAuth` | Full task detail with assignees, files, notes. |
| PATCH | `/projects/:projectId/tasks/:id` | `requireAuth` | Update any task field. |
| DELETE | `/projects/:projectId/tasks/:id` | `requireAuth` | Delete task (admin or task creator only). |

### Files — `/api/projects/:projectId/tasks/:taskId/files`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/projects/:projectId/tasks/:taskId/files` | `requireAuth` | List current files on task. |
| POST | `/projects/:projectId/tasks/:taskId/files` | `requireAuth` | Upload a file. Multipart form: field `file`. If a file with the same name already exists, the version number increments. Uploads to Google Drive if connected, otherwise saves to local `uploads/` directory. |
| DELETE | `/projects/:projectId/tasks/:taskId/files/:fileId` | `requireAuth` | Soft-delete: marks `removedAt` in `file_upload_logs`, removes from `files` table. |
| GET | `/projects/:projectId/tasks/:taskId/files/history` | `requireAuth` | Returns the full `file_upload_logs` history for the task including deleted files. |
| GET | `/uploads/:filename` | `requireAuth` | Serves a locally stored file by filename. |

### Notes — `/api`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/projects/:projectId/notes` | `requireAuth` | Project-level notes (taskId is null). |
| POST | `/projects/:projectId/notes` | `requireAuth` | Create project note. Body: `{ content }`. |
| GET | `/projects/:projectId/tasks/:taskId/notes` | `requireAuth` | Task-specific notes. |
| POST | `/projects/:projectId/tasks/:taskId/notes` | `requireAuth` | Create task note. Body: `{ content }`. |
| PATCH | `/notes/:id` | `requireAuth` | Edit note content (author or admin only). |
| DELETE | `/notes/:id` | `requireAuth` | Delete note (author or admin only). |

### Personal Notes — `/api/personal-notes`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/personal-notes` | `requireAuth` | List the authenticated user's personal notes. |
| POST | `/personal-notes` | `requireAuth` | Create. Body: `{ content }`. |
| PATCH | `/personal-notes/:id` | `requireAuth` | Edit content. |
| DELETE | `/personal-notes/:id` | `requireAuth` | Delete. |

### Dashboard — `/api/dashboard`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/dashboard/summary` | `requireAuth` | Returns counts: total projects, tasks by status, total files, active members. |
| GET | `/dashboard/recent-activity` | `requireAuth` | Last 10 activity log entries across the workspace. |

### Feed — `/api/feed`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/feed` | `requireAuth` | Returns recent activity entries scoped to projects the current user is involved in. |

### Activity — `/api/projects/:projectId/activity`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/projects/:projectId/activity` | `requireAuth` | Activity log for a single project, newest first. |

### Google Drive — `/api/drive`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/drive/status` | `requireAuth` | Returns `{ connected: bool, email?, folderId? }`. |
| GET | `/drive/auth` | `requireAdminFlexible` | Redirects to Google OAuth2 consent screen. |
| GET | `/drive/callback` | Public (state validated) | OAuth2 callback. Exchanges code, stores tokens in `google_drive_tokens`. Redirects back to settings page. |
| DELETE | `/drive/disconnect` | `requireAdmin` | Clears stored tokens. |

### Health
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/healthz` | Public | Returns `{ ok: true }`. |

---

## Frontend Pages & Routing

The SPA uses Wouter. All routes except `/login` are behind a `ProtectedRoute` that checks `AuthContext`.

| Route | Page | Access |
|---|---|---|
| `/login` | Login form | Public |
| `/` | Dashboard | All authenticated |
| `/projects` | Projects list | All authenticated |
| `/projects/:id` | Project detail (task board) | All authenticated |
| `/projects/:id/tasks/:taskId` | Task detail | All authenticated |
| `/feed` | My feed (activity timeline) | All authenticated |
| `/admin/users` | User management | Admin only |
| `/settings` | Settings + Google Drive | Admin only |

### Login (`/login`)
- Email + password form.
- On success: stores JWT in `localStorage`, updates `AuthContext`, redirects to `/`.
- Shows default credentials hint.

### Dashboard (`/`)
- Stat cards: Total Projects, Total Tasks, Open Tasks, Total Files.
- Task status breakdown bar chart (Recharts).
- Recent workspace activity list.
- Data from `GET /dashboard/summary` and `GET /dashboard/recent-activity`.

### Projects (`/projects`)
- Card grid of all projects, each showing name, description, status badge, task count.
- **Admin only**: "+ New Project" button opens a dialog — fields: Name, Description, Status.
- Status color indicators: active = green, on_hold = yellow, completed = blue, archived = gray.

### Project Detail (`/projects/:id`)
- Header: project name, description, status, edit button (admin).
- **Category tabs**: Each category is a column/tab; tasks are grouped under their category. An "Uncategorized" group handles tasks with no category.
- **Task cards**: Show title, priority badge, assignee avatar, due date. Click opens Task Detail page.
- **Add Task** button: inline dialog, fields: Title, Description, Status, Priority, Category, Assignee, Due Date.
- **Add Category** button: inline dialog, fields: Name, Color.
- **Notes tab**: project-level notes rendered by the `NotesSection` component.
- **Activity tab**: project activity log from `GET /projects/:projectId/activity`.

### Task Detail (`/projects/:id/tasks/:taskId`)
- Full task header: title (editable), status selector, priority selector, due date picker.
- **Assignees**: `AssigneePicker` component — multi-select popover listing all workspace users.
- **Files section**: list of uploaded files with name, size, version number, upload date. Upload button triggers multipart POST. Delete button removes file. "View history" expands to show all versions including deleted ones.
- **Notes section**: task-specific notes using `NotesSection` component.
- All field edits trigger `PATCH /projects/:projectId/tasks/:id` immediately (no save button — auto-save on blur/change).

### My Feed (`/feed`)
- Reverse-chronological list of activity items across projects the user is part of.
- Each item: action description, entity name (linked), timestamp, actor avatar.
- Data from `GET /feed`.

### Admin Users (`/admin/users`)
- Table of all users: name, email, role, created date.
- **Add User** dialog: Email, Name, Password, Role (admin/member).
- Edit row inline: change name, role.
- Delete user with confirmation dialog.

### Settings (`/settings`)
- **Google Drive panel**: shows connection status (email, root folder ID if connected).
  - If not connected: "Connect Google Drive" button → calls `GET /drive/auth` with token in query string → Google consent screen → callback → page reloads connected.
  - If connected: shows connected account email. "Disconnect" button → calls `DELETE /drive/disconnect`.
- **Profile panel**: edit own display name.

---

## Key Frontend Components

### `GlobalSearch`
- Triggered by `⌘K` / `Ctrl+K` keyboard shortcut.
- Command palette (cmdk) that searches projects and tasks.
- Navigates to the relevant detail page on selection.

### `AssigneePicker`
- Popover with a searchable list of all workspace users.
- Multi-select with avatar + name display.
- Submits selected user IDs to the task's assignees list.

### `NotesSection`
- Reusable component used on both Project Detail (project-level) and Task Detail (task-level).
- Accepts a `notes` array, `onAdd`, `onEdit`, `onDelete` callbacks.
- Each note shows author name, timestamp, content, edit/delete actions (own notes or admin).
- Inline textarea for editing with save/cancel.

### `Layout`
- Sidebar navigation: ArchPM logo, links to Dashboard, Projects, My Feed, Admin (if admin role).
- Top bar: current page title, GlobalSearch trigger, user avatar + dropdown (profile, logout).

### Auth (`src/lib/auth.tsx`)
- `AuthContext` + `AuthProvider` wrap the app.
- Reads token from `localStorage` on mount.
- Calls `GET /auth/me` to hydrate the current user.
- `setAuthTokenGetter` registers the token supplier for every generated API hook.
- On 401 error: clears token, redirects to `/login`.

---

## API Client Generation (Orval)

`lib/api-spec/openapi.yaml` defines the entire API surface. Running `pnpm --filter @workspace/api-spec run codegen` generates:

- `lib/api-client-react/src/generated/api.ts` — TanStack Query hooks (e.g. `useGetProjects`, `useCreateTask`, `usePatchTask`)
- `lib/api-zod/src/generated/` — Zod schemas for every request and response type

The custom fetch wrapper in `lib/api-client-react/src/custom-fetch.ts`:
- Prepends `_baseUrl` to relative paths (used in mobile/Expo contexts; on web, left null so calls are relative to the same origin)
- Reads the Bearer token via `_authTokenGetter` and injects the `Authorization` header
- Handles `204`/`205`/`304` responses (no body)
- Parses response as JSON, text, or blob based on content-type

---

## File Upload Flow

1. User selects a file in Task Detail.
2. Frontend POSTs `multipart/form-data` to `/api/projects/:projectId/tasks/:taskId/files` with field `file`.
3. `multer` with memory storage buffers the file in RAM.
4. Route handler checks if Google Drive is connected (queries `google_drive_tokens`):
   - **Drive connected**: uploads buffer to Drive API into the folder hierarchy `ArchPM / <project name> / <task title> / <filename>`. Stores the Drive file URL in `files.url`.
   - **Drive not connected**: writes buffer to `artifacts/api-server/uploads/<uuid>-<filename>`. Stores local path in `files.url`.
5. If a file with the same name already exists on that task, the new record gets `version = existing_max_version + 1`.
6. An `activity_logs` entry is created: `action = "uploaded file"`.

---

## Google Drive OAuth Flow

1. Admin visits Settings → clicks "Connect Google Drive".
2. Frontend navigates to `/api/drive/auth?token=<jwt>` (token in query param because this is a full redirect).
3. `requireAdminFlexible` validates the token from query string.
4. Server redirects to Google's OAuth2 consent URL with scopes: `drive.file`.
5. Google redirects to `/api/drive/callback?code=...&state=...`.
6. Server exchanges code for tokens, stores in `google_drive_tokens` (single row — `UPSERT` pattern).
7. Server creates or finds a root folder `"ArchPM"` in Drive and stores its ID.
8. Redirects browser to `/settings` with a `?connected=1` param.

---

## Activity Logging

Every mutating API operation (create/update/delete on projects, tasks, files, notes, users) appends a row to `activity_logs`. The log entries are read by:
- `GET /dashboard/recent-activity` — workspace-wide, last 10
- `GET /feed` — filtered to the current user's projects
- `GET /projects/:projectId/activity` — project-scoped

---

## Deployment (Netlify)

### What gets deployed
- **Frontend**: `vite build` output at `artifacts/arch-pm/dist/public` → Netlify CDN
- **API**: `netlify/functions/api.ts` wraps the Express app with `serverless-http` → Netlify Function
- **Database**: External PostgreSQL required (e.g. Neon free tier) — set `DATABASE_URL` env var in Netlify

### `netlify.toml`
```toml
[build]
  command = "pnpm install && pnpm --filter @workspace/arch-pm run build"
  publish = "artifacts/arch-pm/dist/public"

[build.environment]
  BASE_PATH = "/"
  NODE_VERSION = "22"
  NODE_ENV = "production"

[functions]
  directory = "netlify/functions"
  node_bundler = "esbuild"
  external_node_modules = ["googleapis", "pg-native", "pino", "pino-http", "pino-pretty"]

[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/api"
  status = 200

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

### Required environment variables
| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (e.g. from Neon) |
| `SESSION_SECRET` | Secret for signing JWTs — use a long random string |

### First-deploy steps
1. Push to GitHub → connect repo to Netlify
2. Set `DATABASE_URL` and `SESSION_SECRET` in Netlify environment variables
3. Run `DATABASE_URL=<url> pnpm --filter @workspace/db run push` locally to apply schema to Neon
4. Deploy — the API seeds the admin user automatically on first request

---

## Visual Design

- **Color palette**: Dark navy sidebar (`#1e2a3b`), white content area, orange accent (`#f97316` / Tailwind `orange-500`) for the logo, primary buttons, and active states.
- **Typography**: System font stack, semi-bold headings.
- **Component style**: shadcn/ui defaults — rounded-md corners, subtle borders, ghost hover states.
- **Status badges**: Color-coded pills — todo: gray, in_progress: blue, review: yellow, done: green; priority: low: slate, medium: blue, high: orange, urgent: red.
- **Layout**: Fixed left sidebar (240px), scrollable right content area, max-width container for content.
- **Login screen**: Split layout — left panel (navy background) with branding tagline, right panel (white) with the sign-in form.

---

## Environment Variables (Development)

| Variable | Where set | Description |
|---|---|---|
| `DATABASE_URL` | Auto-provisioned by Replit | Postgres connection string |
| `SESSION_SECRET` | Replit secret | JWT signing secret |
| `PORT` | Set by Replit workflow | Port for dev server (API: 8080, frontend: dynamic) |
| `BASE_PATH` | Set by Replit workflow | Vite base path (e.g. `/`) |
| `NODE_ENV` | Set per workflow | `development` or `production` |

---

## Scripts

```bash
# Install all workspace dependencies
pnpm install

# Initialize / update DB schema
pnpm --filter @workspace/db run push

# Start API in dev mode (build + start with source maps)
pnpm --filter @workspace/api-server run dev

# Start frontend dev server
pnpm --filter @workspace/arch-pm run dev

# Regenerate API hooks and Zod schemas from OpenAPI spec
pnpm --filter @workspace/api-spec run codegen

# Full typecheck across all packages
pnpm run typecheck

# Build everything
pnpm run build
```
