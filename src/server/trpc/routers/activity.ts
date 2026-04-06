import { z } from "zod/v4";
import { createTRPCRouter, protectedProcedure } from "../init";
import { db } from "@/server/db";
import { TRPCError } from "@trpc/server";

// ──────────────────────────────────────────────
// Activity Router
// ──────────────────────────────────────────────
// Read-only router for querying the activity log.
// The write side (creating entries) is handled by logActivity() in
// src/server/activity.ts, called directly from other routers.
//
// TWO QUERY SHAPES:
// 1. listByBoard — paginated feed of everything on a board.
//    Used by the board-level activity panel in the sidebar.
//    Returns the 30 most recent entries by default.
//
// 2. listByCard — all activity for one specific card.
//    Used by the "Activity" section at the bottom of the card detail modal.
//    No pagination needed since individual cards rarely have 100+ events.

// ─── Helper: Check Board Membership ───
async function requireBoardMember(userId: string, boardId: string) {
  const membership = await db.boardMember.findUnique({
    where: { userId_boardId: { userId, boardId } },
  });
  if (!membership) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Board not found" });
  }
  return membership;
}

// The shape included with every activity row.
// We always include the user (for avatar + name) but omit the full card/board
// objects since the frontend already has that context.
const ACTIVITY_INCLUDE = {
  user: { select: { id: true, name: true, image: true } },
} as const;

export const activityRouter = createTRPCRouter({
  // ─── LIST BY BOARD ───
  // Paginated board-wide activity feed, newest first.
  // cursor is the createdAt of the last item in the previous page.
  listByBoard: protectedProcedure
    .input(
      z.object({
        boardId: z.string(),
        limit: z.number().min(1).max(50).default(30),
        cursor: z.string().optional(), // ISO datetime string for cursor-based pagination
      })
    )
    .query(async ({ ctx, input }) => {
      await requireBoardMember(ctx.user.id, input.boardId);

      const items = await db.activity.findMany({
        where: {
          boardId: input.boardId,
          // If cursor provided, return only items older than the cursor
          ...(input.cursor
            ? { createdAt: { lt: new Date(input.cursor) } }
            : {}),
        },
        include: ACTIVITY_INCLUDE,
        orderBy: { createdAt: "desc" },
        take: input.limit,
      });

      // Cursor for next page = createdAt of the last item returned
      const nextCursor =
        items.length === input.limit
          ? items[items.length - 1].createdAt.toISOString()
          : null;

      return { items, nextCursor };
    }),

  // ─── LIST BY CARD ───
  // All activity for one card, newest first.
  // No pagination — cards typically have fewer than 50 activity entries.
  listByCard: protectedProcedure
    .input(z.object({ cardId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Traverse Card → Column → Board to get the boardId for membership check
      const card = await db.card.findUnique({
        where: { id: input.cardId },
        select: { column: { select: { boardId: true } } },
      });
      if (!card) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Card not found" });
      }

      await requireBoardMember(ctx.user.id, card.column.boardId);

      return db.activity.findMany({
        where: { cardId: input.cardId },
        include: ACTIVITY_INCLUDE,
        orderBy: { createdAt: "desc" },
        take: 50,
      });
    }),
});
