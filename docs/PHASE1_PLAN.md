# Phase 1: Scaffolding + Auth — Implementation Plan

## Overview
Set up the entire project foundation: Next.js app, database, API layer, authentication, and basic page structure. Every future phase builds on top of this.

---

## Step 1: Initialize Next.js Project + Install Dependencies

**What we do:** Run `create-next-app` and install all Phase 1 packages.

**Core dependencies and WHY each one exists:**

| Package | Why |
|---------|-----|
| `next`, `react`, `react-dom` | Next.js is our framework — it gives us file-based routing, server-side rendering, and API routes all in one. React is the UI library underneath. |
| `typescript`, `@types/react`, `@types/node` | TypeScript adds static types to JavaScript. You wrote Java in uni — think of it like that but for JS. Catches bugs at compile time instead of runtime. |
| `tailwindcss`, `@tailwindcss/postcss`, `postcss` | TailwindCSS lets you style directly in your JSX with utility classes like `className="bg-blue-500 p-4"` instead of writing separate CSS files. PostCSS is the build tool that processes Tailwind into real CSS. |
| `prisma`, `@prisma/client` | Prisma is our ORM (Object-Relational Mapper). Instead of writing raw SQL like `SELECT * FROM users WHERE id = 5`, you write `prisma.user.findUnique({ where: { id: 5 } })`. It also generates TypeScript types from your database schema automatically. |
| `next-auth@beta` | Auth.js v5 (formerly NextAuth) handles login/register/session management. It gives you session cookies, CSRF protection, and secure password flows out of the box. The "beta" is v5 which is the version designed for Next.js App Router. |
| `@trpc/server`, `@trpc/client`, `@trpc/tanstack-react-query`, `@tanstack/react-query` | tRPC lets your frontend call backend functions with full type safety — no REST endpoints, no `fetch("/api/users")`. You just call `trpc.user.getProfile.useQuery()` and TypeScript knows the exact return type. TanStack Query handles caching, loading states, and refetching automatically. |
| `zod` | Schema validation library. When a user submits a login form, Zod validates the data shape on the server: "is email a string? is password at least 6 chars?" Works hand-in-hand with tRPC. |
| `superjson` | JSON can't serialize Dates, Maps, BigInts etc. SuperJSON can. We use it as tRPC's serializer so when Prisma returns a `createdAt: Date`, it arrives as a real Date object on the frontend, not a string. |
| `bcryptjs` | Password hashing. NEVER store plain passwords. bcrypt turns "mypassword" into "$2a$10$xJ..." — a one-way hash that can't be reversed. |
| `@types/bcryptjs` | TypeScript type definitions for bcryptjs (it's written in plain JS so types are separate). |

**shadcn/ui** — NOT installed via npm. It's a CLI that copies component source code directly into your project. You own the code and can customize it. We'll init it and add components like Button, Input, Card, Dialog as needed.

---

## Step 2: Configure Prisma + Database Schema (User model)

**What we do:**
- Create `prisma/schema.prisma` with the User model
- Set up the database connection
- Run migration to create the table

**Why Prisma over raw SQL:**
You know SQL from uni. Prisma doesn't replace that knowledge — it wraps it. Benefits:
1. Auto-generated TypeScript types (your `User` model becomes a TS type)
2. Migrations track schema changes in version control (like git for your DB)
3. Prisma Client gives you autocomplete for every query

**The User model will have:** id mod, name, email (unique), hashedPassword, image, createdAt, updatedAt

**Database singleton pattern:** We create `src/server/db.ts` that exports ONE Prisma client instance. In development, Next.js hot-reloads your code which would create a new DB connection every time. The singleton prevents connection exhaustion.

---

## Step 3: Set Up tRPC (API Layer)

**What we do:** Create the tRPC server configuration with two procedure types.

**Why tRPC instead of REST API routes:**
In a traditional app, you'd create `/api/users/me` endpoint, write a fetch call, and manually type the response. If you change the API shape, the frontend breaks silently at runtime.

With tRPC:
- Backend defines a function: `getProfile` returns `{ name, email }`
- Frontend calls it: `trpc.user.getProfile.useQuery()`
- TypeScript **guarantees** the types match. Change the backend → frontend shows compile errors instantly.

**The setup involves:**
1. `src/server/trpc/init.ts` — Creates the tRPC instance, defines `publicProcedure` (anyone can call) and `protectedProcedure` (must be logged in — checks session)
2. `src/server/trpc/routers/_app.ts` — The root router that merges all sub-routers (auth, board, etc.)
3. `src/app/api/trpc/[trpc]/route.ts` — Next.js API route that handles all tRPC requests (the `[trpc]` is a dynamic catch-all route)
4. `src/trpc/client.tsx` — React provider that wraps the app, giving all components access to `trpc.*` hooks
5. `src/trpc/server.ts` — For calling tRPC from Server Components (Next.js specific)

---

## Step 4: Set Up Auth.js v5 (Authentication)

**What we do:** Configure login, register, logout with email/password.

**How auth works conceptually:**
1. User submits email + password
2. Server hashes the password with bcrypt and compares to stored hash
3. If match → server creates an encrypted session cookie (JWT stored in cookie)
4. Every subsequent request sends this cookie automatically
5. Server decrypts cookie → knows who the user is

**Files we create:**
1. `src/server/auth.ts` — Auth.js configuration: Credentials provider, session callbacks, JWT strategy
2. `src/server/auth.config.ts` — Separated config for Edge compatibility (middleware runs on Edge runtime which can't use Prisma directly)
3. `src/middleware.ts` — Next.js middleware that runs BEFORE every page load. Checks: "is user logged in? if not, redirect to /login"

**Why Credentials provider:**
Auth.js supports Google, GitHub, etc. login. We use Credentials (email/password) because:
- No external OAuth setup needed
- Portfolio project — you control everything
- Can always add OAuth providers later

**Auth tRPC router:** We'll create a `register` mutation in tRPC that creates the user with a hashed password.

---

## Step 5: Build Auth Pages (Login + Register)

**What we do:** Create the UI pages under `src/app/(auth)/`

**The `(auth)` folder pattern:**
The parentheses in `(auth)` make it a "route group" in Next.js. It lets you share a layout (centered card design) without adding `/auth/` to the URL. So the routes are just `/login` and `/register`, not `/auth/login`.

**Pages:**
1. `src/app/(auth)/layout.tsx` — Centered layout wrapper (the card-in-the-middle design you see on every login page)
2. `src/app/(auth)/login/page.tsx` — Email + password form, calls Auth.js `signIn()`
3. `src/app/(auth)/register/page.tsx` — Name + email + password form, calls tRPC `auth.register` then auto-logs in

**Form handling:** We'll use React `useState` + form submission. Server Actions (Next.js feature) could work too, but explicit client-side calls are clearer to understand.

---

## Step 6: Dashboard Layout + Navbar

**What we do:** Create the authenticated app shell — navbar with user menu, and a placeholder dashboard page.

**Files:**
1. `src/app/(dashboard)/layout.tsx` — The main app layout with navbar on top
2. `src/app/(dashboard)/boards/page.tsx` — Placeholder "Your Boards" page (built out in Phase 2)
3. `src/components/navbar.tsx` — Top navigation bar with: app logo/title, user avatar/name dropdown, sign out button

**Why separate layouts:**
- `(auth)/layout.tsx` → centered, minimal (login/register pages)
- `(dashboard)/layout.tsx` → full app layout with navbar (authenticated pages)

This way login pages look clean, and app pages have consistent navigation.

---

## Step 7: Seed Script

**What we do:** Create `prisma/seed.ts` — a script that populates the database with test users.

**Why:** So you don't have to manually register every time you reset the DB during development. Run `npx prisma db seed` and you have test accounts ready to go.

---

## File Creation Order

```
1.  Initialize Next.js project + install deps
2.  tailwind.config.ts, postcss.config.mjs — Tailwind setup
3.  prisma/schema.prisma — User model
4.  src/server/db.ts — Prisma client singleton
5.  src/server/auth.config.ts — Auth edge config
6.  src/server/auth.ts — Auth.js full config
7.  src/server/trpc/init.ts — tRPC base setup
8.  src/server/trpc/routers/auth.ts — Auth router (register)
9.  src/server/trpc/routers/_app.ts — Root router
10. src/app/api/trpc/[trpc]/route.ts — tRPC API handler
11. src/trpc/client.tsx — React tRPC provider
12. src/trpc/server.ts — Server-side tRPC caller
13. src/middleware.ts — Route protection
14. src/app/layout.tsx — Root layout with providers
15. src/app/(auth)/layout.tsx — Auth layout
16. src/app/(auth)/login/page.tsx — Login page
17. src/app/(auth)/register/page.tsx — Register page
18. src/app/(dashboard)/layout.tsx — Dashboard layout
19. src/app/(dashboard)/boards/page.tsx — Boards placeholder
20. src/components/navbar.tsx — Navigation bar
21. prisma/seed.ts — Test data seeder
22. .env — Environment variables (gitignored)
23. Run: prisma migrate, prisma generate, shadcn init
```

---

## What You'll Have After Phase 1

- A running Next.js app at `localhost:3000`
- PostgreSQL database with a `User` table
- Working register → login → dashboard flow
- Protected routes (can't access dashboard without logging in)
- Type-safe API calls (tRPC)
- A navbar with sign-out functionality
- Seed script for quick dev setup
