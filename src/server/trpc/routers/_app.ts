import { createTRPCRouter } from "../init";
import { authRouter } from "./auth";
import { boardRouter } from "./board";
import { columnRouter } from "./column";
import { cardRouter } from "./card";
import { labelRouter } from "./label";

// ──────────────────────────────────────────────
// Root App Router
// ──────────────────────────────────────────────
// This is the "master router" that combines all sub-routers.
// Think of it like a package-level module — it's the single
// entry point for ALL your tRPC procedures.
//
// When the frontend calls `trpc.auth.register.mutate(...)`,
// tRPC routes it: appRouter → authRouter → register
//
// With the board router, the frontend can now call:
//   trpc.board.list.useQuery()
//   trpc.board.create.useMutation()
//   etc.
//
// The column router handles Kanban columns:
//   trpc.column.list.useQuery({ boardId })
//   trpc.column.create.useMutation()
//   trpc.column.reorder.useMutation()
//
// The card router handles task cards:
//   trpc.card.create.useMutation()
//   trpc.card.move.useMutation()
export const appRouter = createTRPCRouter({
  auth: authRouter,
  board: boardRouter,
  column: columnRouter,
  card: cardRouter,
  label: labelRouter,
});

// Export the router's TYPE (not the router itself).
// This type is used by the frontend tRPC client to know
// what procedures exist and their input/output types.
// It's the "contract" between frontend and backend.
export type AppRouter = typeof appRouter;
