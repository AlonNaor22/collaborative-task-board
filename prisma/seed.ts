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
//
// NEW IN PHASE 3: Each board now has columns and cards.
// Columns define the workflow (To Do → In Progress → Done).
// Cards are the actual tasks, placed inside columns.
const testBoards = [
  {
    title: "Sprint 23",
    description: "Current sprint tasks for the team. Bug fixes and new features.",
    color: "#3B82F6", // Blue
    ownerEmail: "alice@example.com",
    memberEmails: ["bob@example.com", "charlie@example.com"],
    // Columns with their cards. Position = array index (0-based).
    columns: [
      {
        title: "To Do",
        cards: [
          { title: "Set up CI/CD pipeline", description: "Configure GitHub Actions for automated testing and deployment." },
          { title: "Write unit tests for auth", description: "Cover login, register, and session management flows." },
          { title: "Design settings page", description: null },
        ],
      },
      {
        title: "In Progress",
        cards: [
          { title: "Build Kanban board UI", description: "Implement drag-and-drop columns and cards using @dnd-kit." },
          { title: "Fix login redirect bug", description: "Users are redirected to / instead of /boards after login." },
        ],
      },
      {
        title: "Done",
        cards: [
          { title: "Set up project scaffolding", description: "Next.js, Prisma, tRPC, Auth.js — all configured." },
        ],
      },
    ],
  },
  {
    title: "Marketing Campaign",
    description: "Q2 marketing campaign planning and execution.",
    color: "#22C55E", // Green
    ownerEmail: "alice@example.com",
    memberEmails: ["bob@example.com"],
    columns: [
      {
        title: "Ideas",
        cards: [
          { title: "Blog post series on product updates", description: null },
          { title: "Partner with tech influencers", description: "Reach out to 5-10 influencers in the dev tools space." },
        ],
      },
      {
        title: "Planning",
        cards: [
          { title: "Create Q2 content calendar", description: "Map out blog posts, social media, and email campaigns." },
        ],
      },
      {
        title: "Executing",
        cards: [], // Empty column — no tasks started yet
      },
    ],
  },
  {
    title: "Personal Tasks",
    description: null,
    color: "#A855F7", // Purple
    ownerEmail: "alice@example.com",
    memberEmails: [], // Only Alice — a private board
    columns: [
      { title: "To Do", cards: [{ title: "Grocery shopping", description: null }] },
      { title: "Done", cards: [] },
    ],
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

    // Create board + owner membership + columns + cards in one nested create.
    //
    // Prisma's nested `create` lets us build the entire hierarchy in a
    // single database call. Under the hood, Prisma wraps this in a
    // transaction, so if any part fails, nothing is created.
    //
    // The structure mirrors our data model:
    //   Board → Members[]
    //         → Columns[] → Cards[]
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
        // ─── NEW: Create columns with their cards ───
        // Each column gets a `position` (its index in the array).
        // Each card inside gets a `position` too (top to bottom).
        // The `creatorId` is the board owner — in a real app, different
        // users would create different cards, but for test data this is fine.
        columns: {
          create: boardData.columns.map((col, colIndex) => ({
            title: col.title,
            position: colIndex,
            cards: {
              create: col.cards.map((card, cardIndex) => ({
                title: card.title,
                description: card.description,
                position: cardIndex,
                creatorId: ownerId,
              })),
            },
          })),
        },
      },
    });

    const cardCount = boardData.columns.reduce((sum, col) => sum + col.cards.length, 0);
    console.log(
      `  ✅ ${board.title} (${boardData.memberEmails.length + 1} members, ${boardData.columns.length} columns, ${cardCount} cards)`
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
