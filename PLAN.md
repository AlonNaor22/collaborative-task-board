# Real-Time Collaborative Task Board (Kanban)

A full-stack, real-time collaborative Kanban board built with Next.js, TypeScript, PostgreSQL, and Socket.io.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14+ (App Router), TypeScript, TailwindCSS, shadcn/ui |
| API | tRPC v11 (end-to-end type safety) |
| Database | PostgreSQL + Prisma ORM |
| Auth | Auth.js v5 (Credentials provider) |
| Real-time | Socket.io (custom server) |
| Drag & Drop | @dnd-kit |
| State | TanStack Query (server) + Zustand (UI) |
| File uploads | Local filesystem |

## Database Schema

**10 models:**

- `User` - Authentication and profile
- `Board` - Kanban boards with title, description, color
- `BoardMember` - Board membership with roles (OWNER/ADMIN/MEMBER)
- `Column` - Board columns with position-based ordering
- `Card` - Cards within columns (title, description, due date, position)
- `CardAssignee` - Many-to-many user-card assignments
- `Label` - Board-scoped color-coded labels
- `CardLabel` - Many-to-many card-label associations
- `Comment` - Card comment threads
- `Attachment` - File attachments on cards
- `Activity` - Audit log with JSON payloads for flexible details
- `Notification` - In-app notifications (assignment, mention, due date, invitation)

## Project Structure

```
collaborative-task-board/
├── prisma/schema.prisma, migrations/, seed.ts
├── server.ts                    # Custom server (Next.js + Socket.io)
├── src/
│   ├── app/                     # Next.js App Router pages
│   │   ├── (auth)/              # Login, Register pages
│   │   ├── (dashboard)/         # Boards list, Board view, Notifications, Profile
│   │   └── api/                 # tRPC handler, file upload endpoint
│   ├── server/                  # Backend logic
│   │   ├── auth.ts, db.ts       # Auth config, Prisma client
│   │   ├── trpc/routers/        # board, column, card, comment, label, activity, notification, member
│   │   └── socket/handlers/     # Board events, notification events
│   ├── components/
│   │   ├── ui/                  # shadcn/ui base components
│   │   ├── kanban/              # Board, Column, Card, Drag overlay
│   │   ├── card-detail/         # Description, labels, due date, assignees, comments, attachments
│   │   ├── board/               # Board list, board card, members, invite dialog
│   │   └── notifications/       # Bell, list, item
│   ├── hooks/                   # use-socket, use-board-store
│   ├── trpc/                    # Client-side tRPC provider
│   └── lib/                     # Utils, Zod validators, constants, types
```

## Implementation Phases

### Phase 1: Scaffolding + Auth (Week 1-2)

**Goal:** Working Next.js app with user authentication and basic page structure.

- Initialize Next.js 14 + TypeScript + TailwindCSS + shadcn/ui
- Set up PostgreSQL + Prisma (User model only)
- Configure tRPC with `publicProcedure` and `protectedProcedure`
- Auth.js v5 with Credentials provider (register, login, logout)
- Protected route middleware
- Basic navbar with user menu

**Key dependencies:**
```
next react react-dom typescript tailwindcss
@prisma/client prisma next-auth@beta
@trpc/server @trpc/client @trpc/tanstack-react-query @tanstack/react-query
zod superjson bcryptjs
```

---

### Phase 2: Board CRUD + Dashboard (Week 2-3)

**Goal:** Users can create, view, edit, and delete boards.

- Add Board + BoardMember models to Prisma schema
- Board CRUD tRPC procedures
- Dashboard page with board grid layout
- Sidebar listing recent boards
- Create board dialog, edit/delete with confirmation
- Seed script for test data

---

### Phase 3: Kanban Board with Drag & Drop (Week 3-5)

**Goal:** Core Kanban experience - columns, cards, and drag-and-drop.

- Add Column + Card models
- Column/card CRUD and reorder procedures
- @dnd-kit integration:
  - `DndContext` wrapping the board
  - `SortableContext` per column (vertical card sorting)
  - Horizontal column sorting
  - `DragOverlay` for visual feedback
- Optimistic updates: Zustand for immediate UI + TanStack Query for server sync
- Inline card title editing

**Key dependencies:** `@dnd-kit/core @dnd-kit/sortable zustand`

---

### Phase 4: Card Details (Week 5-6)

**Goal:** Rich card detail modal with all metadata features.

- Add Label, CardLabel, CardAssignee, Attachment models
- Card detail dialog (URL-addressable via `?card=<id>`)
- Markdown description with preview toggle
- Due date picker with overdue/upcoming indicators
- Color-coded label system (board-scoped)
- Assignee management (pick from board members)
- File attachments (upload, view, delete)

**Key dependencies:** `react-markdown date-fns`

---

### Phase 5: Comments + Activity Log (Week 6-7)

**Goal:** Social features and audit trail.

- Add Comment + Activity models
- Comment threads on cards with create/edit/delete
- @mention autocomplete for board members
- Activity timeline per board and per card
- `logActivity()` helper called from tRPC mutations
- Relative timestamps ("2 hours ago")

---

### Phase 6: Real-Time with WebSockets (Week 7-8)

**Goal:** Live collaboration - changes sync across all connected clients.

- Custom `server.ts` running Next.js + Socket.io on one port
- Board rooms: clients join/leave when viewing a board
- tRPC mutations broadcast events to board rooms after success
- Remote events trigger TanStack Query cache invalidation
- User presence indicators (who's viewing this board)
- Connection status indicator (online/offline/reconnecting)
- Socket auth middleware validates session tokens

**Key dependencies:** `socket.io socket.io-client`

---

### Phase 7: Notifications + Board Sharing (Week 8-9)

**Goal:** Complete collaboration with invitations and notifications.

- Invite users to boards by email
- Accept/decline invitations
- Board member management (view, change roles, remove)
- In-app notifications: assignment, @mention, due date, invitation
- Notification bell with unread count badge
- Mark as read (individual + bulk)
- Real-time notification delivery via Socket.io user rooms

---

### Phase 8: Polish + Testing + README (Week 9-10)

**Goal:** Production-quality UX and portfolio-ready documentation.

- Skeleton loaders for all loading states
- Error boundaries and error pages
- Toast notifications for mutation feedback
- Responsive design (mobile-friendly)
- Dark mode (next-themes + Tailwind dark variants)
- Keyboard shortcuts (Escape, Enter)
- Search/filter cards within a board
- Vitest tests for tRPC procedures and key components
- docker-compose.yml for PostgreSQL
- Comprehensive README with screenshots and architecture diagram

**Key dependencies:** `vitest @testing-library/react next-themes`

## Environment Variables

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/taskboard?schema=public"
AUTH_SECRET="generate-with-openssl-rand-base64-32"
AUTH_URL="http://localhost:3000"
UPLOAD_DIR="./public/uploads"
MAX_FILE_SIZE_MB=10
```

## Key Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| Concurrent drag conflicts | Server is source of truth; broadcast authoritative positions to all clients |
| Socket.io + App Router | Custom server.ts bypasses App Router WebSocket limitation |
| TypeScript learning curve | Phase 1 is minimal; tRPC + Prisma auto-generate most types |
| @dnd-kit complexity | Phase 3 gets 2 weeks; follow existing Kanban reference implementations |
