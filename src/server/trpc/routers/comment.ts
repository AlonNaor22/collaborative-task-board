import { z } from "zod/v4";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "../init";
import { db } from "@/server/db";
import { logActivity } from "@/server/activity";
import { emitCommentUpdate, emitActivityUpdate, emitNotification } from "@/server/socket";
import { createNotification, parseMentions } from "@/server/notification";

// ──────────────────────────────────────────────
// Comment Router
// ──────────────────────────────────────────────
// Comments are text messages left by board members on a card.
// Rules:
//   - Any board member can CREATE a comment
//   - Only the comment AUTHOR can UPDATE or DELETE their own comment
//   - Any board member can LIST comments on a card they can access
//
// We log "created_comment" and "deleted_comment" to the activity feed
// so teammates can see discussion happening without opening every card.

// ─── Helper: Get boardId from a card ───
async function getBoardIdFromCard(cardId: string): Promise<string> {
  const card = await db.card.findUnique({
    where: { id: cardId },
    select: {
      title: true,
      column: { select: { boardId: true } },
    },
  });
  if (!card) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Card not found" });
  }
  return card.column.boardId;
}

// ─── Helper: Get card title (for activity details) ───
async function getCardTitle(cardId: string): Promise<string> {
  const card = await db.card.findUnique({
    where: { id: cardId },
    select: { title: true },
  });
  return card?.title ?? "Unknown card";
}

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

export const commentRouter = createTRPCRouter({
  // ─── LIST ───
  // Get all comments for a card, newest first.
  // The frontend displays them in this order with the text box at the bottom.
  list: protectedProcedure
    .input(z.object({ cardId: z.string() }))
    .query(async ({ ctx, input }) => {
      const boardId = await getBoardIdFromCard(input.cardId);
      await requireBoardMember(ctx.user.id, boardId);

      return db.comment.findMany({
        where: { cardId: input.cardId },
        include: {
          user: { select: { id: true, name: true, image: true } },
        },
        orderBy: { createdAt: "desc" }, // newest first
      });
    }),

  // ─── CREATE ───
  // Post a new comment on a card.
  // Any board member can comment — same philosophy as card creation.
  create: protectedProcedure
    .input(
      z.object({
        cardId: z.string(),
        content: z
          .string()
          .min(1, "Comment cannot be empty")
          .max(2000, "Comment too long"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const boardId = await getBoardIdFromCard(input.cardId);
      await requireBoardMember(ctx.user.id, boardId);

      const comment = await db.comment.create({
        data: {
          content: input.content,
          cardId: input.cardId,
          userId: ctx.user.id,
        },
        include: {
          user: { select: { id: true, name: true, image: true } },
        },
      });

      // Log asynchronously — don't block the comment creation response
      const cardTitle = await getCardTitle(input.cardId);
      await logActivity(db, {
        boardId,
        cardId: input.cardId,
        userId: ctx.user.id,
        action: "created_comment",
        details: {
          cardTitle,
          commentPreview: input.content.slice(0, 80),
        },
      });

      // Phase 7: Detect @mentions and notify mentioned board members
      // We match @name patterns against board member names.
      // For example, "@Alice check this" notifies Alice if she's a board member.
      const mentionedNames = parseMentions(input.content);
      if (mentionedNames.length > 0) {
        const boardMembers = await db.boardMember.findMany({
          where: { boardId },
          include: { user: { select: { id: true, name: true } } },
        });

        for (const member of boardMembers) {
          // Case-insensitive match: @alice matches "Alice Johnson"
          const nameMatch = mentionedNames.some(
            (name) =>
              member.user.name?.toLowerCase().includes(name.toLowerCase())
          );
          if (nameMatch && member.userId !== ctx.user.id) {
            await createNotification(db, {
              userId: member.userId,
              type: "MENTION",
              title: "Mentioned in Comment",
              message: `${ctx.user.name ?? "Someone"} mentioned you in "${cardTitle}"`,
              linkUrl: `/boards/${boardId}`,
              boardId,
              cardId: input.cardId,
            });
            emitNotification(member.userId);
          }
        }
      }

      emitCommentUpdate(boardId, input.cardId);
      emitActivityUpdate(boardId);

      return comment;
    }),

  // ─── UPDATE ───
  // Edit a comment's content. Only the comment's author can do this.
  //
  // WHY NOT ADMINS?
  // A comment is a personal expression. Even board owners shouldn't
  // silently edit someone else's words — that would be deceptive.
  // (Admins CAN delete comments, but not edit them.)
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        content: z
          .string()
          .min(1, "Comment cannot be empty")
          .max(2000, "Comment too long"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const comment = await db.comment.findUnique({
        where: { id: input.id },
      });
      if (!comment) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Comment not found" });
      }

      // Only the author can edit
      if (comment.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only edit your own comments",
        });
      }

      const updated = await db.comment.update({
        where: { id: input.id },
        data: { content: input.content },
        include: {
          user: { select: { id: true, name: true, image: true } },
        },
      });

      // Get boardId for the emit (comment → card → column → board)
      const boardId = await getBoardIdFromCard(comment.cardId);
      emitCommentUpdate(boardId, comment.cardId);

      return updated;
    }),

  // ─── DELETE ───
  // Remove a comment. Only the author can do this.
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const comment = await db.comment.findUnique({
        where: { id: input.id },
        include: {
          card: { select: { title: true, column: { select: { boardId: true } } } },
        },
      });
      if (!comment) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Comment not found" });
      }

      if (comment.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only delete your own comments",
        });
      }

      await db.comment.delete({ where: { id: input.id } });

      const boardId = comment.card.column.boardId;

      await logActivity(db, {
        boardId,
        cardId: comment.cardId,
        userId: ctx.user.id,
        action: "deleted_comment",
        details: { cardTitle: comment.card.title },
      });

      emitCommentUpdate(boardId, comment.cardId);
      emitActivityUpdate(boardId);

      return { success: true };
    }),
});
