# Phase 3: Kanban Board with Drag & Drop

**Goal:** Core Kanban experience — columns, cards, and drag-and-drop reordering.

When you open a board, you'll see columns (like "To Do", "In Progress", "Done") arranged horizontally. Each column contains cards stacked vertically. You can drag cards between columns and reorder both cards and columns.

---

## Step 1: Add Column + Card Models to Prisma

### What we're adding

Two new models that represent the core Kanban data:

**Column model:**
- `id` — unique identifier (cuid)
- `title` — column name (e.g., "To Do", "In Progress")
- `position` — integer for ordering columns left-to-right
- `boardId` — which board this column belongs to
- Relations: belongs to Board, has many Cards

**Card model:**
- `id` — unique identifier (cuid)
- `title` — card title (the main text you see)
- `description` — optional longer description (for Phase 4's detail modal)
- `position` — integer for ordering cards top-to-bottom within a column
- `columnId` — which column this card is in
- `creatorId` — who created the card
- `dueDate` — optional due date (for Phase 4)
- Relations: belongs to Column, belongs to User (creator)

### Why `position` is an integer (not float)

We use integers for ordering (0, 1, 2, 3...). When you reorder, we update ALL positions in that column/board. This is simpler than "fractional indexing" (where you'd insert 1.5 between 1 and 2) and works great for boards with reasonable numbers of cards (< 1000).

**Think of it like an array index** — when you insert into the middle of an array, all elements after shift. Same concept here, but in the database.

### Why `onDelete: Cascade` everywhere

When you delete a board → its columns are deleted → their cards are deleted. This is a database-level cascade, meaning PostgreSQL handles it automatically. Without this, deleting a board would fail because columns still reference it (foreign key violation).

---

## Step 2: Column tRPC Router

### Procedures

| Procedure | Type | Input | What it does |
|-----------|------|-------|-------------|
| `list` | Query | `boardId` | Get all columns for a board (with their cards), ordered by position |
| `create` | Mutation | `boardId, title` | Create a new column at the end (position = max + 1) |
| `update` | Mutation | `id, title` | Rename a column |
| `delete` | Mutation | `id` | Delete column and all its cards |
| `reorder` | Mutation | `boardId, columnIds[]` | Reorder all columns by providing the new order |

### Why `reorder` takes the full array

Instead of "move column X to position Y", we send the entire ordered list of column IDs. This is simpler and avoids race conditions — the server just sets position = index for each ID. The client already knows the new order (from the drag), so we send it directly.

### Authorization

All column operations require board membership. We check that the current user is a member of the board before allowing any operation. Column creation/deletion requires OWNER or ADMIN role.

---

## Step 3: Card tRPC Router

### Procedures

| Procedure | Type | Input | What it does |
|-----------|------|-------|-------------|
| `create` | Mutation | `columnId, title` | Create a new card at the bottom of a column |
| `update` | Mutation | `id, title?, description?` | Update card fields |
| `delete` | Mutation | `id` | Delete a card |
| `move` | Mutation | `cardId, targetColumnId, cardIds[]` | Move a card (possibly to a different column) and reorder |

### Why `move` is special

Drag-and-drop can do two things at once:
1. **Reorder within a column** — drag a card up/down in the same column
2. **Move across columns** — drag a card from "To Do" to "In Progress"

The `move` procedure handles both cases. It receives:
- `cardId` — which card was dragged
- `targetColumnId` — which column to put it in (might be the same column)
- `cardIds` — the new order of ALL cards in the target column

The server updates the card's `columnId` (if changed) and sets positions for all cards in the target column.

---

## Step 4: Install Dependencies

### @dnd-kit (Drag and Drop)

`@dnd-kit` is a modern React drag-and-drop library. Unlike older libraries (react-beautiful-dnd), it's:
- Built for React 18+ (works with concurrent features)
- Modular — install only what you need
- Accessible — keyboard and screen reader support built-in

We need three packages:
- `@dnd-kit/core` — the DndContext provider, sensors (mouse, touch, keyboard)
- `@dnd-kit/sortable` — SortableContext for reorderable lists
- `@dnd-kit/utilities` — CSS transform helpers

### Zustand (UI State)

Zustand is a lightweight state manager. We use it for **optimistic updates** during drag-and-drop:

**The problem:** When you drag a card, the UI should update INSTANTLY. But the server call takes ~100ms. If we wait for the server, the card would "snap back" then move — terrible UX.

**The solution:**
1. User drags card → Zustand updates local state immediately (card appears in new position)
2. In the background, tRPC sends the mutation to the server
3. When server responds, TanStack Query updates the cache with the server's authoritative data
4. If server fails, we rollback the optimistic update

**Why not just React state?** Because drag-and-drop state needs to be shared between the Board, Column, and Card components. Zustand gives us a global store that any component can read/write without prop drilling.

---

## Step 5: Build Board View Page + Kanban Components

### Component tree

```
/boards/[id]/page.tsx (Server Component)
  └── KanbanBoard (Client Component — needs DndContext)
        ├── KanbanColumn (one per column)
        │     ├── Column header (title + add card button)
        │     ├── KanbanCard (one per card)
        │     │     └── Card title + metadata preview
        │     └── Add card input
        └── Add column button
```

### Why KanbanBoard must be a Client Component

Drag-and-drop requires:
- Event listeners (mouse/touch/keyboard)
- State management (which item is being dragged)
- React context (DndContext wraps everything)

None of these work in Server Components. So the board page (Server Component) fetches the initial data, then passes it to KanbanBoard (Client Component) which handles all interactivity.

### The board page route

`/boards/[id]` — a dynamic route where `[id]` is the board's cuid. The Server Component:
1. Fetches the board data (columns + cards) via `serverTRPC()`
2. Checks if user is a member (redirects if not)
3. Passes the data to `<KanbanBoard>`

---

## Step 6: Add Drag-and-Drop with @dnd-kit

### How @dnd-kit works (conceptual)

Think of it like a coordinate system:

1. **DndContext** — wraps everything, tracks the active drag operation
2. **Sensors** — detect drag gestures (mouse click+drag, touch, keyboard arrows)
3. **SortableContext** — wraps a list of sortable items, provides the "slots" where items can go
4. **useSortable()** — hook on each draggable item, returns CSS transforms to animate movement
5. **DragOverlay** — a "ghost" of the item that follows your cursor during drag

### Two levels of sorting

**Horizontal:** Columns are sorted left-to-right within the board
```
DndContext
  └── SortableContext (columns, horizontal strategy)
        ├── Column 1 (useSortable)
        ├── Column 2 (useSortable)
        └── Column 3 (useSortable)
```

**Vertical:** Cards are sorted top-to-bottom within each column
```
Each Column
  └── SortableContext (cards in this column, vertical strategy)
        ├── Card A (useSortable)
        ├── Card B (useSortable)
        └── Card C (useSortable)
```

### Key events

- **onDragStart** — save which item is being dragged (to show in DragOverlay)
- **onDragOver** — fires when dragging over a different container (moving card to another column)
- **onDragEnd** — the drop happened, fire the mutation to persist the change

### Collision detection

We use `closestCorners` collision detection (not `closestCenter`). This works better for Kanban boards because cards can be dragged into empty columns — `closestCorners` detects the column boundary even when there are no cards to collide with.

---

## Step 7: Update Seed Script

Add columns and cards to the seed data so you have something to see when you open a board:

**Sprint 23 board:**
- To Do (3 cards)
- In Progress (2 cards)
- Done (1 card)

**Marketing Campaign board:**
- Ideas (2 cards)
- Planning (1 card)
- Executing (0 cards)

---

## Step 8: Test End-to-End

1. Run migration and seed
2. Log in as Alice
3. Click a board to open it
4. Verify columns and cards render correctly
5. Add a new column, rename it, delete it
6. Add a new card to a column
7. Drag a card within a column (reorder)
8. Drag a card to a different column (move)
9. Drag a column to reorder columns
10. Verify changes persist after page refresh

---

## New Dependencies Summary

| Package | Purpose |
|---------|---------|
| `@dnd-kit/core` | Drag-and-drop engine (DndContext, sensors) |
| `@dnd-kit/sortable` | Sortable lists (SortableContext, useSortable) |
| `@dnd-kit/utilities` | CSS transform utilities |
| `zustand` | Lightweight state management for optimistic updates |

## Files We'll Create/Modify

| File | Action |
|------|--------|
| `prisma/schema.prisma` | Add Column + Card models |
| `src/server/trpc/routers/column.ts` | New — column CRUD + reorder |
| `src/server/trpc/routers/card.ts` | New — card CRUD + move |
| `src/server/trpc/routers/_app.ts` | Add column + card routers |
| `src/app/(dashboard)/boards/[id]/page.tsx` | New — board view page |
| `src/components/kanban/kanban-board.tsx` | New — main board component |
| `src/components/kanban/kanban-column.tsx` | New — column component |
| `src/components/kanban/kanban-card.tsx` | New — card component |
| `src/hooks/use-board-store.ts` | New — Zustand store for board state |
| `prisma/seed.ts` | Add columns + cards to seed data |
