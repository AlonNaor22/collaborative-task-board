"use client";

import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ActivityIcon } from "./activity-icon";

// ──────────────────────────────────────────────
// ActivityPanel — Board-wide activity sidebar
// ──────────────────────────────────────────────
// Shows the 30 most recent activity entries for the board.
// Renders as a fixed-width panel to the right of the kanban columns.
//
// Each entry follows the pattern:
//   [Avatar] Alice added label 'Urgent' to 'Fix bug'   2 min ago
//
// The readable sentence is produced by formatActivitySentence(), which
// switches on the `action` string and reads from the JSON `details` blob.

interface ActivityPanelProps {
  boardId: string;
  onClose: () => void;
}

export function ActivityPanel({ boardId, onClose }: ActivityPanelProps) {
  const trpc = useTRPC();

  const { data, isLoading } = useQuery(
    trpc.activity.listByBoard.queryOptions({ boardId, limit: 30 })
  );

  const activities = data?.items ?? [];

  return (
    <div className="fixed inset-x-0 bottom-0 top-14 z-40 w-full sm:static sm:inset-auto sm:z-auto sm:w-72 shrink-0 rounded-t-lg sm:rounded-lg border bg-card flex flex-col sm:max-h-[calc(100dvh-12rem)]">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-3 py-2">
        <h3 className="text-sm font-semibold">Board Activity</h3>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Feed */}
      <div className="flex-1 overflow-y-auto p-3">
        {isLoading ? (
          <p className="text-xs text-muted-foreground">Loading activity...</p>
        ) : activities.length === 0 ? (
          <p className="text-xs text-muted-foreground">No activity yet. Start making changes!</p>
        ) : (
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
                      {formatActivitySentence(entry.action, entry.details as Record<string, unknown>)}
                    </p>
                  </div>
                  <p className="mt-0.5 text-[10px] text-muted-foreground pl-5">
                    {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// formatActivitySentence
// ──────────────────────────────────────────────
// Converts (action, details) → a readable sentence fragment.
// The user's name is prepended by the caller:
//   "Alice" + formatActivitySentence("moved_card", {...})
//   → "Alice moved 'Fix bug' to 'In Progress'"
export function formatActivitySentence(
  action: string,
  details: Record<string, unknown>
): string {
  const d = details ?? {};
  const card = (d.cardTitle as string | undefined) ?? "a card";

  switch (action) {
    case "created_card":
      return `created '${card}' in ${(d.columnTitle as string | undefined) ?? "a column"}`;
    case "moved_card":
      return `moved '${card}' to '${(d.toColumnTitle as string | undefined) ?? "a column"}'`;
    case "added_label":
      return `added label '${(d.labelName as string | undefined) ?? ""}' to '${card}'`;
    case "removed_label":
      return `removed label '${(d.labelName as string | undefined) ?? ""}' from '${card}'`;
    case "added_assignee":
      return `assigned ${(d.assigneeName as string | undefined) ?? "someone"} to '${card}'`;
    case "removed_assignee":
      return `unassigned ${(d.assigneeName as string | undefined) ?? "someone"} from '${card}'`;
    case "set_due_date":
      return (d.dueDate as string | undefined)
        ? `set due date on '${card}'`
        : `cleared due date on '${card}'`;
    case "created_comment":
      return `commented on '${card}'`;
    case "deleted_comment":
      return `deleted a comment on '${card}'`;
    case "created_column":
      return `created column '${(d.columnTitle as string | undefined) ?? ""}'`;
    case "deleted_column":
      return `deleted column '${(d.columnTitle as string | undefined) ?? ""}'`;
    case "created_board":
      return `created this board`;
    default:
      return action.replace(/_/g, " ");
  }
}
