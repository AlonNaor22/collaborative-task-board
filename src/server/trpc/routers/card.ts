import { z } from "zod/v4";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "../init";
import { db } from "@/server/db";

// ──────────────────────────────────────────────
// Card Router — CRUD + Move/Reorder
// ──────────────────────────────────────────────
// Cards are the core unit of work on a Kanban board.
// Unlike columns (which only OWNER/ADMIN can manage), ANY board member
// can create, edit, and move cards. This is because cards represent
// individual tasks, and every team member needs to manage their work.
//
// The trickiest procedure here is `move`, which handles BOTH:
//   1. Reordering a card within the same column (drag up/down)
//   2. Moving a card to a different column (drag left/right)
// We combine both into one procedure because the drag-and-drop library
// doesn't distinguish between them — a drop is a drop.

// ─── Helper: Get board ID from a column ───
// Cards belong to columns, and columns belong to boards.
// To check board membership, we need to traverse:
//   Card → Column → Board → BoardMember
// This helper does the first hop: Column → boardId.
async function getBoardIdFromColumn(columnId: string): Promise<string> {
  const column = await db.column.findUnique({
    where: { id: columnId },
    select: { boardId: true },
  });

  if (!column) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Column not found",
    });
  }

  return column.boardId;
}

// ─── Helper: Check Board Membership ───
// Same pattern as the column router — verify the user belongs to the board.
async function requireBoardMember(userId: string, boardId: string) {
  const membership = await db.boardMember.findUnique({
    where: {
      userId_boardId: { userId, boardId },
    },
  });

  if (!membership) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Board not found",
    });
  }

  return membership;
}

// ─── Zod Schemas ───

const createCardSchema = z.object({
  columnId: z.string(),
  title: z.string().min(1, "Title is required").max(200, "Title too long"),
});

const updateCardSchema = z.object({
  id: z.string(),
  title: z
    .string()
    .min(1, "Title is required")
    .max(200, "Title too long")
    .optional(),
  description: z.string().max(5000, "Description too long").nullish(),
});

// The move schema handles both same-column reorder and cross-column moves.
//
// HOW IT WORKS:
// The frontend sends:
//   - cardId: which card was dragged
//   - targetColumnId: the column where it was dropped
//   - cardIds: ALL card IDs in the target column, in their new order
//
// Example — moving "Fix bug" from "To Do" to "In Progress":
//   Before:  To Do: [Fix bug, Write tests]   In Progress: [Add API, Design navbar]
//   After:   To Do: [Write tests]            In Progress: [Add API, Fix bug, Design navbar]
//
//   The call: move({ cardId: "Fix bug", targetColumnId: "In Progress",
//                     cardIds: ["Add API", "Fix bug", "Design navbar"] })
//
// The server:
//   1. Updates "Fix bug"'s columnId to "In Progress"
//   2. Sets positions: Add API=0, Fix bug=1, Design navbar=2
//   3. Re-indexes "To Do": Write tests=0
const moveCardSchema = z.object({
  cardId: z.string(),
  targetColumnId: z.string(),
  // The complete ordered list of card IDs in the target column AFTER the move.
  // This includes the moved card in its new position.
  cardIds: z.array(z.string()),
  // If moving across columns, we also need to re-index the source column.
  // This is the ordered list of remaining card IDs in the SOURCE column.
  // Only needed when sourceColumnId !== targetColumnId.
  sourceColumnId: z.string().optional(),
  sourceCardIds: z.array(z.string()).optional(),
});

export const cardRouter = createTRPCRouter({
  // ─── CREATE ───
  // Add a new card to the bottom of a column.
  // ANY board member can create cards.
  //
  // Position is auto-calculated: count existing cards in the column.
  // e.g., column has 3 cards (positions 0,1,2) → new card gets position 3.
  create: protectedProcedure
    .input(createCardSchema)
    .mutation(async ({ ctx, input }) => {
      const boardId = await getBoardIdFromColumn(input.columnId);
      await requireBoardMember(ctx.user.id, boardId);

      // Count existing cards to determine position
      const cardCount = await db.card.count({
        where: { columnId: input.columnId },
      });

      const card = await db.card.create({
        data: {
          title: input.title,
          columnId: input.columnId,
          creatorId: ctx.user.id,
          position: cardCount, // Append at bottom
        },
        include: {
          creator: {
            select: { id: true, name: true, image: true },
          },
        },
      });

      return card;
    }),

  // ─── UPDATE ───
  // Edit a card's title or description.
  // ANY board member can edit any card (like a shared Google Doc).
  //
  // In a stricter system you might only let the creator or assignees
  // edit, but for a collaborative task board, open editing is standard
  // (Trello, Jira, Linear all work this way).
  update: protectedProcedure
    .input(updateCardSchema)
    .mutation(async ({ ctx, input }) => {
      // Find the card to get its column, then the board
      const card = await db.card.findUnique({
        where: { id: input.id },
        include: { column: { select: { boardId: true } } },
      });

      if (!card) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Card not found",
        });
      }

      await requireBoardMember(ctx.user.id, card.column.boardId);

      const updated = await db.card.update({
        where: { id: input.id },
        data: {
          ...(input.title !== undefined && { title: input.title }),
          ...(input.description !== undefined && {
            description: input.description,
          }),
        },
        include: {
          creator: {
            select: { id: true, name: true, image: true },
          },
        },
      });

      return updated;
    }),

  // ─── DELETE ───
  // Delete a card. ANY board member can delete any card.
  //
  // After deletion, we re-index the remaining cards in the same column
  // to close position gaps (same pattern as column.delete).
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const card = await db.card.findUnique({
        where: { id: input.id },
        include: { column: { select: { boardId: true } } },
      });

      if (!card) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Card not found",
        });
      }

      await requireBoardMember(ctx.user.id, card.column.boardId);

      await db.$transaction(async (tx) => {
        // Step 1: Delete the card
        await tx.card.delete({
          where: { id: input.id },
        });

        // Step 2: Re-index remaining cards in the column
        const remaining = await tx.card.findMany({
          where: { columnId: card.columnId },
          orderBy: { position: "asc" },
        });

        await Promise.all(
          remaining.map((c, index) =>
            tx.card.update({
              where: { id: c.id },
              data: { position: index },
            })
          )
        );
      });

      return { success: true };
    }),

  // ─── MOVE ───
  // Move a card within or between columns, and set the new order.
  //
  // This is the most complex procedure because it handles two scenarios:
  //
  // SCENARIO 1: Same-column reorder (drag card up/down)
  //   - sourceColumnId is not provided (or equals targetColumnId)
  //   - We just update positions in the target column
  //   - The card's columnId doesn't change
  //
  // SCENARIO 2: Cross-column move (drag card to different column)
  //   - sourceColumnId is provided and differs from targetColumnId
  //   - We update the card's columnId
  //   - We re-index BOTH the source and target columns
  //
  // WHY A TRANSACTION?
  // Moving a card involves updating multiple rows. If the server crashes
  // mid-way, we'd have inconsistent positions. The transaction ensures
  // either ALL updates succeed or NONE do (atomicity).
  //
  // Think of it like a bank transfer: debit + credit must BOTH succeed.
  // You can't debit one account without crediting the other.
  move: protectedProcedure
    .input(moveCardSchema)
    .mutation(async ({ ctx, input }) => {
      const boardId = await getBoardIdFromColumn(input.targetColumnId);
      await requireBoardMember(ctx.user.id, boardId);

      // If moving across columns, verify source column is on the same board
      if (input.sourceColumnId && input.sourceColumnId !== input.targetColumnId) {
        const sourceBoardId = await getBoardIdFromColumn(input.sourceColumnId);
        if (sourceBoardId !== boardId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Cannot move cards between different boards",
          });
        }
      }

      await db.$transaction(async (tx) => {
        // If cross-column move, update the card's columnId
        if (input.sourceColumnId && input.sourceColumnId !== input.targetColumnId) {
          await tx.card.update({
            where: { id: input.cardId },
            data: { columnId: input.targetColumnId },
          });

          // Re-index source column (the column the card LEFT)
          if (input.sourceCardIds) {
            await Promise.all(
              input.sourceCardIds.map((id, index) =>
                tx.card.update({
                  where: { id },
                  data: { position: index },
                })
              )
            );
          }
        }

        // Re-index target column (the column the card is NOW in)
        await Promise.all(
          input.cardIds.map((id, index) =>
            tx.card.update({
              where: { id },
              data: { position: index },
            })
          )
        );
      });

      return { success: true };
    }),
});
