"use client";

import { useEffect, useState } from "react";
import { Search, X, ChevronDown, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBoardFilters, type DueFilter } from "@/hooks/use-board-filters";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";

// ──────────────────────────────────────────────
// FilterBar — Card search and filter controls
// ──────────────────────────────────────────────
// Sits between the board toolbar and the kanban columns.
// All state lives in the URL (via useBoardFilters), so filters
// survive a page refresh and can be shared via URL.
//
// DATA SOURCES:
//   - Labels: fetched via trpc.label.list (already fetched by CardDetailModal
//     too, so TanStack Query serves this from its cache at zero cost)
//   - Assignees: passed in as `members` from KanbanBoard, derived from the
//     cards that are currently on the board (no extra network call)
//
// SEARCH DEBOUNCE:
//   localQ is the live input value; filters.q is the committed URL value.
//   We write to the URL 250ms after typing stops to avoid flooding
//   browser history (even though we use router.replace, it's still
//   expensive to reparse the URL on every keystroke).

interface Member {
  id: string;
  name: string | null;
  image: string | null;
}

interface FilterBarProps {
  boardId: string;
  members: Member[];
}

export function FilterBar({ boardId, members }: FilterBarProps) {
  const { filters, setFilter, clearAll, hasActiveFilters } = useBoardFilters();
  const trpc = useTRPC();

  const { data: labels = [] } = useQuery(
    trpc.label.list.queryOptions({ boardId })
  );

  // localQ is the immediate input value; filters.q is the debounced URL value.
  const [localQ, setLocalQ] = useState(filters.q);

  // Sync inward: if clearAll() is called externally, reset the input.
  useEffect(() => {
    setLocalQ(filters.q);
  }, [filters.q]);

  // Sync outward: write to URL 250ms after typing stops.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localQ !== filters.q) setFilter("q", localQ);
    }, 250);
    return () => clearTimeout(timer);
    // Intentionally omit filters.q and setFilter — including them would
    // cause the effect to re-fire after every URL write, creating a loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localQ]);

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">

      {/* ─── Free-text search ─── */}
      <div className="relative flex-1 min-w-[160px]">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="h-8 pl-8 pr-7 text-sm"
          placeholder="Search cards..."
          value={localQ}
          onChange={(e) => setLocalQ(e.target.value)}
        />
        {localQ && (
          <button
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={() => setLocalQ("")}
            aria-label="Clear search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* ─── Label filter (multi-select) ─── */}
      {labels.length > 0 && (
        <Popover>
          <PopoverTrigger className="inline-flex h-8 items-center gap-1.5 rounded-md border border-input bg-background px-3 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground">
            Labels
            {filters.labelIds.length > 0 && (
              <Badge className="h-4 min-w-4 rounded-full px-1 text-[10px]">
                {filters.labelIds.length}
              </Badge>
            )}
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          </PopoverTrigger>
          <PopoverContent className="w-48 p-1" align="start">
            {labels.map((label) => {
              const checked = filters.labelIds.includes(label.id);
              return (
                <button
                  key={label.id}
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                  onClick={() =>
                    setFilter(
                      "labelIds",
                      checked
                        ? filters.labelIds.filter((id) => id !== label.id)
                        : [...filters.labelIds, label.id]
                    )
                  }
                >
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: label.color }}
                  />
                  <span className="flex-1 truncate text-left">{label.name}</span>
                  {checked && <Check className="h-3.5 w-3.5 shrink-0" />}
                </button>
              );
            })}
          </PopoverContent>
        </Popover>
      )}

      {/* ─── Assignee filter (multi-select) ─── */}
      {members.length > 0 && (
        <Popover>
          <PopoverTrigger className="inline-flex h-8 items-center gap-1.5 rounded-md border border-input bg-background px-3 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground">
            Assignee
            {filters.assigneeIds.length > 0 && (
              <Badge className="h-4 min-w-4 rounded-full px-1 text-[10px]">
                {filters.assigneeIds.length}
              </Badge>
            )}
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          </PopoverTrigger>
          <PopoverContent className="w-52 p-1" align="start">
            {members.map((member) => {
              const checked = filters.assigneeIds.includes(member.id);
              return (
                <button
                  key={member.id}
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                  onClick={() =>
                    setFilter(
                      "assigneeIds",
                      checked
                        ? filters.assigneeIds.filter((id) => id !== member.id)
                        : [...filters.assigneeIds, member.id]
                    )
                  }
                >
                  <Avatar className="h-5 w-5 shrink-0">
                    <AvatarImage src={member.image ?? undefined} />
                    <AvatarFallback className="text-[8px]">
                      {member.name?.charAt(0).toUpperCase() ?? "?"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="flex-1 truncate text-left">
                    {member.name ?? "Unknown"}
                  </span>
                  {checked && <Check className="h-3.5 w-3.5 shrink-0" />}
                </button>
              );
            })}
          </PopoverContent>
        </Popover>
      )}

      {/* ─── Due date filter (single-choice) ─── */}
      <Select
        value={filters.due}
        onValueChange={(v) => setFilter("due", v as DueFilter)}
      >
        <SelectTrigger className="h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="start">
          <SelectItem value="all">All dates</SelectItem>
          <SelectItem value="overdue">Overdue</SelectItem>
          <SelectItem value="soon">Due soon</SelectItem>
          <SelectItem value="none">No due date</SelectItem>
        </SelectContent>
      </Select>

      {/* ─── Clear all (visible only when any filter is active) ─── */}
      {hasActiveFilters && (
        <button
          className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          onClick={clearAll}
        >
          <X className="h-3 w-3" />
          Clear
        </button>
      )}
    </div>
  );
}
