// ──────────────────────────────────────────────
// Auth.js Configuration (placeholder)
// ──────────────────────────────────────────────
// This is a temporary stub so tRPC can compile.
// We'll build this out properly in Step 4.
//
// For now, `auth()` always returns null (no one is logged in).
// This means publicProcedure works, but protectedProcedure
// will always throw UNAUTHORIZED — which is correct until
// we set up real authentication.

// The Session type matches what Auth.js will return in Step 4.
export type Session = {
  user: {
    id: string;
    name: string;
    email: string;
  };
} | null;

export async function auth(): Promise<Session> {
  return null;
}
