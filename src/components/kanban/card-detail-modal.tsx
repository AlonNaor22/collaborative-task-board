"use client";

import { useState, useRef, useEffect } from "react";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format, isPast, isToday, formatDistanceToNow } from "date-fns";
import {
  CalendarIcon,
  TagIcon,
  UserIcon,
  Trash2,
  Plus,
  Check,
  X,
  Pencil,
  MessageSquare,
  Activity,
  Send,
} from "lucide-react";
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
import { ActivityIcon } from "./activity-icon";
import { formatActivitySentence } from "./activity-panel";

// ──────────────────────────────────────────────
// CardDetailModal
// ──────────────────────────────────────────────
// Opens when a user clicks a card on the Kanban board.
// Phase 5 adds two new sections below the existing content:
//   - Comments: list of threaded comments + text box to post new ones
//   - Activity: timeline of all actions taken on this card
//
// DATA FLOW (Phase 5 additions):
//   - comment.list: all comments on this card
//   - comment.create / update / delete: manage comments
//   - activity.listByCard: all activity entries for this card

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
  currentUserId: string;
  onClose: () => void;
  // Called after mutations so KanbanBoard can refresh the column list
  onUpdated: () => void;
}

export function CardDetailModal({
  cardId,
  boardId,
  currentUserId,
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

  // ─── Fetch board members (for assignee picker + @mention) ───
  const boardQuery = useQuery(trpc.board.getById.queryOptions({ id: boardId }));
  const boardMembers = boardQuery.data?.members ?? [];

  // ─── Fetch comments ───
  const commentsQuery = useQuery(trpc.comment.list.queryOptions({ cardId }));
  const comments = commentsQuery.data ?? [];

  // ─── Fetch card activity ───
  const activityQuery = useQuery(trpc.activity.listByCard.queryOptions({ cardId }));
  const activities = activityQuery.data ?? [];

  // ─── Active tab: "comments" | "activity" ───
  const [activeTab, setActiveTab] = useState<"comments" | "activity">("comments");

  // ─── Helper: invalidate card detail + column list ───
  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: trpc.card.getById.queryOptions({ id: cardId }).queryKey });
    queryClient.invalidateQueries({ queryKey: trpc.label.list.queryOptions({ boardId }).queryKey });
    queryClient.invalidateQueries({ queryKey: trpc.comment.list.queryOptions({ cardId }).queryKey });
    queryClient.invalidateQueries({ queryKey: trpc.activity.listByCard.queryOptions({ cardId }).queryKey });
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

            {/* ─── Comments + Activity tabs ─── */}
            <section>
              {/* Tab row */}
              <div className="mb-3 flex gap-1 border-b">
                <button
                  onClick={() => setActiveTab("comments")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                    activeTab === "comments"
                      ? "border-b-2 border-primary text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  Comments ({comments.length})
                </button>
                <button
                  onClick={() => setActiveTab("activity")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                    activeTab === "activity"
                      ? "border-b-2 border-primary text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Activity className="h-3.5 w-3.5" />
                  Activity
                </button>
              </div>

              {activeTab === "comments" && (
                <CommentsSection
                  cardId={cardId}
                  comments={comments}
                  boardMembers={boardMembers}
                  currentUserId={currentUserId}
                  onUpdated={() => {
                    queryClient.invalidateQueries({
                      queryKey: trpc.comment.list.queryOptions({ cardId }).queryKey,
                    });
                    queryClient.invalidateQueries({
                      queryKey: trpc.activity.listByCard.queryOptions({ cardId }).queryKey,
                    });
                  }}
                />
              )}

              {activeTab === "activity" && (
                <ActivityTimeline activities={activities} isLoading={activityQuery.isLoading} />
              )}
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ──────────────────────────────────────────────
// CommentsSection
// ──────────────────────────────────────────────
// Renders the list of existing comments (newest first) and
// the "new comment" text box at the bottom.
//
// @MENTION FEATURE:
// When the user types @ anywhere in the comment box, a small dropdown
// appears listing board members. Selecting one inserts "@Name " at the
// cursor position. This is implemented by tracking the cursor position
// with a ref and detecting the @ trigger character.

interface Comment {
  id: string;
  content: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  user: { id: string; name: string | null; image: string | null };
}

interface CommentsSectionProps {
  cardId: string;
  comments: Comment[];
  boardMembers: { userId: string; user: { id: string; name: string | null; image: string | null } }[];
  currentUserId: string;
  onUpdated: () => void;
}

function CommentsSection({
  cardId,
  comments,
  boardMembers,
  currentUserId,
  onUpdated,
}: CommentsSectionProps) {
  const trpc = useTRPC();
  const [newComment, setNewComment] = useState("");
  const [mentionQuery, setMentionQuery] = useState<string | null>(null); // null = no dropdown
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const createCommentMutation = useMutation(
    trpc.comment.create.mutationOptions({
      onSuccess: () => {
        setNewComment("");
        onUpdated();
      },
      onError: (err) => toast.error(err.message ?? "Failed to post comment"),
    })
  );

  const deleteCommentMutation = useMutation(
    trpc.comment.delete.mutationOptions({
      onSuccess: onUpdated,
      onError: (err) => toast.error(err.message ?? "Failed to delete comment"),
    })
  );

  function handleSubmit() {
    const text = newComment.trim();
    if (!text) return;
    createCommentMutation.mutate({ cardId, content: text });
  }

  // ─── @mention detection ───
  // On each keystroke, look backwards from the cursor for an @ that hasn't
  // been followed by a space yet. If found, extract the partial name after @
  // and use it to filter board members.
  function handleCommentChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const value = e.target.value;
    setNewComment(value);

    const cursor = e.target.selectionStart ?? value.length;
    const textBefore = value.slice(0, cursor);
    const atIndex = textBefore.lastIndexOf("@");

    if (atIndex !== -1 && !textBefore.slice(atIndex).includes(" ")) {
      setMentionQuery(textBefore.slice(atIndex + 1).toLowerCase());
    } else {
      setMentionQuery(null);
    }
  }

  // Insert "@Name " at the position of the @ trigger
  function insertMention(name: string) {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const cursor = textarea.selectionStart ?? newComment.length;
    const textBefore = newComment.slice(0, cursor);
    const atIndex = textBefore.lastIndexOf("@");
    const textAfter = newComment.slice(cursor);

    const inserted = `@${name} `;
    const newValue = newComment.slice(0, atIndex) + inserted + textAfter;
    setNewComment(newValue);
    setMentionQuery(null);

    // Move cursor after the inserted mention
    setTimeout(() => {
      const newPos = atIndex + inserted.length;
      textarea.setSelectionRange(newPos, newPos);
      textarea.focus();
    }, 0);
  }

  const filteredMembers =
    mentionQuery !== null
      ? boardMembers.filter((m) =>
          m.user.name?.toLowerCase().includes(mentionQuery)
        )
      : [];

  return (
    <div className="flex flex-col gap-4">
      {/* Existing comments — newest first */}
      {comments.length > 0 ? (
        <div className="flex flex-col gap-3">
          {comments.map((comment) => (
            <CommentRow
              key={comment.id}
              comment={comment}
              isOwn={comment.userId === currentUserId}
              onDelete={() => deleteCommentMutation.mutate({ id: comment.id })}
              onUpdated={onUpdated}
              cardId={cardId}
            />
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          No comments yet. Be the first to leave one!
        </p>
      )}

      {/* New comment box */}
      <div className="relative flex flex-col gap-2">
        <Textarea
          ref={textareaRef}
          placeholder="Write a comment... (type @ to mention someone)"
          className="min-h-[72px] resize-none text-sm"
          value={newComment}
          onChange={handleCommentChange}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              handleSubmit();
            }
            if (e.key === "Escape") setMentionQuery(null);
          }}
        />

        {/* @mention dropdown */}
        {mentionQuery !== null && filteredMembers.length > 0 && (
          <div className="absolute top-full left-0 z-50 mt-1 w-48 rounded-md border bg-popover shadow-md">
            {filteredMembers.map((m) => (
              <button
                key={m.userId}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-xs hover:bg-accent"
                onMouseDown={(e) => {
                  e.preventDefault(); // prevent textarea blur
                  insertMention(m.user.name ?? m.userId);
                }}
              >
                <Avatar className="h-4 w-4">
                  <AvatarImage src={m.user.image ?? undefined} />
                  <AvatarFallback className="text-[8px]">
                    {m.user.name?.charAt(0).toUpperCase() ?? "?"}
                  </AvatarFallback>
                </Avatar>
                {m.user.name}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between">
          <p className="text-[10px] text-muted-foreground">Ctrl+Enter to submit</p>
          <Button
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={handleSubmit}
            disabled={!newComment.trim() || createCommentMutation.isPending}
          >
            <Send className="h-3 w-3" />
            Comment
          </Button>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// CommentRow — single comment with edit/delete
// ──────────────────────────────────────────────

interface CommentRowProps {
  comment: Comment;
  isOwn: boolean;
  onDelete: () => void;
  onUpdated: () => void;
  cardId: string;
}

function CommentRow({ comment, isOwn, onDelete, onUpdated, cardId }: CommentRowProps) {
  const trpc = useTRPC();
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(comment.content);

  const updateMutation = useMutation(
    trpc.comment.update.mutationOptions({
      onSuccess: () => {
        setIsEditing(false);
        onUpdated();
      },
      onError: (err) => toast.error(err.message ?? "Failed to update comment"),
    })
  );

  // Detect if the comment was edited (updatedAt ≠ createdAt within ~1 second)
  const wasEdited =
    Math.abs(new Date(comment.updatedAt).getTime() - new Date(comment.createdAt).getTime()) > 1000;

  return (
    <div className="flex gap-2.5">
      <Avatar className="h-6 w-6 shrink-0 mt-0.5">
        <AvatarImage src={comment.user.image ?? undefined} />
        <AvatarFallback className="text-[10px]">
          {comment.user.name?.charAt(0).toUpperCase() ?? "?"}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-medium">{comment.user.name ?? "Unknown"}</span>
          <span className="text-[10px] text-muted-foreground">
            {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
            {wasEdited && " (edited)"}
          </span>
        </div>

        {isEditing ? (
          <div className="mt-1 flex flex-col gap-1.5">
            <Textarea
              autoFocus
              className="min-h-[56px] resize-none text-xs"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") { setIsEditing(false); setEditValue(comment.content); }
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  if (editValue.trim()) {
                    updateMutation.mutate({ id: comment.id, content: editValue.trim() });
                  }
                }
              }}
            />
            <div className="flex gap-1">
              <Button
                size="sm"
                className="h-6 text-xs"
                disabled={!editValue.trim() || updateMutation.isPending}
                onClick={() => {
                  if (editValue.trim()) {
                    updateMutation.mutate({ id: comment.id, content: editValue.trim() });
                  }
                }}
              >
                Save
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs"
                onClick={() => { setIsEditing(false); setEditValue(comment.content); }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <p className="mt-0.5 text-xs leading-relaxed whitespace-pre-wrap break-words">
            {comment.content}
          </p>
        )}

        {/* Edit / Delete (only own comments) */}
        {isOwn && !isEditing && (
          <div className="mt-1 flex gap-2">
            <button
              className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setIsEditing(true)}
            >
              Edit
            </button>
            <button
              className="text-[10px] text-muted-foreground hover:text-destructive transition-colors"
              onClick={onDelete}
            >
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// ActivityTimeline — card-specific activity tab
// ──────────────────────────────────────────────

interface ActivityEntry {
  id: string;
  action: string;
  details: unknown;
  createdAt: Date;
  user: { id: string; name: string | null; image: string | null };
}

interface ActivityTimelineProps {
  activities: ActivityEntry[];
  isLoading: boolean;
}

function ActivityTimeline({ activities, isLoading }: ActivityTimelineProps) {
  if (isLoading) {
    return <p className="text-xs text-muted-foreground">Loading activity...</p>;
  }

  if (activities.length === 0) {
    return <p className="text-xs text-muted-foreground">No activity recorded yet.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {activities.map((entry) => (
        <div key={entry.id} className="flex gap-2.5 text-xs">
          <Avatar className="h-6 w-6 shrink-0 mt-0.5">
            <AvatarImage src={entry.user.image ?? undefined} />
            <AvatarFallback className="text-[10px]">
              {entry.user.name?.charAt(0).toUpperCase() ?? "?"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-1.5">
              <ActivityIcon action={entry.action} className="h-3.5 w-3.5 shrink-0 mt-0.5 text-muted-foreground" />
              <p className="text-xs leading-snug">
                <span className="font-medium">{entry.user.name ?? "Someone"}</span>{" "}
                {formatActivitySentence(
                  entry.action,
                  (entry.details as Record<string, unknown>) ?? {}
                )}
              </p>
            </div>
            <p className="mt-0.5 text-[10px] text-muted-foreground pl-5">
              {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}
            </p>
          </div>
        </div>
      ))}
    </div>
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
