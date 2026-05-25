# Collaborative Task Board

A full-stack collaborative Kanban board built as a portfolio project. Users can create boards, manage columns and cards with drag-and-drop, assign members, add labels, and set due dates.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 (App Router), TypeScript, Tailwind CSS, shadcn/ui |
| API | tRPC v11 (end-to-end type safety) |
| Database | PostgreSQL + Prisma ORM |
| Auth | Auth.js v5 (Credentials provider) |
| Drag & Drop | @dnd-kit/core + @dnd-kit/sortable |
| State | TanStack Query (server state) + Zustand (UI state) |

## Features Implemented

- **Authentication** — Register, login, logout with hashed passwords (bcryptjs) and session middleware
- **Board CRUD** — Create, edit, delete boards with color accents; role-based access (OWNER / ADMIN / MEMBER)
- **Kanban Board** — Columns with drag-and-drop reordering; cards draggable across columns and within columns; optimistic updates via Zustand
- **Card Details** — Rich modal with description, color-coded labels (board-scoped), member assignees, and due date picker with overdue/upcoming indicators

## Setup

### Prerequisites

- Node.js 18+
- PostgreSQL running locally (or a connection string to a hosted instance)

### Installation

```bash
git clone https://github.com/AlonNaor22/collaborative-task-board.git
cd collaborative-task-board
npm install
```

### Environment Variables

Create a `.env` file in the project root:

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/taskboard?schema=public"
AUTH_SECRET="generate-with-openssl-rand-base64-32"
AUTH_URL="http://localhost:3000"
```

Generate `AUTH_SECRET` with:
```bash
openssl rand -base64 32
```

### Database

```bash
npx prisma migrate dev
npx prisma db seed
```

The seed creates 3 test users (Alice, Bob, Charlie) with password `password123` and sample boards.

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

```
collaborative-task-board/
├── prisma/
│   ├── schema.prisma       # Database models
│   ├── migrations/         # Migration history
│   └── seed.ts             # Test data seed script
├── src/
│   ├── app/
│   │   ├── (auth)/         # Login + Register pages
│   │   ├── (dashboard)/    # Boards list + Board view
│   │   └── api/trpc/       # tRPC HTTP handler
│   ├── server/
│   │   ├── auth.ts         # Auth.js config
│   │   ├── db.ts           # Prisma client singleton
│   │   └── trpc/routers/   # board, column, card routers
│   ├── components/
│   │   ├── ui/             # shadcn/ui base components
│   │   ├── kanban/         # Board, Column, Card, DragOverlay
│   │   └── card-detail/    # Labels, assignees, due date
│   └── trpc/               # Client-side tRPC provider + hooks
```

## Running Tests

```bash
npm test
```

Tests cover board logic, authentication, utility functions, and notification handling.

## Roadmap

| Phase | Feature | Status |
|-------|---------|--------|
| 1 | Scaffolding + Auth | ✅ Complete |
| 2 | Board CRUD + Dashboard | ✅ Complete |
| 3 | Kanban + Drag & Drop | ✅ Complete |
| 4 | Card Details (labels, assignees, due dates) | ✅ Complete |

Planned features tracked in the [issues tab](../../issues).
