"use client";

// ──────────────────────────────────────────────
// Global Error Boundary
// ──────────────────────────────────────────────
// Next.js catches runtime errors in any page or layout and shows
// this component instead of a blank page or ugly stack trace.
//
// WHY "use client"?
// Error boundaries in React MUST be Client Components — they use
// React's error boundary mechanism (componentDidCatch), which only
// works on the client side. This is a Next.js requirement, not a choice.
//
// HOW IT WORKS:
// Next.js passes two props:
//   - `error`: the Error object (with message, stack, etc.)
//   - `reset`: a function that re-renders the page, giving it another
//     chance to succeed. Useful for transient errors (DB timeout, etc.)
//
// Think of it like a Java try/catch around your entire page tree:
//   try { renderPage() }
//   catch (error) { renderErrorBoundary(error, reset) }

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Log the error for debugging. In production, you'd send this
  // to an error tracking service (Sentry, LogRocket, etc.).
  useEffect(() => {
    console.error("[Error Boundary]", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="h-8 w-8 text-destructive" />
      </div>

      <div className="space-y-2">
        <h2 className="text-xl font-semibold">Something went wrong</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          An unexpected error occurred. This might be a temporary issue —
          try again, and if it persists, refresh the page.
        </p>
      </div>

      <button
        onClick={reset}
        className="mt-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Try again
      </button>
    </div>
  );
}
