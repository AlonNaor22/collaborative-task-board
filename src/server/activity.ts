import type { PrismaClient } from "@/generated/prisma/client";

// ──────────────────────────────────────────────
// Activity Logger Helper
// ──────────────────────────────────────────────
// A thin wrapper around `prisma.activity.create` so every mutation
// can log what happened in one line without repeating the JSON shape.
//
// WHY A HELPER?
// Different routers (card, column, board, comment) all log activities.
// Without this helper, each would need to know the full Activity model
// shape. Centralising it here means we only change one place if the
// model changes.
//
// TYPING:
// We accept `Pick<PrismaClient, "activity">` — any object that has
// the `activity` model property. This satisfies BOTH the regular
// Prisma client (db) AND the transaction client (tx) that $transaction
// passes to its callback, which has all model methods but not $transaction.

type DbLike = Pick<PrismaClient, "activity">;

interface LogActivityArgs {
  boardId: string;
  cardId?: string | null;
  userId: string;
  // Action names use snake_case verbs — easy to switch on in the UI.
  // Examples: "created_card", "moved_card", "added_label", "created_comment"
  action: string;
  // Free-form context. Stored as JSONB. Keep it flat and human-readable
  // so the frontend can render it without a big switch tree.
  details?: Record<string, unknown>;
}

// We intentionally don't throw on failure — activity logging is
// best-effort. A logging failure should never break a user action.
export async function logActivity(
  prisma: DbLike,
  { boardId, cardId, userId, action, details }: LogActivityArgs
): Promise<void> {
  try {
    // JSON.parse(JSON.stringify(...)) converts Record<string, unknown> to `any`,
    // which is assignable to Prisma's Json type without needing runtime Prisma imports.
    const jsonDetails = JSON.parse(JSON.stringify(details ?? {}));
    await prisma.activity.create({
      data: {
        boardId,
        cardId: cardId ?? null,
        userId,
        action,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        details: jsonDetails,
      },
    });
  } catch {
    // Swallow logging errors — the primary mutation already succeeded.
    // In production you'd want to emit a metric/alert here.
  }
}
