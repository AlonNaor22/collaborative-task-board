import { z } from "zod/v4";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "../init";
import { db } from "@/server/db";
import { logActivity } from "@/server/activity";

// ──────────────────────────────────────────────
// Board Router — CRUD Procedures
// ──────────────────────────────────────────────
// This router handles everything related to boards:
// listing, viewing, creating, updating, and deleting.
//
// ALL procedures use protectedProcedure because every board
// operation requires knowing WHO is making the request.
// You can't list "my boards" without knowing who "me" is.
//
// AUTHORIZATION vs AUTHENTICATION:
// - Authentication (Phase 1): "Who are you?" → handled by protectedProcedure
// - Authorization (this file): "What are you allowed to do?" → we check roles
//
// For example, any board member can VIEW a board, but only the
// OWNER can DELETE it. We check the user's role in BoardMember
// before allowing certain operations.

// ─── Zod Schemas ───
// Input validation schemas. These run BEFORE the procedure logic.
// If validation fails, tRPC returns a 400 error automatically.
// Think of them like Java annotations: @NotNull, @Size(min=1, max=100)

const createBoardSchema = z.object({
  title: z.string().min(1, "Title is required").max(100, "Title too long"),
  description: z.string().max(500, "Description too long").optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid hex color")
    .optional(),
});

const updateBoardSchema = z.object({
  id: z.string(),
  title: z.string().min(1, "Title is required").max(100, "Title too long").optional(),
  description: z.string().max(500, "Description too long").nullish(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid hex color")
    .optional(),
});

export const boardRouter = createTRPCRouter({
  // ─── LIST ───
  // Get all boards where the current user is a member.
  // Returns boards sorted by most recently updated.
  //
  // HOW THE QUERY WORKS:
  // We search BoardMember for rows matching the current user,
  // then "include" the related Board data. This is like a SQL JOIN:
  //   SELECT b.* FROM boards b
  //   JOIN board_members bm ON b.id = bm.board_id
  //   WHERE bm.user_id = ?
  //   ORDER BY b.updated_at DESC
  //
  // We also include _count.members so each board card can show
  // "3 members" without a separate query.
  list: protectedProcedure.query(async ({ ctx }) => {
    const boards = await db.board.findMany({
      where: {
        members: {
          some: {
            userId: ctx.user.id,
          },
        },
      },
      include: {
        owner: {
          select: { id: true, name: true, image: true },
        },
        _count: {
          select: { members: true },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    return boards;
  }),

  // ─── GET BY ID ───
  // Get a single board with its members.
  // Also verifies the current user is a member (authorization).
  //
  // WHY CHECK MEMBERSHIP?
  // Just because a user is logged in doesn't mean they can see
  // every board. Boards are private to their members. If someone
  // guesses a board ID, they shouldn't be able to access it.
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const board = await db.board.findUnique({
        where: { id: input.id },
        include: {
          owner: {
            select: { id: true, name: true, email: true, image: true },
          },
          members: {
            include: {
              user: {
                select: { id: true, name: true, email: true, image: true },
              },
            },
            orderBy: { joinedAt: "asc" },
          },
        },
      });

      if (!board) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Board not found",
        });
      }

      // Check: is the current user a member of this board?
      const isMember = board.members.some(
        (member) => member.userId === ctx.user.id
      );

      if (!isMember) {
        // Return NOT_FOUND instead of FORBIDDEN to avoid leaking
        // information about the board's existence. This is a common
        // security practice — don't tell attackers "this board exists
        // but you can't access it."
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Board not found",
        });
      }

      return board;
    }),

  // ─── CREATE ───
  // Create a new board and automatically add the creator as OWNER.
  //
  // This uses a Prisma "nested create" — in a single database
  // transaction, it creates both the Board AND the BoardMember record.
  // If either fails, both are rolled back (atomic operation).
  //
  // Without this, if the Board was created but the BoardMember
  // creation failed, you'd have an orphaned board with no members.
  create: protectedProcedure
    .input(createBoardSchema)
    .mutation(async ({ ctx, input }) => {
      const board = await db.board.create({
        data: {
          title: input.title,
          description: input.description,
          color: input.color ?? "#3B82F6", // Default blue
          ownerId: ctx.user.id,
          // Nested create: create a BoardMember at the same time
          members: {
            create: {
              userId: ctx.user.id,
              role: "OWNER",
            },
          },
        },
        include: {
          owner: {
            select: { id: true, name: true, image: true },
          },
          _count: {
            select: { members: true },
          },
        },
      });

      await logActivity(db, {
        boardId: board.id,
        userId: ctx.user.id,
        action: "created_board",
        details: { boardTitle: board.title },
      });

      return board;
    }),

  // ─── UPDATE ───
  // Update a board's title, description, or color.
  // Only OWNER and ADMIN can update.
  //
  // The authorization check queries BoardMember to find the current
  // user's role for this specific board.
  update: protectedProcedure
    .input(updateBoardSchema)
    .mutation(async ({ ctx, input }) => {
      // Check authorization: is the user an OWNER or ADMIN?
      const membership = await db.boardMember.findUnique({
        where: {
          userId_boardId: {
            userId: ctx.user.id,
            boardId: input.id,
          },
        },
      });

      if (!membership) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Board not found",
        });
      }

      if (membership.role === "MEMBER") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only board owners and admins can edit board settings",
        });
      }

      // Build the update data object.
      // We only include fields that were actually provided,
      // so sending { id, title } only updates the title.
      // `undefined` values are ignored by Prisma (not set to null).
      const board = await db.board.update({
        where: { id: input.id },
        data: {
          ...(input.title !== undefined && { title: input.title }),
          ...(input.description !== undefined && { description: input.description }),
          ...(input.color !== undefined && { color: input.color }),
        },
        include: {
          owner: {
            select: { id: true, name: true, image: true },
          },
          _count: {
            select: { members: true },
          },
        },
      });

      return board;
    }),

  // ─── DELETE ───
  // Delete a board entirely. ONLY the OWNER can do this.
  //
  // Prisma cascades the delete automatically (because we set
  // `onDelete: Cascade` on the Board relation in BoardMember).
  // So deleting a board also deletes all its BoardMember records,
  // and in Phase 3+, all its columns, cards, comments, etc.
  //
  // This is a DESTRUCTIVE operation — the UI should always show
  // a confirmation dialog before calling this.
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Only the OWNER can delete a board
      const membership = await db.boardMember.findUnique({
        where: {
          userId_boardId: {
            userId: ctx.user.id,
            boardId: input.id,
          },
        },
      });

      if (!membership) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Board not found",
        });
      }

      if (membership.role !== "OWNER") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the board owner can delete this board",
        });
      }

      await db.board.delete({
        where: { id: input.id },
      });

      return { success: true };
    }),
});
