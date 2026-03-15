# Phase 2: Board CRUD + Dashboard — Implementation Plan

## Overview
Users can create, view, edit, and delete boards. The placeholder boards page becomes a real dashboard with a grid of board cards and a "Create Board" dialog.

---

## Step 1: Add Board + BoardMember Models to Prisma

**What we do:**
- Add `Board` and `BoardMember` models to `prisma/schema.prisma`
- Run a migration to create the new tables
- Regenerate the Prisma client

**Why two models (not just Board)?**
A board needs to track WHO has access and WHAT role they have. This is a many-to-many relationship: one user can be a member of many boards, and one board can have many members.

Instead of a simple array on the Board model, we use a **join table** (`BoardMember`) — the same concept from your database courses. The join table adds extra data: the `role` field (OWNER, ADMIN, MEMBER).

**Board model fields:**
| Field | Type | Why |
|-------|------|-----|
| id | String (cuid) | Unique identifier |
| title | String | Board name ("Sprint 23", "Marketing") |
| description | String? | Optional board description |
| color | String | Hex color for the board card (e.g., "#3B82F6") |
| createdAt | DateTime | When it was created |
| updatedAt | DateTime | Auto-updated on changes |
| ownerId | String (FK → User) | Who created the board |

**BoardMember model fields:**
| Field | Type | Why |
|-------|------|-----|
| id | String (cuid) | Unique identifier |
| role | Enum (OWNER/ADMIN/MEMBER) | Permission level |
| userId | String (FK → User) | The member |
| boardId | String (FK → Board) | The board |
| joinedAt | DateTime | When they joined |

**Unique constraint:** `@@unique([userId, boardId])` — a user can only be a member of a board once.

---

## Step 2: Board tRPC Router (CRUD Procedures)

**What we do:** Create `src/server/trpc/routers/board.ts` with these procedures:

| Procedure | Type | What it does |
|-----------|------|-------------|
| `list` | query | Get all boards where the current user is a member |
| `getById` | query | Get a single board by ID (with member check) |
| `create` | mutation | Create a new board + auto-add creator as OWNER |
| `update` | mutation | Update board title/description/color (OWNER/ADMIN only) |
| `delete` | mutation | Delete a board (OWNER only) |

**Why all procedures are `protectedProcedure`:**
Every board operation requires knowing WHO is making the request. You can't list "my boards" without knowing who "me" is. The `protectedProcedure` middleware we built in Phase 1 ensures a valid session exists and provides `ctx.session.user.id`.

**Authorization pattern:**
For `update` and `delete`, we need to check not just "are you logged in?" but "are you an OWNER/ADMIN of THIS board?" This is **authorization** (what you're allowed to do) vs **authentication** (who you are). We'll check the user's role in the BoardMember table before allowing the operation.

---

## Step 3: Dashboard Page — Board Grid

**What we do:** Replace the placeholder boards page with a real dashboard.

**Files:**
- `src/app/(dashboard)/boards/page.tsx` — Calls tRPC to fetch boards, renders grid
- `src/components/board/board-card.tsx` — Individual board card component
- `src/components/board/board-list.tsx` — Grid layout of board cards

**How data flows:**
1. Page is a Server Component → calls `serverTRPC().board.list()`
2. Returns the user's boards from the database
3. Renders a CSS Grid of `BoardCard` components
4. Each card shows: title, description preview, color accent, member count

**Why Server Component for the page?**
The initial board list doesn't need client-side interactivity — it's just data display. Server Components are faster (no JS sent to browser) and can call tRPC directly. We only use Client Components for interactive parts (create dialog, delete button).

---

## Step 4: Create Board Dialog

**What we do:** Add a dialog/modal for creating new boards.

**Files:**
- `src/components/board/create-board-dialog.tsx` — Client Component with form

**The form includes:**
- Board title (required)
- Description (optional)
- Color picker (preset colors to choose from)

**How it works:**
1. User clicks "Create Board" card (a special card in the grid)
2. Dialog opens with the form
3. User fills in details, clicks "Create"
4. tRPC mutation `board.create` fires
5. On success: dialog closes, page refreshes to show new board
6. On error: show error message in the dialog

**Why a dialog instead of a separate page?**
Creating a board is a quick action — just a title and color. A full page would feel heavy. Dialogs keep the user in context (they can see their existing boards behind the modal).

---

## Step 5: Edit & Delete Board

**What we do:** Add ability to edit board details and delete boards.

**Files:**
- `src/components/board/edit-board-dialog.tsx` — Edit form in a dialog
- Add delete confirmation to board card's dropdown menu

**Edit:** Same form as create, but pre-filled with current values. Uses `board.update` mutation.

**Delete:** Shows a confirmation dialog ("Are you sure? This will delete all columns and cards."). Uses `board.delete` mutation. Only the board OWNER can delete.

**Why confirmation for delete?**
Deleting a board is destructive and irreversible (it cascades to columns, cards, comments, etc.). A confirmation step prevents accidental data loss. This is standard UX practice for destructive actions.

---

## Step 6: Update Seed Script

**What we do:** Add test boards and board memberships to the seed script.

**Test data:**
- 2-3 boards with different colors
- Alice owns all boards (she's our primary test user)
- Bob and Charlie are members of some boards

This lets you test the dashboard immediately after seeding — no manual board creation needed.

---

## File Creation Order

```
1. prisma/schema.prisma — Add Board, BoardMember, Role enum
2. Run: npx prisma migrate dev --name add-boards
3. src/server/trpc/routers/board.ts — Board CRUD procedures
4. src/server/trpc/routers/_app.ts — Register board router
5. src/components/board/board-card.tsx — Board card component
6. src/components/board/board-list.tsx — Board grid layout
7. src/components/board/create-board-dialog.tsx — Create form
8. src/components/board/edit-board-dialog.tsx — Edit form
9. src/app/(dashboard)/boards/page.tsx — Update with real data
10. prisma/seed.ts — Add test boards
```

---

## New shadcn/ui Components Needed

| Component | Why |
|-----------|-----|
| `dialog` | Create/edit board modals |
| `textarea` | Board description field |
| `badge` | Member count, role display |
| `tooltip` | Hover info on board cards |

---

## What You'll Have After Phase 2

- A real dashboard showing all your boards in a color-coded grid
- Create new boards with title, description, and color
- Edit board details (title, description, color)
- Delete boards with confirmation
- Role-based access (only OWNER can delete)
- Clicking a board card navigates to `/boards/[id]` (built in Phase 3)
