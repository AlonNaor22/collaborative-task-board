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
// WHY WE DON'T IMPORT FROM `@/server/db`:
// The seed script runs OUTSIDE of Next.js (it's a standalone
// script). The `@/` path alias only works inside Next.js's
// bundler. So we create our own Prisma client here with the
// same adapter pattern, using a relative import.

// ─── Create Prisma Client ───
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

// ─── Test Users ───
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

// ─── Test Boards ───
// Each board has a title, description, color, and member list.
// Alice owns all boards. Bob and Charlie are members of some.
const testBoards = [
  {
    title: "Sprint 23",
    description: "Current sprint tasks for the team. Bug fixes and new features.",
    color: "#3B82F6", // Blue
    ownerEmail: "alice@example.com",
    memberEmails: ["bob@example.com", "charlie@example.com"],
  },
  {
    title: "Marketing Campaign",
    description: "Q2 marketing campaign planning and execution.",
    color: "#22C55E", // Green
    ownerEmail: "alice@example.com",
    memberEmails: ["bob@example.com"],
  },
  {
    title: "Personal Tasks",
    description: null,
    color: "#A855F7", // Purple
    ownerEmail: "alice@example.com",
    memberEmails: [], // Only Alice — a private board
  },
];

// ─── Main Seed Function ───
async function main() {
  console.log("🌱 Seeding database...\n");

  // ── Step 1: Create Users ──
  console.log("👤 Creating users...");
  const userMap = new Map<string, string>(); // email → userId

  for (const user of testUsers) {
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

    userMap.set(user.email, created.id);
    console.log(`  ✅ ${created.name} (${created.email})`);
  }

  // ── Step 2: Create Boards + Members ──
  console.log("\n📋 Creating boards...");

  for (const boardData of testBoards) {
    const ownerId = userMap.get(boardData.ownerEmail)!;

    // First, check if a board with this title already exists for this owner.
    // We use findFirst instead of upsert because boards don't have a
    // unique constraint on title (multiple users could have boards with
    // the same name).
    const existing = await prisma.board.findFirst({
      where: {
        title: boardData.title,
        ownerId,
      },
    });

    if (existing) {
      // Update existing board
      await prisma.board.update({
        where: { id: existing.id },
        data: {
          description: boardData.description,
          color: boardData.color,
        },
      });
      console.log(`  ✅ ${boardData.title} (updated)`);
      continue;
    }

    // Create board + owner membership in one transaction
    const board = await prisma.board.create({
      data: {
        title: boardData.title,
        description: boardData.description,
        color: boardData.color,
        ownerId,
        members: {
          create: [
            // Owner is always a member
            { userId: ownerId, role: "OWNER" },
            // Add additional members
            ...boardData.memberEmails.map((email) => ({
              userId: userMap.get(email)!,
              role: "MEMBER" as const,
            })),
          ],
        },
      },
    });

    console.log(
      `  ✅ ${board.title} (${boardData.memberEmails.length + 1} members)`
    );
  }

  console.log("\n🌱 Seeding complete!");
  console.log("   You can log in with any user email");
  console.log('   and password: "password123"');
  console.log("\n   Alice has 3 boards, Bob sees 2, Charlie sees 1.");
}

// ─── Run & Cleanup ───
main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
