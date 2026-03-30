"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CardData } from "@/hooks/use-board-store";

// ──────────────────────────────────────────────
// KanbanCard — A single draggable task card
// ──────────────────────────────────────────────
// Each card on the board is rendered by this component.
//
// HOW DRAG-AND-DROP WORKS (@dnd-kit):
// @dnd-kit is a modular DnD library. The key hook here is `useSortable`,
// which does three things for us:
//   1. Registers this element as a draggable item
//   2. Registers it as a drop target (so other cards can be dropped relative to it)
//   3. Gives us CSS transform values to animate the card while dragging
//
// The "id" we pass to useSortable must be unique across the entire board
// (not just within the column), because @dnd-kit tracks all sortable items
// in a flat registry.
//
// WHY CSS.Transform.toString(transform)?
// During a drag, @dnd-kit calculates how far the item has moved (in px)
// and gives us a `transform` object. We convert it to a CSS string
// (e.g., "translate3d(0px, 120px, 0)") and apply it inline. This is
// a GPU-accelerated transform — it moves the element without reflow,
// which is why dragging feels smooth.

interface KanbanCardProps {
  card: CardData;
  onDelete: (cardId: string) => void;
  isDeleting?: boolean;
}

export function KanbanCard({ card, onDelete, isDeleting }: KanbanCardProps) {
  const {
    attributes,   // Accessibility attributes (aria-*, role, tabIndex)
    listeners,    // Mouse/touch/keyboard event handlers for initiating drag
    setNodeRef,   // Ref to attach to the DOM element being dragged
    transform,    // Current x/y offset while dragging (null when not dragging)
    transition,   // CSS transition string (for smooth drop animation)
    isDragging,   // True while THIS card is being actively dragged
  } = useSortable({ id: card.id });

  // Convert the transform object to a CSS string.
  // When not dragging, transform is null → style gets no transform.
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    // While dragging, reduce opacity so the user sees both the original
    // position (the "ghost") and the DragOverlay (the floating copy).
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group flex items-start gap-2 rounded-md border bg-card p-3 shadow-sm"
    >
      {/* ─── Drag Handle ───
        The grip icon is the only part with `listeners` attached.
        This means you ONLY start a drag by clicking the grip icon,
        not the whole card — so users can click links/buttons inside
        the card without accidentally dragging it.
      */}
      <button
        className="mt-0.5 cursor-grab touch-none text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {/* ─── Card Content ─── */}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-snug break-words">
          {card.title}
        </p>
        {card.description && (
          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
            {card.description}
          </p>
        )}
      </div>

      {/* ─── Delete Button ─── */}
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
        onClick={() => onDelete(card.id)}
        disabled={isDeleting}
        aria-label="Delete card"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
