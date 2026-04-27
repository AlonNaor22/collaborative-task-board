"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useCallback, useMemo } from "react";

// ──────────────────────────────────────────────
// useBoardFilters — URL-backed filter state
// ──────────────────────────────────────────────
// This hook is the single source of truth for "what is the user filtering by?".
//
// WHY THE URL (not useState, not Zustand)?
// A filtered view is part of *what's on screen*, not transient UI state.
// Putting it in the URL gives us three things for free:
//   1. Refresh-safe: reload the page → filters survive.
//   2. Shareable: copy the URL → someone else sees the same filtered view.
//   3. Back-button-aware: the browser's history works the way users expect.
//
// CS analogy: think of the URL as the program counter for the rendered view.
// Given the URL alone, the page is deterministic — no hidden state.
//
// HOW NEXT.JS EXPOSES THE URL:
//   useSearchParams() → read-only snapshot of the query string
//   useRouter()       → write side: router.push / router.replace
//   usePathname()     → the current path *without* the query string
//
// We use router.replace (not push) so typing into a search box doesn't
// flood the browser history with one entry per keystroke.

// ─── Filter shape ──────────────────────────────

export type DueFilter = "all" | "overdue" | "soon" | "none";

export type BoardFilters = {
  q: string;                // free-text search across title + description
  labelIds: string[];       // OR within labels: card matches if it has any of these
  assigneeIds: string[];    // OR within assignees: same idea
  due: DueFilter;           // due-date bucket (single choice)
};

const DEFAULT_FILTERS: BoardFilters = {
  q: "",
  labelIds: [],
  assigneeIds: [],
  due: "all",
};

// Whitelist of valid `due` values. Anything else in the URL is treated as "all"
// (so a user typing ?due=garbage doesn't crash the parser).
const VALID_DUE: readonly DueFilter[] = ["all", "overdue", "soon", "none"] as const;

// ─── Parsing ───────────────────────────────────
// Parse URLSearchParams → typed BoardFilters.
// We accept anything that looks like URLSearchParams so this is easy to test
// in isolation later (no React needed).
function parseFilters(params: URLSearchParams | ReadonlyURLSearchParams): BoardFilters {
  const q = params.get("q") ?? "";
  const labelIds = params.getAll("label");        // ?label=A&label=B → ["A","B"]
  const assigneeIds = params.getAll("assignee");
  const dueRaw = params.get("due");
  const due = (VALID_DUE as readonly string[]).includes(dueRaw ?? "")
    ? (dueRaw as DueFilter)
    : "all";
  return { q, labelIds, assigneeIds, due };
}

// Type alias for the readonly variant Next.js returns from useSearchParams.
// We declare it locally to avoid importing the implementation type.
type ReadonlyURLSearchParams = ReturnType<typeof useSearchParams>;

// ─── The hook ──────────────────────────────────

export function useBoardFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Re-parse only when the searchParams reference changes (Next gives a stable
  // reference per snapshot), so unrelated re-renders don't recompute this.
  const filters = useMemo(() => parseFilters(searchParams), [searchParams]);

  const hasActiveFilters =
    filters.q.length > 0 ||
    filters.labelIds.length > 0 ||
    filters.assigneeIds.length > 0 ||
    filters.due !== "all";

  // Serialise BoardFilters → URLSearchParams and navigate.
  // We omit defaults from the URL so a "clean" view has a clean URL
  // (e.g. ?due=all is redundant; we just leave it off).
  const writeFilters = useCallback(
    (next: BoardFilters) => {
      const params = new URLSearchParams();
      if (next.q) params.set("q", next.q);
      for (const id of next.labelIds) params.append("label", id);
      for (const id of next.assigneeIds) params.append("assignee", id);
      if (next.due !== "all") params.set("due", next.due);

      const qs = params.toString();
      const url = qs ? `${pathname}?${qs}` : pathname;

      // scroll: false → don't jump to the top when the URL changes.
      // This matters because typing into search would otherwise yank the page.
      router.replace(url, { scroll: false });
    },
    [pathname, router]
  );

  // Update a single key while keeping the rest. The generic constraint means
  // TypeScript will only let you pass a value that matches the key's type:
  //   setFilter("q", "hello")             ✓
  //   setFilter("labelIds", ["id1","id2"]) ✓
  //   setFilter("due", "wat")             ✗ (compile error)
  const setFilter = useCallback(
    <K extends keyof BoardFilters>(key: K, value: BoardFilters[K]) => {
      writeFilters({ ...filters, [key]: value });
    },
    [filters, writeFilters]
  );

  const clearAll = useCallback(() => {
    writeFilters(DEFAULT_FILTERS);
  }, [writeFilters]);

  return { filters, setFilter, clearAll, hasActiveFilters };
}
