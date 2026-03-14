import { handlers } from "@/server/auth";

// ──────────────────────────────────────────────
// Auth.js API Route Handler
// ──────────────────────────────────────────────
// This is a Next.js "catch-all" route. The [...nextauth] folder
// name means it matches ANY path under /api/auth/:
//   /api/auth/signin    → handles login form submission
//   /api/auth/signout   → handles logout
//   /api/auth/session   → returns current session (used by auth())
//   /api/auth/callback  → handles provider callbacks
//
// Auth.js gives us pre-built GET and POST handlers that do all
// the work. We just re-export them. Think of it like wiring up
// a Spring controller — but Auth.js already wrote the controller.
export const { GET, POST } = handlers;
