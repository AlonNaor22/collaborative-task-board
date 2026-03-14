import NextAuth from "next-auth";
import { authConfig } from "@/server/auth.config";

// ──────────────────────────────────────────────
// Next.js Middleware — Route Protection
// ──────────────────────────────────────────────
// This file runs BEFORE every page request (on the Edge runtime).
// Think of it like a security guard at the entrance of a building:
// - Got a valid badge (session cookie)? → Come on in.
// - No badge + trying to enter the office (dashboard)? → Go to reception (login page).
// - Already have a badge + going to reception? → Go straight to the office (redirect to /boards).
//
// HOW IT WORKS:
// 1. NextAuth(authConfig) creates a lightweight auth checker
//    (using auth.config.ts — no Prisma, no bcrypt, Edge-safe)
// 2. It reads the encrypted JWT cookie from the request
// 3. Calls the `authorized` callback from auth.config.ts
// 4. That callback returns true (allow) or false (redirect to login)
//
// WHY we import from auth.config.ts (not auth.ts):
// Middleware runs on the Edge runtime — a stripped-down JS environment
// that's faster but can't use Node.js libraries like Prisma or bcrypt.
// auth.config.ts only has configuration rules, no heavy dependencies.

export default NextAuth(authConfig).auth;

// ─── Matcher ───
// Tells Next.js which routes this middleware should run on.
// Without this, middleware would run on EVERY request, including
// static files like images, CSS, and fonts — wasting resources.
//
// This regex means: "run on everything EXCEPT paths starting with
// api/auth, _next/static, _next/image, or favicon.ico"
//
// We exclude:
// - api/auth: Auth.js API routes handle their own auth
// - _next/static & _next/image: Static assets (JS bundles, images)
// - favicon.ico: Browser icon request
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
