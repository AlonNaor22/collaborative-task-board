import { create } from "zustand";

// ──────────────────────────────────────────────
// Board Store — Zustand
// ──────────────────────────────────────────────
// This is our client-side state for the Kanban board.
//
// WHY DO WE NEED THIS?
// When a user drags a card, we want the UI to respond instantly.
// But saving to the server takes time (network round-trip). So we:
//   1. Update the local store immediately (optimistic update)
//   2. Send the mutation to the server in the background
//   3. If the server fails, roll back the local state
//
// Without this store, we'd have to wait for the server before the
// UI reflects the drag — which would feel sluggish and broken.
//
// WHY ZUSTAND (not useState or useContext)?
// - useState is local to one component; the board, column, and card
//   components all need to share and modify the same data.
// - useContext works but re-renders the entire tree on every change.
// - Zustand is lightweight and only re-renders components that
//   actually use the changed piece of state.
//
// ANALOGY:
// Think of the store like a Redux store (if you've seen that), but
// without all the boilerplate. It's a singleton shared across the app.

// ─── Types ───
// We define the shape of our data here.
// These mirror the Prisma types but without the database-specific fields.

export type CardData = {
  id: string;
  title: string;
  description: string | null;
  position: number;
  columnId: string;
  dueDate: Date | null;
  creatorId: string;
  creator: {
    id: string;
    name: string | null;
    image: string | null;
  };
};

export type ColumnData = {
  id: string;
  title: string;
  position: number;
  boardId: string;
  cards: CardData[];
};

// ─── Store State + Actions ───
// The store holds:
//   - columns: the current list of columns (with cards nested inside)
//   - setColumns: replace the entire column list (used on initial load)
//   - moveCard: move a card within or between columns
//   - reorderColumns: reorder the column list

type BoardStore = {
  columns: ColumnData[];

  // Replace the entire board state (called when we load the board page)
  setColumns: (columns: ColumnData[]) => void;

  // Move a card to a new position within or between columns.
  // This mutates the local state only — the caller is responsible
  // for persisting to the server.
  moveCard: (
    cardId: string,
    sourceColumnId: string,
    targetColumnId: string,
    newTargetCardIds: string[], // full ordered list of card IDs in target column
    newSourceCardIds?: string[] // full ordered list remaining in source column (cross-column only)
  ) => void;

  // Reorder columns by providing them in a new order.
  reorderColumns: (newColumns: ColumnData[]) => void;
};

// ─── create() ───
// This is the Zustand factory. It takes a function that receives
// `set` (like React's setState) and returns the initial state + actions.
//
// `set` works like React's setState but for the store:
//   set({ columns: [...] }) — replaces just the `columns` field
//   set((state) => ({ ... })) — functional update (like useState callback form)

export const useBoardStore = create<BoardStore>((set) => ({
  columns: [],

  setColumns: (columns) => set({ columns }),

  moveCard: (cardId, sourceColumnId, targetColumnId, newTargetCardIds, newSourceCardIds) => {
    set((state) => {
      // Deep clone so we don't mutate state directly.
      // Zustand requires a new reference to trigger re-renders.
      const columns = state.columns.map((col) => ({ ...col, cards: [...col.cards] }));

      const sourceCol = columns.find((c) => c.id === sourceColumnId);
      const targetCol = columns.find((c) => c.id === targetColumnId);
      if (!sourceCol || !targetCol) return state;

      // Find the card being moved
      const card = sourceCol.cards.find((c) => c.id === cardId);
      if (!card) return state;

      if (sourceColumnId === targetColumnId) {
        // ── Same-column reorder ──
        // Re-order the cards in the column to match newTargetCardIds.
        // We map each ID to its card object, preserving all card data.
        targetCol.cards = newTargetCardIds
          .map((id) => targetCol.cards.find((c) => c.id === id)!)
          .filter(Boolean)
          .map((c, i) => ({ ...c, position: i }));
      } else {
        // ── Cross-column move ──
        // 1. Remove the card from the source column
        sourceCol.cards = (newSourceCardIds ?? [])
          .map((id) => sourceCol.cards.find((c) => c.id === id)!)
          .filter(Boolean)
          .map((c, i) => ({ ...c, position: i }));

        // 2. Insert the card into the target column at the right position.
        //    newTargetCardIds already includes the moved card in its new spot.
        const movedCard = { ...card, columnId: targetColumnId };
        targetCol.cards = newTargetCardIds
          .map((id) => (id === cardId ? movedCard : targetCol.cards.find((c) => c.id === id)!))
          .filter(Boolean)
          .map((c, i) => ({ ...c, position: i }));
      }

      return { columns };
    });
  },

  reorderColumns: (newColumns) => {
    set({ columns: newColumns.map((col, i) => ({ ...col, position: i })) });
  },
}));
