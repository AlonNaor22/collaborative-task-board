import { z } from "zod/v4";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "../init";
import { db } from "@/server/db";
import { logActivity } from "@/server/activity";
import { emitBoardUpdate, emitActivityUpdate } from "@/server/socket";

// ──────────────────────────────────────────────
// Column Router — CRUD + Reorder
// ──────────────────────────────────────────────
// Handles creating, renaming, deleting, and reordering columns on a board.
//
// AUTHORIZATION PATTERN:
// Every column operation starts by checking that the current user is
// a member of the board that owns the column. This is a two-step process:
//   1. Find the column (to get its boardId)
//   2. Check the user's BoardMember record for that board
//
// For operations that receive a boardId directly (list, create, reorder),
// we skip step 1 and go straight to the membership check.
//
// We extract this into a helper function `requireBoardMember` to avoid
// repeating the same authorization logic in every procedure.
// Think of it like a utility method in a Java service class.

// ─── Helper: Check Board Membership ───
// Returns the membership record or throws NOT_FOUND/FORBIDDEN.
// Used by every procedure to enforce authorization.
//
// WHY return the membership?
// Some procedures need to check the user's role (e.g., only OWNER/ADMIN
// can delete columns). By returning the membership, the procedure can
// inspect `membership.role` without another database query.
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

const createColumnSchema = z.object({
  boardId: z.string(),
  title: z.string().min(1, "Title is required").max(50, "Title too long"),
});

const updateColumnSchema = z.object({
  id: z.string(),
  title: z.string().min(1, "Title is required").max(50, "Title too long"),
});

const reorderColumnsSchema = z.object({
  boardId: z.string(),
  // An array of column IDs in the new desired order.
  // The server sets position = index for each ID.
  // e.g., ["col_c", "col_a", "col_b"] → c=0, a=1, b=2
  columnIds: z.array(z.string()),
});

export const columnRouter = createTRPCRouter({
  // ─── LIST ───
  // Get all columns for a board, ordered by position, with their cards.
  //
  // This is the main query for rendering the Kanban board.
  // Each column comes with its cards already sorted by position,
  // so the frontend doesn't need to sort anything.
  //
  // SQL equivalent:
  //   SELECT c.*, card.*
  //   FROM columns c
  //   LEFT JOIN cards card ON card.column_id = c.id
  //   WHERE c.board_id = ?
  //   ORDER BY c.position, card.position
  list: protectedProcedure
    .input(z.object({ boardId: z.string() }))
    .query(async ({ ctx, input }) => {
      // First, verify the user can access this board
      await requireBoardMember(ctx.user.id, input.boardId);

      const columns = await db.column.findMany({
        where: { boardId: input.boardId },
        include: {
          cards: {
            orderBy: { position: "asc" },
            include: {
              creator: {
                select: { id: true, name: true, image: true },
              },
              labels: {
                include: { label: true },
              },
              assignees: {
                include: { user: { select: { id: true, name: true, image: true } } },
              },
            },
          },
        },
        orderBy: { position: "asc" },
      });

      return columns;
    }),

  // ─── CREATE ───
  // Add a new column to the end of the board.
  //
  // The position is calculated automatically: count existing columns
  // and use that as the new position (0-indexed, so 3 columns → new one is position 3).
  //
  // WHY OWNER/ADMIN ONLY?
  // Columns define the workflow structure of a board (To Do → In Progress → Done).
  // Letting any member add/remove columns could disrupt the team's workflow.
  // Cards, on the other hand, can be created by any member (Step 3).
  create: protectedProcedure
    .input(createColumnSchema)
    .mutation(async ({ ctx, input }) => {
      const membership = await requireBoardMember(
        ctx.user.id,
        input.boardId
      );

      if (membership.role === "MEMBER") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only board owners and admins can add columns",
        });
      }

      // Count existing columns to determine position
      const columnCount = await db.column.count({
        where: { boardId: input.boardId },
      });

      const column = await db.column.create({
        data: {
          title: input.title,
          boardId: input.boardId,
          position: columnCount, // Append at end
        },
        include: {
          cards: true, // Will be empty, but keeps return shape consistent
        },
      });

      await logActivity(db, {
        boardId: input.boardId,
        userId: ctx.user.id,
        action: "created_column",
        details: { columnTitle: column.title },
      });

      emitBoardUpdate(input.boardId);
      emitActivityUpdate(input.boardId);

      return column;
    }),

  // ─── UPDATE ───
  // Rename a column. Only OWNER/ADMIN can do this.
  //
  // We first find the column to get its boardId (since the input
  // only has the column ID), then check board membership.
  update: protectedProcedure
    .input(updateColumnSchema)
    .mutation(async ({ ctx, input }) => {
      // Find the column to get its boardId
      const column = await db.column.findUnique({
        where: { id: input.id },
      });

      if (!column) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Column not found",
        });
      }

      const membership = await requireBoardMember(
        ctx.user.id,
        column.boardId
      );

      if (membership.role === "MEMBER") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only board owners and admins can rename columns",
        });
      }

      const updated = await db.column.update({
        where: { id: input.id },
        data: { title: input.title },
      });

      emitBoardUpdate(column.boardId);

      return updated;
    }),

  // ─── DELETE ───
  // Delete a column and ALL its cards. Only OWNER/ADMIN.
  //
  // The cascade delete (onDelete: Cascade in the schema) means
  // PostgreSQL automatically deletes all cards in the column.
  //
  // After deletion, we re-index the remaining columns' positions
  // so there are no gaps. For example, if columns are [0, 1, 2]
  // and you delete position 1, we update position 2 → 1.
  //
  // This is like Array.splice() — remove an element and shift
  // everything after it down by one.
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const column = await db.column.findUnique({
        where: { id: input.id },
      });

      if (!column) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Column not found",
        });
      }

      const membership = await requireBoardMember(
        ctx.user.id,
        column.boardId
      );

      if (membership.role === "MEMBER") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only board owners and admins can delete columns",
        });
      }

      // Use a transaction to ensure both operations succeed or fail together.
      // A transaction is like a database-level "undo" — if step 2 fails,
      // step 1 is rolled back automatically.
      await db.$transaction(async (tx) => {
        // Step 1: Delete the column (cards cascade automatically)
        await tx.column.delete({
          where: { id: input.id },
        });

        // Step 2: Re-index remaining columns to close the gap.
        // We fetch all remaining columns ordered by their current position,
        // then set position = their index in the result array.
        const remaining = await tx.column.findMany({
          where: { boardId: column.boardId },
          orderBy: { position: "asc" },
        });

        // Update each column's position to its array index
        // This is O(n) database calls, but n is typically 3-7 columns,
        // so it's negligible. For 1000+ columns you'd use a batch update.
        await Promise.all(
          remaining.map((col, index) =>
            tx.column.update({
              where: { id: col.id },
              data: { position: index },
            })
          )
        );
      });

      await logActivity(db, {
        boardId: column.boardId,
        userId: ctx.user.id,
        action: "deleted_column",
        details: { columnTitle: column.title },
      });

      emitBoardUpdate(column.boardId);
      emitActivityUpdate(column.boardId);

      return { success: true };
    }),

  // ─── REORDER ───
  // Set the order of ALL columns in a board at once.
  //
  // The frontend sends the complete list of column IDs in the desired order.
  // We set position = array index for each one.
  //
  // WHY SEND THE FULL ARRAY (not "move column X to position Y")?
  // 1. Simpler logic — no need to calculate which columns shift
  // 2. Avoids race conditions — if two users reorder simultaneously,
  //    the last write wins cleanly (no corrupted intermediate states)
  // 3. The client already knows the new order (from the drag), so
  //    sending it directly is natural
  //
  // We also verify that the provided IDs match the actual columns
  // in the board, preventing someone from injecting column IDs from
  // a different board.
  reorder: protectedProcedure
    .input(reorderColumnsSchema)
    .mutation(async ({ ctx, input }) => {
      const membership = await requireBoardMember(
        ctx.user.id,
        input.boardId
      );

      if (membership.role === "MEMBER") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only board owners and admins can reorder columns",
        });
      }

      // Verify all provided IDs belong to this board
      const existingColumns = await db.column.findMany({
        where: { boardId: input.boardId },
        select: { id: true },
      });

      const existingIds = new Set(existingColumns.map((c) => c.id));
      const inputIds = new Set(input.columnIds);

      // Check: are the sets equal? (same elements, no extras, no missing)
      // This prevents:
      //   - Injecting a column from another board
      //   - Accidentally dropping a column by omitting its ID
      if (
        existingIds.size !== inputIds.size ||
        ![...existingIds].every((id) => inputIds.has(id))
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Column IDs don't match the board's columns",
        });
      }

      // Update all positions in a transaction
      await db.$transaction(
        input.columnIds.map((id, index) =>
          db.column.update({
            where: { id },
            data: { position: index },
          })
        )
      );

      emitBoardUpdate(input.boardId);

      return { success: true };
    }),
});
