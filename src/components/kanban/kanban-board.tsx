"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  arrayMove,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { createPortal } from "react-dom";
import { Plus, X, Check, Activity, Search } from "lucide-react";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KanbanColumn } from "./kanban-column";
import { KanbanCard } from "./kanban-card";
import { CardDetailModal } from "./card-detail-modal";
import { ActivityPanel } from "./activity-panel";
import { useBoardStore, type ColumnData, type CardData } from "@/hooks/use-board-store";
import { useSocket } from "@/hooks/use-socket";
import { useBoardFilters } from "@/hooks/use-board-filters";
import { FilterBar } from "./filter-bar";
import { isPast, isToday, addDays } from "date-fns";
import { BoardPresence } from "@/components/board/board-presence";
import { ConnectionStatusIndicator } from "@/components/board/connection-status";

// ──────────────────────────────────────────────
// KanbanBoard — The Full Board with DnD
// ──────────────────────────────────────────────
// This is the root Client Component for a board page.
// It owns:
//   1. Fetching columns + cards from tRPC
//   2. Syncing server data → Zustand store
//   3. Setting up DnD context (@dnd-kit)
//   4. Handling drag events (onDragStart, onDragOver, onDragEnd)
//   5. Rendering KanbanColumn list + DragOverlay
//   6. "Add column" form (OWNER/ADMIN only)
//   7. Board-wide activity panel (Phase 5)
//
// HOW @dnd-kit WORKS:
// ─────────────────────────────────
// DndContext is the "arena". Everything inside it can participate in DnD.
//
// When a drag starts → onDragStart: record what's being dragged
// While hovering over targets → onDragOver: speculatively update local state
// When the user drops → onDragEnd: persist the final order to the server
//
// WHY DragOverlay?
// Without it, the dragged item just becomes transparent. DragOverlay renders a
// floating COPY of the item that follows the cursor — the "pick up" effect.
// createPortal() renders it into document.body so it's never clipped by overflow:hidden.

interface KanbanBoardProps {
  boardId: string;
  userRole: "OWNER" | "ADMIN" | "MEMBER";
  currentUserId: string;
}

export function KanbanBoard({ boardId, userRole, currentUserId }: KanbanBoardProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const isOwnerOrAdmin = userRole === "OWNER" || userRole === "ADMIN";

  // ─── Real-time Socket.io connection (Phase 6) ───
  // Connects to the server, joins this board's room, and listens for
  // change events. When another user modifies the board, the socket
  // receives an event and TanStack Query automatically refetches.
  const { status: connectionStatus, presenceUsers } = useSocket({ boardId });

  // ─── Fetch columns (with cards) ───
  const columnListQueryOptions = trpc.column.list.queryOptions({ boardId });
  const { data: serverColumns, isLoading } = useQuery(columnListQueryOptions);
  // Derive the exact query key so all invalidations use the same reference.
  // tRPC structures keys as [["column", "list"], { input, type }], so we must
  // get it from queryOptions — hardcoding ["column", "list"] won't match.
  const columnListKey = columnListQueryOptions.queryKey;

  // ─── Zustand store ───
  const { columns: localColumns, setColumns, moveCard, reorderColumns } = useBoardStore();

  // Sync server data into local store whenever the query resolves/updates
  useEffect(() => {
    if (serverColumns) {
      setColumns(serverColumns as ColumnData[]);
    }
  }, [serverColumns, setColumns]);

  // ─── Filters (Phase 8E) ───
  const { filters, hasActiveFilters, clearAll: clearFilters } = useBoardFilters();

  // Unique assignees derived from cards currently on the board.
  // We build this from localColumns so it stays fresh as cards are added/edited
  // without needing an extra tRPC call.
  const uniqueMembers = useMemo(() => {
    const seen = new Set<string>();
    const members: Array<{ id: string; name: string | null; image: string | null }> = [];
    for (const col of localColumns) {
      for (const card of col.cards) {
        for (const { user } of card.assignees) {
          if (!seen.has(user.id)) {
            seen.add(user.id);
            members.push(user);
          }
        }
      }
    }
    return members;
  }, [localColumns]);

  // visibleColumns = localColumns with cards filtered by the active filters.
  // DnD logic still operates on localColumns (full data) — only rendering
  // uses visibleColumns, so drag-and-drop remains stable while filtering.
  const visibleColumns = useMemo(() => {
    if (!hasActiveFilters) return localColumns;

    const now = new Date();
    const in7days = addDays(now, 7);

    return localColumns.map((col) => ({
      ...col,
      cards: col.cards.filter((card) => {
        if (filters.q) {
          const q = filters.q.toLowerCase();
          const matches =
            card.title.toLowerCase().includes(q) ||
            (card.description?.toLowerCase().includes(q) ?? false);
          if (!matches) return false;
        }
        if (filters.labelIds.length > 0) {
          const cardLabelIds = card.labels.map((l) => l.labelId);
          if (!filters.labelIds.some((id) => cardLabelIds.includes(id))) return false;
        }
        if (filters.assigneeIds.length > 0) {
          const cardAssigneeIds = card.assignees.map((a) => a.userId);
          if (!filters.assigneeIds.some((id) => cardAssigneeIds.includes(id))) return false;
        }
        if (filters.due !== "all") {
          if (filters.due === "none") {
            if (card.dueDate) return false;
          } else if (filters.due === "overdue") {
            if (!card.dueDate) return false;
            const d = new Date(card.dueDate);
            if (!isPast(d) || isToday(d)) return false;
          } else if (filters.due === "soon") {
            if (!card.dueDate) return false;
            const d = new Date(card.dueDate);
            if (d < now || d > in7days) return false;
          }
        }
        return true;
      }),
    }));
  }, [localColumns, filters, hasActiveFilters]);

  // ─── Card detail modal state ───
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  // ─── Activity panel state (Phase 5) ───
  const [showActivity, setShowActivity] = useState(false);

  // ─── Drag state ───
  const [activeCard, setActiveCard] = useState<CardData | null>(null);
  const [activeColumn, setActiveColumn] = useState<ColumnData | null>(null);
  // Remember where the dragged card started (for the server call)
  const dragSourceColumnId = useRef<string | null>(null);

  // ─── Sensors ───
  // PointerSensor: mouse/touch with a small distance threshold so that
  //   clicking buttons inside a card doesn't accidentally start a drag.
  // KeyboardSensor: arrow-key dragging for accessibility.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // ─── Mutations ───
  const moveCardMutation = useMutation(
    trpc.card.move.mutationOptions({
      onError: (err) => {
        toast.error(err.message ?? "Failed to move card");
        // Rollback: re-fetch from server
        queryClient.invalidateQueries({ queryKey: columnListKey });
      },
    })
  );

  const reorderColumnsMutation = useMutation(
    trpc.column.reorder.mutationOptions({
      onError: (err) => {
        toast.error(err.message ?? "Failed to reorder columns");
        queryClient.invalidateQueries({ queryKey: columnListKey });
      },
    })
  );

  const deleteCardMutation = useMutation(
    trpc.card.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: columnListKey });
      },
      onError: (err) => {
        toast.error(err.message ?? "Failed to delete card");
      },
    })
  );

  // ─── Helpers ───
  function findColumnOfCard(cardId: string): ColumnData | undefined {
    return localColumns.find((col) => col.cards.some((c) => c.id === cardId));
  }

  function isColumn(id: string): boolean {
    return localColumns.some((col) => col.id === id);
  }

  // ─── onDragStart ───
  function handleDragStart(event: DragStartEvent) {
    const id = String(event.active.id);
    if (isColumn(id)) {
      setActiveColumn(localColumns.find((c) => c.id === id) ?? null);
    } else {
      const col = findColumnOfCard(id);
      const card = col?.cards.find((c) => c.id === id) ?? null;
      setActiveCard(card);
      dragSourceColumnId.current = col?.id ?? null;
    }
  }

  // ─── onDragOver ───
  // Fires while hovering. We speculatively move the card in Zustand so
  // the UI reflects the new position before the server knows anything.
  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over || !activeCard) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;

    // The "over" target is either a card or a column (empty column drop zone)
    const overColumn = isColumn(overId)
      ? localColumns.find((c) => c.id === overId)
      : findColumnOfCard(overId);
    const sourceColumn = findColumnOfCard(activeId);
    if (!overColumn || !sourceColumn) return;

    if (sourceColumn.id === overColumn.id) {
      // Same-column reorder
      const oldIndex = sourceColumn.cards.findIndex((c) => c.id === activeId);
      const newIndex = overColumn.cards.findIndex((c) => c.id === overId);
      if (oldIndex === -1 || newIndex === -1) return;
      const reordered = arrayMove(sourceColumn.cards, oldIndex, newIndex);
      moveCard(activeId, sourceColumn.id, overColumn.id, reordered.map((c) => c.id));
    } else {
      // Cross-column move
      const overIndex = overColumn.cards.findIndex((c) => c.id === overId);
      const insertAt = overIndex >= 0 ? overIndex : overColumn.cards.length;
      const newTargetCards = [...overColumn.cards];
      newTargetCards.splice(insertAt, 0, activeCard);
      const newSourceCards = sourceColumn.cards.filter((c) => c.id !== activeId);
      moveCard(
        activeId,
        sourceColumn.id,
        overColumn.id,
        newTargetCards.map((c) => c.id),
        newSourceCards.map((c) => c.id)
      );
    }
  }

  // ─── onDragEnd ───
  // User dropped. Local store is already up-to-date from onDragOver.
  // Just persist to the server.
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    const activeId = String(active.id);

    setActiveCard(null);
    setActiveColumn(null);

    if (!over || activeId === String(over.id)) {
      dragSourceColumnId.current = null;
      return;
    }

    if (activeColumn) {
      // Column reorder
      const overId = String(over.id);
      const oldIndex = localColumns.findIndex((c) => c.id === activeId);
      const newIndex = localColumns.findIndex((c) => c.id === overId);
      if (oldIndex !== -1 && newIndex !== -1) {
        const reordered = arrayMove(localColumns, oldIndex, newIndex);
        reorderColumns(reordered);
        reorderColumnsMutation.mutate({ boardId, columnIds: reordered.map((c) => c.id) });
      }
    } else if (activeCard) {
      // Card move — local state is already correct, just persist
      const targetCol = findColumnOfCard(activeId);
      if (!targetCol) {
        dragSourceColumnId.current = null;
        return;
      }

      const sourceColId = dragSourceColumnId.current;
      const isCrossColumn = sourceColId && sourceColId !== targetCol.id;

      moveCardMutation.mutate({
        cardId: activeId,
        targetColumnId: targetCol.id,
        cardIds: targetCol.cards.map((c) => c.id),
        ...(isCrossColumn && {
          sourceColumnId: sourceColId,
          sourceCardIds: localColumns
            .find((c) => c.id === sourceColId)
            ?.cards.map((c) => c.id) ?? [],
        }),
      });
    }

    dragSourceColumnId.current = null;
  }

  // ─── Add column ───
  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [newColumnTitle, setNewColumnTitle] = useState("");

  const createColumnMutation = useMutation(
    trpc.column.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: columnListKey });
        setNewColumnTitle("");
        setIsAddingColumn(false);
      },
      onError: (err) => {
        toast.error(err.message ?? "Failed to create column");
      },
    })
  );

  function handleAddColumn() {
    const title = newColumnTitle.trim();
    if (!title) return;
    createColumnMutation.mutate({ boardId, title });
  }

  // ─── Render ───
  if (isLoading) {
    return (
      <div className="flex gap-4 overflow-x-auto pb-4">
        {[3, 2, 1].map((cardCount, colIndex) => (
          <div
            key={colIndex}
            className="w-[85vw] sm:w-72 flex-shrink-0 rounded-lg border bg-muted/30 p-3"
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="h-5 w-24 animate-pulse rounded bg-muted" />
              <div className="h-5 w-5 animate-pulse rounded bg-muted" />
            </div>
            <div className="space-y-2">
              {Array.from({ length: cardCount }).map((_, i) => (
                <div key={i} className="rounded-md border bg-card p-3 space-y-2">
                  <div className="h-4 w-full animate-pulse rounded bg-muted" />
                  {i === 0 && <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* ─── Board toolbar: presence + connection status + activity toggle ─── */}
      <div className="flex items-center justify-between">
        {/* Left side: connection status + who's viewing */}
        <div className="flex items-center gap-4">
          <ConnectionStatusIndicator status={connectionStatus} />
          <BoardPresence users={presenceUsers} currentUserId={currentUserId} />
        </div>

        {/* Right side: activity toggle */}
        <Button
          variant={showActivity ? "secondary" : "ghost"}
          size="sm"
          className="gap-1.5 text-xs"
          onClick={() => setShowActivity((v) => !v)}
        >
          <Activity className="h-3.5 w-3.5" />
          Activity
        </Button>
      </div>

      {/* ─── Filter bar ─── */}
      <FilterBar boardId={boardId} members={uniqueMembers} />

      {/* ─── Board area: columns + optional activity panel ─── */}
      <div className="flex gap-4 items-start">
        {/* Main kanban scroll area */}
        <div className="flex-1 min-w-0">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <div className="flex items-start gap-4 overflow-x-auto pb-4">
              {/*
                Outer SortableContext tracks columns (horizontal reorder).
                items must be the column IDs in their current order.
              */}
              <SortableContext
                items={localColumns.map((c) => c.id)}
                strategy={horizontalListSortingStrategy}
              >
                {visibleColumns.map((column) => (
                  <KanbanColumn
                    key={column.id}
                    column={column}
                    boardId={boardId}
                    isOwnerOrAdmin={isOwnerOrAdmin}
                    onCardDelete={(cardId) => deleteCardMutation.mutate({ id: cardId })}
                    isDeletingCard={
                      deleteCardMutation.isPending
                        ? (deleteCardMutation.variables as { id: string } | undefined)?.id ?? null
                        : null
                    }
                    onCardClick={(cardId) => setSelectedCardId(cardId)}
                  />
                ))}
              </SortableContext>

              {/* ─── Filter empty state ─── */}
              {hasActiveFilters &&
                visibleColumns.every((c) => c.cards.length === 0) && (
                  <div className="flex w-64 shrink-0 flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-8 text-center text-muted-foreground">
                    <Search className="h-7 w-7 opacity-40" />
                    <p className="text-sm font-medium">No cards match</p>
                    <button
                      className="text-xs underline-offset-2 hover:underline"
                      onClick={clearFilters}
                    >
                      Clear filters
                    </button>
                  </div>
                )}

              {/* Add column button/form */}
              {isOwnerOrAdmin && (
                <div className="w-[85vw] sm:w-72 shrink-0">
                  {isAddingColumn ? (
                    <div className="flex flex-col gap-2 rounded-lg border bg-muted/40 p-3">
                      <Input
                        autoFocus
                        placeholder="Column title..."
                        value={newColumnTitle}
                        onChange={(e) => setNewColumnTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleAddColumn();
                          if (e.key === "Escape") { setIsAddingColumn(false); setNewColumnTitle(""); }
                        }}
                        className="h-8 text-sm"
                      />
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          className="h-7 flex-1 text-xs"
                          onClick={handleAddColumn}
                          disabled={!newColumnTitle.trim() || createColumnMutation.isPending}
                        >
                          <Check className="mr-1 h-3 w-3" />
                          Add column
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => { setIsAddingColumn(false); setNewColumnTitle(""); }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <button
                      className="flex w-full items-center gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground transition-colors hover:border-solid hover:text-foreground"
                      onClick={() => setIsAddingColumn(true)}
                    >
                      <Plus className="h-4 w-4" />
                      Add column
                    </button>
                  )}
                </div>
              )}
            </div>

            {/*
              DragOverlay — floating copy of the dragged item.
              Rendered into document.body via createPortal so it's never
              clipped by overflow:hidden on parent elements.
            */}
            {typeof document !== "undefined" &&
              createPortal(
                <DragOverlay>
                  {activeCard && (
                    <div className="rotate-2 opacity-95 shadow-xl">
                      <KanbanCard card={activeCard} onDelete={() => {}} />
                    </div>
                  )}
                  {activeColumn && (
                    <div className="rotate-1 opacity-95 shadow-xl">
                      <KanbanColumn
                        column={activeColumn}
                        boardId={boardId}
                        isOwnerOrAdmin={false}
                        onCardDelete={() => {}}
                      />
                    </div>
                  )}
                </DragOverlay>,
                document.body
              )}

            {/* ─── Card Detail Modal ───
              Renders when the user clicks a card.
              onUpdated re-fetches the column list so label/assignee changes
              are reflected in the card previews immediately.
            */}
            {selectedCardId && (
              <CardDetailModal
                cardId={selectedCardId}
                boardId={boardId}
                currentUserId={currentUserId}
                onClose={() => setSelectedCardId(null)}
                onUpdated={() => queryClient.invalidateQueries({ queryKey: columnListKey })}
              />
            )}
          </DndContext>
        </div>

        {/* ─── Activity Panel (Phase 5) ─── */}
        {showActivity && (
          <>
            {/* Backdrop — mobile only. Tap outside the panel to dismiss. */}
            <div
              className="fixed inset-0 z-30 bg-black/40 sm:hidden"
              onClick={() => setShowActivity(false)}
            />
            <ActivityPanel boardId={boardId} onClose={() => setShowActivity(false)} />
          </>
        )}
      </div>
    </div>
  );
}
