import type { PrismaClient, NotificationType } from "@/generated/prisma/client";

// ──────────────────────────────────────────────
// Notification Helper
// ──────────────────────────────────────────────
// A thin wrapper around `prisma.notification.create`, modeled after
// the activity logger in `src/server/activity.ts`.
//
// WHY A HELPER?
// Multiple routers create notifications (invitation, card assignment,
// @mention in comments). Centralising the logic here means:
//   1. One place to change if the Notification model evolves
//   2. Consistent error handling (best-effort, never breaks the primary mutation)
//   3. Easy to add side effects later (e.g., email notifications)
//
// TYPING:
// Same `Pick<PrismaClient, "notification">` pattern as logActivity.
// Works with both the regular `db` client and `tx` inside $transaction.

type DbLike = Pick<PrismaClient, "notification">;

interface CreateNotificationArgs {
  userId: string; // Who receives the notification
  type: NotificationType;
  title: string; // Short heading, e.g. "Board Invitation"
  message: string; // Longer description, e.g. "Alice invited you to Sprint 23"
  linkUrl?: string; // Where clicking the notification navigates, e.g. "/boards/abc123"
  boardId?: string; // Optional context for display
  cardId?: string; // Optional context for display
}

// Best-effort: a notification failure should NEVER break the primary
// user action (same philosophy as logActivity).
export async function createNotification(
  prisma: DbLike,
  { userId, type, title, message, linkUrl, boardId, cardId }: CreateNotificationArgs
): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        linkUrl: linkUrl ?? null,
        boardId: boardId ?? null,
        cardId: cardId ?? null,
      },
    });
  } catch {
    // Swallow errors — notification logging is best-effort.
    // In production you'd emit a metric here.
  }
}

// ──────────────────────────────────────────────
// @Mention Parser
// ──────────────────────────────────────────────
// Extracts @mentioned names from comment text.
// Example: "Hey @Alice, can you review this?" → ["Alice"]
//
// This is a simple regex approach — it matches @word patterns.
// For a production app, you'd use structured mentions with user IDs
// (like Slack's <@U123> format), but for our portfolio project,
// matching by name is sufficient since board teams are small.
export function parseMentions(content: string): string[] {
  const matches = content.match(/@(\w+)/g);
  return matches ? matches.map((m) => m.slice(1)) : [];
}
