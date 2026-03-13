import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

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
//
// Prisma v7 change: instead of connecting directly, Prisma now uses
// a "driver adapter" — a wrapper around the actual database driver
// (node-postgres in our case). This gives you more control over
// connection pooling and SSL settings.
// ──────────────────────────────────────────────

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  // PrismaPg is the adapter that bridges Prisma to PostgreSQL.
  // It uses node-postgres (pg) under the hood — the most popular
  // PostgreSQL driver for Node.js.
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
  });

  return new PrismaClient({ adapter });
}

export const db = globalForPrisma.prisma ?? createPrismaClient();

// Only cache on globalThis in development
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
