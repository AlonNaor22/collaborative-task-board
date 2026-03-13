import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { auth } from "@/server/auth";

// ──────────────────────────────────────────────
// tRPC Initialization
// ──────────────────────────────────────────────
// Think of tRPC like defining a Java interface that BOTH your
// frontend and backend share. The compiler enforces that they
// match — so if the backend returns { name: string }, the
// frontend KNOWS it's a string. No manual typing, no runtime
// surprises.
//
// This file does 3 things:
// 1. Creates the tRPC instance (the "factory")
// 2. Defines a "context" (data available to every request)
// 3. Exports two procedure builders (public + protected)

// ─── Step 1: Create Context ───
// "Context" is data that every tRPC procedure receives automatically.
// It's like dependency injection in Spring — instead of each endpoint
// manually fetching the session, we compute it once here and pass it in.
//
// createTRPCContext runs on EVERY request. It checks: "who is this user?"
// by reading their session cookie via Auth.js.
export const createTRPCContext = async () => {
  const session = await auth();

  return {
    // session is null if not logged in, or { user: { id, name, email } } if logged in
    session,
  };
};

// ─── Step 2: Initialize tRPC ───
// initTRPC creates the tRPC "factory". We configure it with:
// - Our context type (so procedures know what `ctx` contains)
// - superjson transformer (so Dates, Maps etc. survive serialization)
const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
});

// ─── Step 3: Export Procedure Builders ───
// These are like "decorators" in Python or "annotations" in Java.
// They define what checks happen BEFORE your endpoint logic runs.

// createTRPCRouter: groups related procedures together (like a Controller class)
export const createTRPCRouter = t.router;

// createCallerFactory: used by server-side code to call tRPC procedures
// directly (without HTTP). See src/trpc/server.ts for usage.
export const createCallerFactory = t.createCallerFactory;

// publicProcedure: anyone can call this, no login required.
// Used for: login, register, health checks
export const publicProcedure = t.procedure;

// protectedProcedure: ONLY logged-in users can call this.
// The `.use()` adds "middleware" — code that runs before the procedure.
// If there's no session, we throw UNAUTHORIZED (HTTP 401 equivalent).
// If there IS a session, we add the user to the context so procedures
// can do `ctx.user.id` without null-checking every time.
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  // `next()` continues to the actual procedure.
  // We pass an enriched context with `user` guaranteed to be non-null.
  return next({
    ctx: {
      session: ctx.session,
      user: ctx.session.user,
    },
  });
});
