"use client";

// ──────────────────────────────────────────────
// tRPC React Client + Provider
// ──────────────────────────────────────────────
// "use client" at the top tells Next.js this runs in the BROWSER,
// not on the server. We need this because React hooks (useState,
// useQuery, etc.) only work in the browser.
//
// This file does two things:
// 1. Creates the `trpc` object that components use to call the API
// 2. Creates a Provider component that wraps the app (like React Context)
//
// The Provider is like Spring's ApplicationContext — it sets up
// the "plumbing" so that any component anywhere in the tree can
// call `trpc.auth.register.useMutation()` without any manual setup.

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createTRPCClient,
  httpBatchLink,
} from "@trpc/client";
import { createTRPCContext } from "@trpc/tanstack-react-query";
import superjson from "superjson";
import type { AppRouter } from "@/server/trpc/routers/_app";

// createTRPCContext gives us two things:
// - `trpc`: the object components use (trpc.auth.register.useMutation())
// - `TRPCProvider`: the wrapper component that makes `trpc` available
const { TRPCProvider, useTRPC } = createTRPCContext<AppRouter>();

// Export `trpc` so components can import and use it:
//   import { useTRPC } from "@/trpc/client";
//   const trpc = useTRPC();
//   const mutation = trpc.auth.register.useMutation();
export { useTRPC };

// ─── Helper: get the base URL for API calls ───
function getBaseUrl() {
  // In the browser, use relative URL (same origin)
  if (typeof window !== "undefined") return "";
  // On the server during SSR, use the full URL
  return `http://localhost:${process.env.PORT ?? 3000}`;
}

// ─── The Provider Component ───
// This wraps your entire app. It sets up:
// 1. A TanStack QueryClient (manages caching, refetching, loading states)
// 2. A tRPC client (knows how to talk to /api/trpc/*)
//
// We use useState so each browser tab gets its own client instance
// (prevents shared state between tabs).
export function TRPCReactProvider({ children }: { children: React.ReactNode }) {
  // QueryClient manages all the caching magic.
  // When you call useQuery(), it: fetches data, caches it, shows loading
  // state, auto-refetches when you revisit the page, etc.
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        // Don't refetch when the browser tab regains focus
        // (can be annoying during development)
        refetchOnWindowFocus: false,
      },
    },
  }));

  // The tRPC client — this is what actually sends HTTP requests.
  // httpBatchLink batches multiple tRPC calls into a single HTTP request
  // for better performance (e.g., if a page makes 3 queries, they go
  // as one network request instead of 3).
  const [trpcClient] = useState(() =>
    createTRPCClient<AppRouter>({
      links: [
        httpBatchLink({
          url: `${getBaseUrl()}/api/trpc`,
          // superjson handles serialization (Dates become real Dates, etc.)
          transformer: superjson,
        }),
      ],
    })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        {children}
      </TRPCProvider>
    </QueryClientProvider>
  );
}
