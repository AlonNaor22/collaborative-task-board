import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "bcryptjs";

// ──────────────────────────────────────────────
// Database Seed Script
// ──────────────────────────────────────────────
// This script populates the database with test data so you
// don't have to manually register accounts every time you
// reset the database during development.
//
// HOW TO RUN:
//   npx prisma db seed
//
// WHEN TO RUN:
// - After `npx prisma migrate reset` (which wipes the DB)
// - After cloning the project on a new machine
// - Whenever you want fresh test data
//
// HOW IT WORKS:
// 1. Prisma reads the `prisma.seed` field in package.json
// 2. That tells it to run: `tsx prisma/seed.ts`
// 3. tsx is like node but can run TypeScript files directly
//
// WHY WE DON'T IMPORT FROM `@/server/db`:
// The seed script runs OUTSIDE of Next.js (it's a standalone
// script). The `@/` path alias only works inside Next.js's
// bundler. So we create our own Prisma client here with the
// same adapter pattern, using a relative import.

// ─── Create Prisma Client ───
// Same setup as src/server/db.ts but with relative imports
// since we're outside the Next.js bundler.
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

// ─── Test Users ───
// Each user has a simple password for easy testing.
// In a real app, you'd NEVER commit real passwords — but these
// are fake accounts for local development only.
//
// bcrypt hash rounds = 10 (same as in our auth.ts).
// More rounds = slower but more secure. 10 is the standard
// for development; production apps sometimes use 12.
const testUsers = [
  {
    name: "Alice Johnson",
    email: "alice@example.com",
    password: "password123",
  },
  {
    name: "Bob Smith",
    email: "bob@example.com",
    password: "password123",
  },
  {
    name: "Charlie Brown",
    email: "charlie@example.com",
    password: "password123",
  },
];

// ─── Main Seed Function ───
async function main() {
  console.log("🌱 Seeding database...\n");

  for (const user of testUsers) {
    // `upsert` = "update OR insert"
    // - If a user with this email already exists → update their data
    // - If no user with this email → create a new one
    //
    // This makes the seed script idempotent — you can run it
    // multiple times without getting "duplicate email" errors.
    // (Idempotent = running it once or 10 times gives the same result.)
    const hashedPassword = await hash(user.password, 10);

    const created = await prisma.user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        hashedPassword,
      },
      create: {
        name: user.name,
        email: user.email,
        hashedPassword,
      },
    });

    console.log(`  ✅ ${created.name} (${created.email})`);
  }

  console.log("\n🌱 Seeding complete!");
  console.log("   You can log in with any of the above emails");
  console.log('   and password: "password123"');
}

// ─── Run & Cleanup ───
// .finally() ensures the database connection is closed even if
// something crashes. Without this, the script might hang because
// the connection stays open (Node.js won't exit with open handles).
main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
