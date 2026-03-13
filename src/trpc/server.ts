import "server-only";
import { createTRPCContext, createCallerFactory } from "@/server/trpc/init";
import { appRouter } from "@/server/trpc/routers/_app";

// ──────────────────────────────────────────────
// Server-Side tRPC Caller
// ──────────────────────────────────────────────
// In Next.js, you have two ways to render a page:
//
// 1. Client Component (browser) → uses `trpc.*.useQuery()` hooks
//    which send HTTP requests to /api/trpc/*
//
// 2. Server Component (server) → renders on the server before
//    sending HTML to the browser. Can't use hooks.
//    Instead, calls tRPC procedures DIRECTLY (no HTTP needed,
//    since both the page and the API are on the same server).
//
// This file creates a "caller" for option 2.
//
// "server-only" import ensures this file can NEVER be imported
// by a Client Component — it would error at build time. This
// prevents accidentally shipping server-side code to the browser.

// createCallerFactory makes a function that, given a context,
// returns an object you can call like: caller.auth.register(...)
const createCaller = createCallerFactory(appRouter);

// serverTRPC() creates a fresh caller with the current user's session.
// Usage in a Server Component:
//   const trpc = await serverTRPC();
//   const boards = await trpc.board.list();
export async function serverTRPC() {
  const context = await createTRPCContext();
  return createCaller(context);
}
