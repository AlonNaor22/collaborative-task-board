import { createTRPCRouter } from "../init";
import { authRouter } from "./auth";

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
// As we add more features, we'll add more routers here:
//   board: boardRouter,    (Phase 2)
//   column: columnRouter,  (Phase 3)
//   card: cardRouter,      (Phase 3)
//   etc.
export const appRouter = createTRPCRouter({
  auth: authRouter,
});

// Export the router's TYPE (not the router itself).
// This type is used by the frontend tRPC client to know
// what procedures exist and their input/output types.
// It's the "contract" between frontend and backend.
export type AppRouter = typeof appRouter;
