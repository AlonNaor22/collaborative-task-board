import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/server/trpc/routers/_app";
import { createTRPCContext } from "@/server/trpc/init";

// ──────────────────────────────────────────────
// tRPC API Route Handler
// ──────────────────────────────────────────────
// In Next.js App Router, files named `route.ts` inside `app/api/`
// become HTTP endpoints. The `[trpc]` folder name is a "dynamic
// segment" — it captures any URL path after `/api/trpc/`.
//
// So when the frontend calls `trpc.auth.register.mutate(...)`,
// it sends a POST request to `/api/trpc/auth.register`.
// This handler catches it, runs the tRPC router, and returns
// the response.
//
// Think of this as the Java equivalent of a DispatcherServlet —
// one entry point that routes ALL requests to the right handler.

const handler = (req: Request) =>
  fetchRequestHandler({
    // The URL path prefix — tRPC strips this to find the procedure name
    endpoint: "/api/trpc",
    req,
    // Our master router with all procedures
    router: appRouter,
    // Creates fresh context (session info) for each request
    createContext: createTRPCContext,
  });

// Next.js App Router exports named functions for each HTTP method.
// tRPC uses GET for queries and POST for mutations, so we export both.
export { handler as GET, handler as POST };
