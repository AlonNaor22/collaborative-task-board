"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2, CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { format, isPast, isToday } from "date-fns";
import type { CardData } from "@/hooks/use-board-store";

// ──────────────────────────────────────────────
// KanbanCard — A single draggable task card
// ──────────────────────────────────────────────
// Phase 4 additions:
//   - Label color dots in the card preview
//   - Assignee avatar stack
//   - Due date badge (red if overdue)
//   - onClick handler opens the CardDetailModal

interface KanbanCardProps {
  card: CardData;
  onDelete: (cardId: string) => void;
  isDeleting?: boolean;
  onClick?: (cardId: string) => void;
}

export function KanbanCard({ card, onDelete, isDeleting, onClick }: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const isOverdue =
    card.dueDate &&
    isPast(new Date(card.dueDate)) &&
    !isToday(new Date(card.dueDate));

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group flex flex-col gap-2 rounded-md border bg-card p-3 shadow-sm cursor-pointer hover:border-primary/50 transition-colors"
      onClick={() => onClick?.(card.id)}
    >
      {/* ─── Top row: drag handle + title + delete ─── */}
      <div className="flex items-start gap-2">
        {/* Drag handle — stopPropagation prevents card click from firing */}
        <button
          className="mt-0.5 cursor-grab touch-none text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing"
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-4 w-4" />
        </button>

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

        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
          onClick={(e) => { e.stopPropagation(); onDelete(card.id); }}
          disabled={isDeleting}
          aria-label="Delete card"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* ─── Label dots ─── */}
      {card.labels.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {card.labels.map(({ label }) => (
            <span
              key={label.id}
              className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
              style={{
                backgroundColor: label.color + "33",
                color: label.color,
              }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full shrink-0"
                style={{ backgroundColor: label.color }}
              />
              {label.name}
            </span>
          ))}
        </div>
      )}

      {/* ─── Bottom row: due date + assignee avatars ─── */}
      {(card.dueDate || card.assignees.length > 0) && (
        <div className="flex items-center justify-between">
          {/* Due date */}
          {card.dueDate ? (
            <span
              className={`flex items-center gap-1 text-[10px] font-medium ${
                isOverdue ? "text-destructive" : "text-muted-foreground"
              }`}
            >
              <CalendarIcon className="h-3 w-3" />
              {format(new Date(card.dueDate), "MMM d")}
            </span>
          ) : (
            <span />
          )}

          {/* Assignee avatar stack — max 3 shown */}
          {card.assignees.length > 0 && (
            <div className="flex -space-x-1.5">
              {card.assignees.slice(0, 3).map(({ user }) => (
                <Avatar key={user.id} className="h-5 w-5 ring-1 ring-background">
                  <AvatarImage src={user.image ?? undefined} />
                  <AvatarFallback className="text-[8px]">
                    {user.name?.charAt(0).toUpperCase() ?? "?"}
                  </AvatarFallback>
                </Avatar>
              ))}
              {card.assignees.length > 3 && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted ring-1 ring-background text-[8px] font-medium text-muted-foreground">
                  +{card.assignees.length - 3}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
