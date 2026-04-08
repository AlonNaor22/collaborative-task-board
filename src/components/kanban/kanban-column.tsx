"use client";

import { useState } from "react";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Trash2, X, Check } from "lucide-react";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KanbanCard } from "./kanban-card";
import type { ColumnData } from "@/hooks/use-board-store";

// ──────────────────────────────────────────────
// KanbanColumn — A single column on the board
// ──────────────────────────────────────────────
// Each column:
//   - Is itself draggable (for reordering columns left/right)
//   - Contains a SortableContext for its cards (drag up/down)
//   - Has an "Add card" inline form at the bottom
//   - Has a "Delete column" button (for OWNER/ADMIN)
//
// TWO LEVELS OF DRAG-AND-DROP:
// The board has a two-level DnD hierarchy:
//   Level 1 (horizontal): columns drag left/right
//   Level 2 (vertical): cards within a column drag up/down
//
// @dnd-kit handles this with nested SortableContexts.
// The outer SortableContext (in KanbanBoard) tracks columns.
// Each column has its own SortableContext tracking its cards.
//
// The column component itself uses useSortable to be draggable (Level 1).
// Each KanbanCard inside uses useSortable for Level 2.

interface KanbanColumnProps {
  column: ColumnData;
  boardId: string;
  isOwnerOrAdmin: boolean;
  onCardDelete: (cardId: string, columnId: string) => void;
  isDeletingCard?: string | null; // cardId being deleted
  onCardClick?: (cardId: string) => void;
}

export function KanbanColumn({
  column,
  boardId,
  isOwnerOrAdmin,
  onCardDelete,
  isDeletingCard,
  onCardClick,
}: KanbanColumnProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  // The correct query key for this board's columns — used for cache invalidation.
  // tRPC structures keys as [["column", "list"], { input, type }], so we always
  // derive it from queryOptions rather than hardcoding a string array.
  const columnListKey = trpc.column.list.queryOptions({ boardId }).queryKey;

  // ─── Column drag (Level 1) ───
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: column.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  // ─── Add card inline form state ───
  const [isAddingCard, setIsAddingCard] = useState(false);
  const [newCardTitle, setNewCardTitle] = useState("");

  // ─── Create card mutation ───
  // After creating a card, we invalidate the column.list query so the
  // board re-fetches fresh data from the server.
  // `invalidateQueries` is TanStack Query's cache invalidation — it marks
  // the cached data as stale and triggers a background re-fetch.
  const createCardMutation = useMutation(
    trpc.card.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: columnListKey });
        setNewCardTitle("");
        setIsAddingCard(false);
      },
      onError: (err) => {
        toast.error(err.message ?? "Failed to add card");
      },
    })
  );

  // ─── Delete column mutation ───
  const deleteColumnMutation = useMutation(
    trpc.column.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: columnListKey });
        toast.success(`Column "${column.title}" deleted`);
      },
      onError: (err) => {
        toast.error(err.message ?? "Failed to delete column");
      },
    })
  );

  function handleAddCard() {
    const title = newCardTitle.trim();
    if (!title) return;
    createCardMutation.mutate({ columnId: column.id, title });
  }

  function handleDeleteColumn() {
    if (!confirm(`Delete column "${column.title}" and all its cards?`)) return;
    deleteColumnMutation.mutate({ id: column.id });
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex w-[85vw] sm:w-72 shrink-0 flex-col rounded-lg border bg-muted/40"
    >
      {/* ─── Column Header ─── */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        {/* Drag handle for moving the column */}
        {isOwnerOrAdmin && (
          <button
            className="cursor-grab touch-none text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing hover:opacity-100"
            {...attributes}
            {...listeners}
            aria-label="Drag column"
          >
            <GripVertical className="h-4 w-4" />
          </button>
        )}

        <h3 className="flex-1 text-sm font-semibold">{column.title}</h3>

        {/* Card count badge */}
        <span className="text-xs text-muted-foreground tabular-nums">
          {column.cards.length}
        </span>

        {/* Delete column — only OWNER/ADMIN */}
        {isOwnerOrAdmin && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-destructive"
            onClick={handleDeleteColumn}
            disabled={deleteColumnMutation.isPending}
            aria-label="Delete column"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* ─── Cards List ───
        SortableContext tells @dnd-kit:
          "These items (by ID) are sortable within this container."
        When a card is dragged over this column's SortableContext,
        @dnd-kit uses the `strategy` to figure out where to insert it.

        verticalListSortingStrategy: optimized for top-to-bottom lists.
        It calculates drop position based on the midpoint of each card.
        Think of it like: "if I drag above the middle of a card, insert before it".

        The `items` array MUST be the IDs in their current display order.
      */}
      <div className="flex flex-col gap-2 overflow-y-auto px-3 pb-3" style={{ maxHeight: "calc(100dvh - 200px)" }}>
        <SortableContext
          items={column.cards.map((c) => c.id)}
          strategy={verticalListSortingStrategy}
        >
          {column.cards.map((card) => (
            <KanbanCard
              key={card.id}
              card={card}
              onDelete={(cardId) => onCardDelete(cardId, column.id)}
              isDeleting={isDeletingCard === card.id}
              onClick={onCardClick}
            />
          ))}
        </SortableContext>

        {/* Empty column hint */}
        {column.cards.length === 0 && !isAddingCard && (
          <p className="py-4 text-center text-xs text-muted-foreground">
            No cards yet
          </p>
        )}

        {/* ─── Inline Add Card Form ─── */}
        {isAddingCard && (
          <div className="flex flex-col gap-2">
            <Input
              autoFocus
              placeholder="Card title..."
              value={newCardTitle}
              onChange={(e) => setNewCardTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddCard();
                if (e.key === "Escape") {
                  setIsAddingCard(false);
                  setNewCardTitle("");
                }
              }}
              className="h-8 text-sm"
            />
            <div className="flex gap-1">
              <Button
                size="sm"
                className="h-7 flex-1 text-xs"
                onClick={handleAddCard}
                disabled={!newCardTitle.trim() || createCardMutation.isPending}
              >
                <Check className="mr-1 h-3 w-3" />
                Add
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => {
                  setIsAddingCard(false);
                  setNewCardTitle("");
                }}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ─── Add Card Button ─── */}
      {!isAddingCard && (
        <button
          className="flex items-center gap-1.5 px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors border-t"
          onClick={() => setIsAddingCard(true)}
        >
          <Plus className="h-3.5 w-3.5" />
          Add card
        </button>
      )}
    </div>
  );
}
