"use client";

import { useState, useRef, useEffect } from "react";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format, isPast, isToday } from "date-fns";
import { CalendarIcon, TagIcon, UserIcon, Trash2, Plus, Check, X, Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

// ──────────────────────────────────────────────
// CardDetailModal
// ──────────────────────────────────────────────
// Opens when a user clicks a card on the Kanban board.
// Shows and allows editing of:
//   - Title (editable inline, saves on blur)
//   - Description (editable textarea, saves on blur)
//   - Labels (toggle on/off, create/delete via LabelManager)
//   - Assignees (toggle board members on/off)
//   - Due date (native date input, overdue shown in red)
//   - Attachments (placeholder section for Phase 5)
//
// DATA FLOW:
//   - card.getById: full card data (labels, assignees, due date)
//   - label.list: all labels on this board (for the label picker)
//   - board.getById: board members (for the assignee picker)
//   - card.update: save title/description
//   - card.setDueDate: save due date
//   - card.addLabel / card.removeLabel: toggle labels
//   - card.addAssignee / card.removeAssignee: toggle assignees
//   - label.create / label.delete: manage the label catalog

// ─── 8 predefined label colors ───
const LABEL_COLORS = [
  "#EF4444", // red
  "#F97316", // orange
  "#EAB308", // yellow
  "#22C55E", // green
  "#3B82F6", // blue
  "#8B5CF6", // purple
  "#EC4899", // pink
  "#14B8A6", // teal
];

interface CardDetailModalProps {
  cardId: string;
  boardId: string;
  onClose: () => void;
  // Called after mutations so KanbanBoard can refresh the column list
  onUpdated: () => void;
}

export function CardDetailModal({
  cardId,
  boardId,
  onClose,
  onUpdated,
}: CardDetailModalProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // ─── Fetch card detail ───
  const cardQuery = useQuery(trpc.card.getById.queryOptions({ id: cardId }));
  const card = cardQuery.data;

  // ─── Fetch all board labels ───
  const labelsQuery = useQuery(trpc.label.list.queryOptions({ boardId }));
  const boardLabels = labelsQuery.data ?? [];

  // ─── Fetch board members (for assignee picker) ───
  // We use board.getById to get members list
  const boardQuery = useQuery(trpc.board.getById.queryOptions({ id: boardId }));
  const boardMembers = boardQuery.data?.members ?? [];

  // ─── Helper: invalidate card detail + column list ───
  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: trpc.card.getById.queryOptions({ id: cardId }).queryKey });
    queryClient.invalidateQueries({ queryKey: trpc.label.list.queryOptions({ boardId }).queryKey });
    onUpdated(); // tells KanbanBoard to re-fetch column list
  };

  // ─── Title editing ───
  const [titleValue, setTitleValue] = useState("");
  // Sync title from server data when it first loads
  useEffect(() => {
    if (card && titleValue === "") setTitleValue(card.title);
  }, [card]);

  const updateCardMutation = useMutation(
    trpc.card.update.mutationOptions({
      onSuccess: invalidateAll,
      onError: (err) => toast.error(err.message ?? "Failed to update card"),
    })
  );

  function handleTitleBlur() {
    const trimmed = titleValue.trim();
    if (!trimmed || trimmed === card?.title) return;
    updateCardMutation.mutate({ id: cardId, title: trimmed });
  }

  // ─── Description editing ───
  const [descValue, setDescValue] = useState<string>("");
  const [descDirty, setDescDirty] = useState(false);

  useEffect(() => {
    if (card && !descDirty) setDescValue(card.description ?? "");
  }, [card, descDirty]);

  function handleDescBlur() {
    if (!descDirty) return;
    updateCardMutation.mutate({
      id: cardId,
      description: descValue.trim() || null,
    });
    setDescDirty(false);
  }

  // ─── Due date ───
  const setDueDateMutation = useMutation(
    trpc.card.setDueDate.mutationOptions({
      onSuccess: invalidateAll,
      onError: (err) => toast.error(err.message ?? "Failed to set due date"),
    })
  );

  function handleDueDateChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setDueDateMutation.mutate({
      id: cardId,
      dueDate: value ? new Date(value) : null,
    });
  }

  // Format date as YYYY-MM-DD for the <input type="date"> value
  const dueDateInputValue = card?.dueDate
    ? format(new Date(card.dueDate), "yyyy-MM-dd")
    : "";

  // Is the due date overdue? (past and not today)
  const isOverdue =
    card?.dueDate && isPast(new Date(card.dueDate)) && !isToday(new Date(card.dueDate));

  // ─── Label toggle ───
  const addLabelMutation = useMutation(
    trpc.card.addLabel.mutationOptions({
      onSuccess: invalidateAll,
      onError: (err) => toast.error(err.message ?? "Failed to add label"),
    })
  );
  const removeLabelMutation = useMutation(
    trpc.card.removeLabel.mutationOptions({
      onSuccess: invalidateAll,
      onError: (err) => toast.error(err.message ?? "Failed to remove label"),
    })
  );

  const appliedLabelIds = new Set(card?.labels.map((l) => l.labelId) ?? []);

  function toggleLabel(labelId: string) {
    if (appliedLabelIds.has(labelId)) {
      removeLabelMutation.mutate({ cardId, labelId });
    } else {
      addLabelMutation.mutate({ cardId, labelId });
    }
  }

  // ─── Assignee toggle ───
  const addAssigneeMutation = useMutation(
    trpc.card.addAssignee.mutationOptions({
      onSuccess: invalidateAll,
      onError: (err) => toast.error(err.message ?? "Failed to add assignee"),
    })
  );
  const removeAssigneeMutation = useMutation(
    trpc.card.removeAssignee.mutationOptions({
      onSuccess: invalidateAll,
      onError: (err) => toast.error(err.message ?? "Failed to remove assignee"),
    })
  );

  const assignedUserIds = new Set(card?.assignees.map((a) => a.userId) ?? []);

  function toggleAssignee(userId: string) {
    if (assignedUserIds.has(userId)) {
      removeAssigneeMutation.mutate({ cardId, userId });
    } else {
      addAssigneeMutation.mutate({ cardId, userId });
    }
  }

  // ─── Label manager state ───
  const [showLabelManager, setShowLabelManager] = useState(false);

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg overflow-y-auto max-h-[90vh]" showCloseButton>
        {cardQuery.isLoading ? (
          <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
            Loading...
          </div>
        ) : !card ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Card not found</div>
        ) : (
          <div className="flex flex-col gap-5">
            <DialogHeader>
              {/* ─── Editable title ─── */}
              <input
                className="w-full bg-transparent text-lg font-semibold outline-none placeholder:text-muted-foreground focus:ring-0"
                value={titleValue}
                onChange={(e) => setTitleValue(e.target.value)}
                onBlur={handleTitleBlur}
                onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                placeholder="Card title"
              />
            </DialogHeader>

            {/* ─── Description ─── */}
            <section>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Description
              </label>
              <Textarea
                placeholder="Add a description..."
                className="min-h-[80px] resize-none text-sm"
                value={descValue}
                onChange={(e) => { setDescValue(e.target.value); setDescDirty(true); }}
                onBlur={handleDescBlur}
              />
            </section>

            {/* ─── Due Date ─── */}
            <section>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                <CalendarIcon className="h-3.5 w-3.5" />
                Due date
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={dueDateInputValue}
                  onChange={handleDueDateChange}
                  className="rounded-md border bg-transparent px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
                {card.dueDate && (
                  <span className={`text-xs ${isOverdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                    {isOverdue
                      ? `Overdue (${format(new Date(card.dueDate), "MMM d")})`
                      : format(new Date(card.dueDate), "MMM d, yyyy")}
                  </span>
                )}
                {card.dueDate && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground"
                    onClick={() => setDueDateMutation.mutate({ id: cardId, dueDate: null })}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </section>

            {/* ─── Labels ─── */}
            <section>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  <TagIcon className="h-3.5 w-3.5" />
                  Labels
                </label>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => setShowLabelManager(!showLabelManager)}
                >
                  <Pencil className="mr-1 h-3 w-3" />
                  Manage
                </Button>
              </div>

              {/* Label picker chips */}
              <div className="flex flex-wrap gap-1.5">
                {boardLabels.length === 0 && !showLabelManager && (
                  <p className="text-xs text-muted-foreground">No labels yet. Create one below.</p>
                )}
                {boardLabels.map((label) => {
                  const applied = appliedLabelIds.has(label.id);
                  return (
                    <button
                      key={label.id}
                      onClick={() => toggleLabel(label.id)}
                      className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-all"
                      style={{
                        backgroundColor: label.color + "33",
                        color: label.color,
                        opacity: applied ? 1 : 0.6,
                        outline: applied ? `2px solid ${label.color}` : "none",
                        outlineOffset: "2px",
                      }}
                    >
                      <span
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: label.color }}
                      />
                      {label.name}
                      {applied && <Check className="h-3 w-3" />}
                    </button>
                  );
                })}
              </div>

              {/* Inline label manager */}
              {showLabelManager && (
                <LabelManager
                  boardId={boardId}
                  boardLabels={boardLabels}
                  onUpdated={() => {
                    queryClient.invalidateQueries({
                      queryKey: trpc.label.list.queryOptions({ boardId }).queryKey,
                    });
                    invalidateAll();
                  }}
                />
              )}
            </section>

            {/* ─── Assignees ─── */}
            <section>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                <UserIcon className="h-3.5 w-3.5" />
                Assignees
              </label>
              <div className="flex flex-wrap gap-2">
                {boardMembers.map((member) => {
                  const assigned = assignedUserIds.has(member.userId);
                  const user = member.user;
                  return (
                    <button
                      key={member.userId}
                      onClick={() => toggleAssignee(member.userId)}
                      className={`flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs transition-all ${
                        assigned
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
                      }`}
                    >
                      <Avatar className="h-5 w-5">
                        <AvatarImage src={user.image ?? undefined} />
                        <AvatarFallback className="text-[10px]">
                          {user.name?.charAt(0).toUpperCase() ?? "?"}
                        </AvatarFallback>
                      </Avatar>
                      {user.name}
                      {assigned && <Check className="h-3 w-3" />}
                    </button>
                  );
                })}
                {boardMembers.length === 0 && (
                  <p className="text-xs text-muted-foreground">No board members found.</p>
                )}
              </div>
            </section>

            {/* ─── Attachments placeholder ─── */}
            <section>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Attachments
              </label>
              <div className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
                Attachment support coming in Phase 5
              </div>
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ──────────────────────────────────────────────
// LabelManager — embedded in CardDetailModal
// ──────────────────────────────────────────────
// Create and delete labels for the board.
// Shows 8 predefined colors to pick from.

interface LabelManagerProps {
  boardId: string;
  boardLabels: { id: string; name: string; color: string }[];
  onUpdated: () => void;
}

function LabelManager({ boardId, boardLabels, onUpdated }: LabelManagerProps) {
  const trpc = useTRPC();
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(LABEL_COLORS[0]);

  const createLabelMutation = useMutation(
    trpc.label.create.mutationOptions({
      onSuccess: () => {
        setNewName("");
        setNewColor(LABEL_COLORS[0]);
        onUpdated();
      },
      onError: (err) => toast.error(err.message ?? "Failed to create label"),
    })
  );

  const deleteLabelMutation = useMutation(
    trpc.label.delete.mutationOptions({
      onSuccess: onUpdated,
      onError: (err) => toast.error(err.message ?? "Failed to delete label"),
    })
  );

  function handleCreate() {
    const name = newName.trim();
    if (!name) return;
    createLabelMutation.mutate({ boardId, name, color: newColor });
  }

  return (
    <div className="mt-3 rounded-md border p-3 flex flex-col gap-3">
      <p className="text-xs font-semibold">Label Manager</p>

      {/* Existing labels with delete */}
      {boardLabels.length > 0 && (
        <div className="flex flex-col gap-1">
          {boardLabels.map((label) => (
            <div key={label.id} className="flex items-center gap-2">
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: label.color }}
              />
              <span className="flex-1 text-xs">{label.name}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-destructive"
                onClick={() => deleteLabelMutation.mutate({ id: label.id })}
                disabled={deleteLabelMutation.isPending}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Create new label */}
      <div className="flex flex-col gap-2">
        <Input
          placeholder="Label name..."
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
          className="h-7 text-xs"
        />
        {/* Color swatches */}
        <div className="flex gap-1.5 flex-wrap">
          {LABEL_COLORS.map((color) => (
            <button
              key={color}
              className={`h-5 w-5 rounded-full transition-transform hover:scale-110 ${
                newColor === color ? "ring-2 ring-offset-1 ring-foreground" : ""
              }`}
              style={{ backgroundColor: color }}
              onClick={() => setNewColor(color)}
              aria-label={`Select color ${color}`}
            />
          ))}
        </div>
        <Button
          size="sm"
          className="h-7 text-xs"
          onClick={handleCreate}
          disabled={!newName.trim() || createLabelMutation.isPending}
        >
          <Plus className="mr-1 h-3 w-3" />
          Add label
        </Button>
      </div>
    </div>
  );
}
