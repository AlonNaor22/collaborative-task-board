import { PrismaClient } from "@/generated/prisma";

// ──────────────────────────────────────────────
// Prisma Client Singleton
// ──────────────────────────────────────────────
// WHY a singleton? In development, Next.js uses "hot reload" —
// every time you save a file, it re-runs your code. If we wrote
// `const db = new PrismaClient()` at the top level, each hot reload
// would create a NEW database connection. After a few saves, you'd
// have dozens of connections and PostgreSQL would refuse new ones.
//
// This pattern is like the Singleton design pattern from your OOP
// courses: we store ONE instance on `globalThis` (a global object
// that survives hot reloads) and reuse it.
//
// In production, this isn't needed (no hot reload), but the pattern
// works correctly in both environments.
// ──────────────────────────────────────────────

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db = globalForPrisma.prisma ?? new PrismaClient();

// Only cache on globalThis in development
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
