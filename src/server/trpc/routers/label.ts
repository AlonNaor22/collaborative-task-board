import { z } from "zod/v4";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "../init";
import { db } from "@/server/db";

// ──────────────────────────────────────────────
// Label Router — CRUD for board labels
// ──────────────────────────────────────────────
// Labels are board-scoped colored tags that can be applied to cards.
// Think of them like GitHub issue labels: "Bug", "Feature", "Urgent".
//
// Each label belongs to one board and can be applied to any card on that board.
// The many-to-many link between cards and labels lives in the CardLabel join table.
//
// AUTHORIZATION:
// - Any board member can VIEW labels (needed to apply/remove them from cards)
// - Only OWNER/ADMIN can CREATE, UPDATE, or DELETE labels
//   (same reasoning as columns: labels define workflow vocabulary)

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

export const labelRouter = createTRPCRouter({
  // ─── LIST ───
  // Get all labels for a board. Any member can call this.
  // The card detail modal uses this to show which labels exist
  // and which are currently applied to a card.
  list: protectedProcedure
    .input(z.object({ boardId: z.string() }))
    .query(async ({ ctx, input }) => {
      await requireBoardMember(ctx.user.id, input.boardId);

      return db.label.findMany({
        where: { boardId: input.boardId },
        orderBy: { name: "asc" },
      });
    }),

  // ─── CREATE ───
  // Add a new label to a board. OWNER/ADMIN only.
  create: protectedProcedure
    .input(
      z.object({
        boardId: z.string(),
        name: z.string().min(1, "Name is required").max(50, "Name too long"),
        color: z
          .string()
          .regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid hex color"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const membership = await requireBoardMember(ctx.user.id, input.boardId);
      if (membership.role === "MEMBER") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only board owners and admins can manage labels",
        });
      }

      return db.label.create({
        data: {
          name: input.name,
          color: input.color,
          boardId: input.boardId,
        },
      });
    }),

  // ─── UPDATE ───
  // Rename or recolor a label. OWNER/ADMIN only.
  // Changes automatically affect all cards that use this label
  // (because cards reference the label by ID, not by value).
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z
          .string()
          .min(1, "Name is required")
          .max(50, "Name too long")
          .optional(),
        color: z
          .string()
          .regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid hex color")
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const label = await db.label.findUnique({ where: { id: input.id } });
      if (!label) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Label not found" });
      }

      const membership = await requireBoardMember(ctx.user.id, label.boardId);
      if (membership.role === "MEMBER") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only board owners and admins can manage labels",
        });
      }

      return db.label.update({
        where: { id: input.id },
        data: {
          ...(input.name !== undefined && { name: input.name }),
          ...(input.color !== undefined && { color: input.color }),
        },
      });
    }),

  // ─── DELETE ───
  // Delete a label from the board. OWNER/ADMIN only.
  // The onDelete: Cascade in the CardLabel model means all
  // card↔label associations are automatically removed too.
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const label = await db.label.findUnique({ where: { id: input.id } });
      if (!label) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Label not found" });
      }

      const membership = await requireBoardMember(ctx.user.id, label.boardId);
      if (membership.role === "MEMBER") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only board owners and admins can manage labels",
        });
      }

      await db.label.delete({ where: { id: input.id } });
      return { success: true };
    }),
});
