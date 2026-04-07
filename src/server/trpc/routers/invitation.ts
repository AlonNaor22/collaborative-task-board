import { z } from "zod/v4";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "../init";
import { db } from "@/server/db";
import { logActivity } from "@/server/activity";
import { createNotification } from "@/server/notification";
import { emitBoardUpdate, emitActivityUpdate, emitNotification } from "@/server/socket";

// ──────────────────────────────────────────────
// Invitation Router — Board Sharing
// ──────────────────────────────────────────────
// Handles the lifecycle of board invitations:
//   1. OWNER/ADMIN sends an invite to a user (by email)
//   2. The invitee sees the pending invitation on their dashboard
//   3. The invitee accepts (becomes a BoardMember) or declines
//
// This is like GitHub's repository collaborator invitations.
// The key difference from directly adding a BoardMember: the invitee
// must CONSENT before joining. This prevents unwanted board spam.
//
// AUTHORIZATION:
// - Sending invites: requires OWNER or ADMIN role on the board
// - Listing pending invites: each user sees only their own
// - Accept/decline: only the invitee can act on their invitation

export const invitationRouter = createTRPCRouter({
  // ─── SEND INVITATION ───
  // An OWNER or ADMIN invites a user to their board by email.
  // We perform several checks before creating the invitation:
  //   1. The sender must be OWNER or ADMIN on this board
  //   2. The invitee must be a registered user (we look up by email)
  //   3. The invitee can't already be a board member
  //   4. There can't be a duplicate PENDING invitation
  //   5. You can't invite yourself (that would be silly)
  send: protectedProcedure
    .input(
      z.object({
        boardId: z.string(),
        inviteeEmail: z.string().email("Must be a valid email"),
        role: z.enum(["ADMIN", "MEMBER"]).optional().default("MEMBER"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // ─── Check 1: Sender authorization ───
      const senderMembership = await db.boardMember.findUnique({
        where: {
          userId_boardId: { userId: ctx.user.id, boardId: input.boardId },
        },
      });

      if (
        !senderMembership ||
        (senderMembership.role !== "OWNER" && senderMembership.role !== "ADMIN")
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only board owners and admins can send invitations",
        });
      }

      // ─── Check 2: Invitee exists ───
      const invitee = await db.user.findUnique({
        where: { email: input.inviteeEmail },
        select: { id: true, name: true },
      });

      if (!invitee) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No user found with that email address",
        });
      }

      // ─── Check 3: Not self-invite ───
      if (invitee.id === ctx.user.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You can't invite yourself",
        });
      }

      // ─── Check 4: Not already a member ───
      const existingMembership = await db.boardMember.findUnique({
        where: {
          userId_boardId: { userId: invitee.id, boardId: input.boardId },
        },
      });

      if (existingMembership) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This user is already a member of the board",
        });
      }

      // ─── Check 5: No duplicate pending invitation ───
      // We only check for PENDING — if a previous invitation was
      // DECLINED, the admin can re-invite (a second chance).
      const existingInvitation = await db.invitation.findFirst({
        where: {
          boardId: input.boardId,
          inviteeId: invitee.id,
          status: "PENDING",
        },
      });

      if (existingInvitation) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "An invitation is already pending for this user",
        });
      }

      // ─── Create the invitation ───
      const board = await db.board.findUnique({
        where: { id: input.boardId },
        select: { title: true },
      });

      const invitation = await db.invitation.create({
        data: {
          boardId: input.boardId,
          inviterId: ctx.user.id,
          inviteeId: invitee.id,
          role: input.role,
        },
      });

      // ─── Notify the invitee ───
      await createNotification(db, {
        userId: invitee.id,
        type: "INVITATION",
        title: "Board Invitation",
        message: `${ctx.user.name ?? "Someone"} invited you to "${board?.title ?? "a board"}"`,
        linkUrl: "/boards",
        boardId: input.boardId,
      });

      // ─── Log activity + emit events ───
      await logActivity(db, {
        boardId: input.boardId,
        userId: ctx.user.id,
        action: "sent_invitation",
        details: { inviteeName: invitee.name ?? "" },
      });

      emitNotification(invitee.id);
      emitActivityUpdate(input.boardId);

      return invitation;
    }),

  // ─── LIST PENDING INVITATIONS (for current user) ───
  // Shows all PENDING invitations addressed to the logged-in user.
  // Used on the dashboard to show "You've been invited to..." cards.
  listPending: protectedProcedure.query(async ({ ctx }) => {
    return db.invitation.findMany({
      where: {
        inviteeId: ctx.user.id,
        status: "PENDING",
      },
      include: {
        board: { select: { id: true, title: true, color: true } },
        inviter: { select: { id: true, name: true, email: true, image: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }),

  // ─── LIST INVITATIONS BY BOARD ───
  // Shows all PENDING invitations for a specific board.
  // Only OWNER/ADMIN can see this — used in the member management panel.
  listByBoard: protectedProcedure
    .input(z.object({ boardId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Verify caller is OWNER or ADMIN
      const membership = await db.boardMember.findUnique({
        where: {
          userId_boardId: { userId: ctx.user.id, boardId: input.boardId },
        },
      });

      if (
        !membership ||
        (membership.role !== "OWNER" && membership.role !== "ADMIN")
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only board owners and admins can view invitations",
        });
      }

      return db.invitation.findMany({
        where: {
          boardId: input.boardId,
          status: "PENDING",
        },
        include: {
          invitee: { select: { id: true, name: true, email: true, image: true } },
        },
        orderBy: { createdAt: "desc" },
      });
    }),

  // ─── ACCEPT INVITATION ───
  // The invitee accepts → they become a BoardMember.
  // This is done in a $transaction to ensure atomicity:
  // either BOTH the invitation update AND the membership creation succeed,
  // or NEITHER does. This prevents partial states like "invitation accepted
  // but membership not created".
  accept: protectedProcedure
    .input(z.object({ invitationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Fetch the invitation and verify ownership
      const invitation = await db.invitation.findUnique({
        where: { id: input.invitationId },
        include: {
          board: { select: { id: true, title: true } },
        },
      });

      if (!invitation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invitation not found",
        });
      }

      if (invitation.inviteeId !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "This invitation is not addressed to you",
        });
      }

      if (invitation.status !== "PENDING") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This invitation has already been responded to",
        });
      }

      // ─── Transaction: update invitation + create membership ───
      await db.$transaction(async (tx) => {
        await tx.invitation.update({
          where: { id: input.invitationId },
          data: { status: "ACCEPTED" },
        });

        await tx.boardMember.create({
          data: {
            userId: ctx.user.id,
            boardId: invitation.boardId,
            role: invitation.role,
          },
        });
      });

      // ─── Notify the inviter that their invitation was accepted ───
      await createNotification(db, {
        userId: invitation.inviterId,
        type: "INVITATION",
        title: "Invitation Accepted",
        message: `${ctx.user.name ?? "Someone"} joined "${invitation.board.title}"`,
        linkUrl: `/boards/${invitation.boardId}`,
        boardId: invitation.boardId,
      });

      // ─── Log activity + emit events ───
      await logActivity(db, {
        boardId: invitation.boardId,
        userId: ctx.user.id,
        action: "accepted_invitation",
        details: { boardTitle: invitation.board.title },
      });

      emitNotification(invitation.inviterId);
      emitBoardUpdate(invitation.boardId);
      emitActivityUpdate(invitation.boardId);

      return { success: true };
    }),

  // ─── DECLINE INVITATION ───
  // The invitee declines — no membership is created.
  // The invitation status is updated to DECLINED, which allows
  // the admin to re-invite later (we only block duplicate PENDING invites).
  decline: protectedProcedure
    .input(z.object({ invitationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const invitation = await db.invitation.findUnique({
        where: { id: input.invitationId },
      });

      if (!invitation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invitation not found",
        });
      }

      if (invitation.inviteeId !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "This invitation is not addressed to you",
        });
      }

      if (invitation.status !== "PENDING") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This invitation has already been responded to",
        });
      }

      await db.invitation.update({
        where: { id: input.invitationId },
        data: { status: "DECLINED" },
      });

      return { success: true };
    }),
});
