import { z } from "zod/v4";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "../init";
import { db } from "@/server/db";
import { emitNotificationRead } from "@/server/socket";

// ──────────────────────────────────────────────
// Notification Router
// ──────────────────────────────────────────────
// CRUD for in-app notifications. Think of it like GitHub's
// notification system: a list of things that happened, each
// with a read/unread state and a link to the relevant page.
//
// The frontend uses two queries in parallel:
//   1. `unreadCount` → powers the badge number on the bell icon
//   2. `list` → powers the dropdown when you click the bell
//
// WHY CURSOR-BASED PAGINATION?
// Offset-based pagination ("skip 20, take 20") has a problem:
// if a new notification arrives while you're on page 2, all items
// shift by one, and you might see a duplicate or miss one.
// Cursor-based ("give me 20 items after ID xyz") doesn't have
// this problem because it anchors to a specific item, not a position.
// Same reason Twitter/Instagram use cursor pagination.

export const notificationRouter = createTRPCRouter({
  // ─── UNREAD COUNT ───
  // Returns the number of unread notifications for the bell badge.
  // This is a separate query (not derived from the list) because:
  //   1. It's much cheaper — just a COUNT, no data transfer
  //   2. It's polled/invalidated more frequently than the full list
  //   3. The badge is always visible, but the list only when opened
  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    const count = await db.notification.count({
      where: {
        userId: ctx.user.id,
        read: false,
      },
    });

    return { count };
  }),

  // ─── LIST NOTIFICATIONS ───
  // Returns a paginated list of notifications, unread first, then by date.
  // Uses cursor-based pagination for consistency (see explanation above).
  list: protectedProcedure
    .input(
      z.object({
        cursor: z.string().optional(), // ID of the last notification from previous page
        limit: z.number().min(1).max(50).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const { cursor, limit } = input;

      const notifications = await db.notification.findMany({
        where: { userId: ctx.user.id },
        orderBy: [
          { read: "asc" }, // Unread first (false < true in boolean sort)
          { createdAt: "desc" }, // Newest first within each group
        ],
        take: limit + 1, // Fetch one extra to know if there's a next page
        ...(cursor
          ? {
              cursor: { id: cursor },
              skip: 1, // Skip the cursor item itself (already seen)
            }
          : {}),
      });

      // If we got more items than `limit`, there's a next page.
      // Pop the extra item and use its ID as the next cursor.
      let nextCursor: string | undefined;
      if (notifications.length > limit) {
        const nextItem = notifications.pop()!;
        nextCursor = nextItem.id;
      }

      return { notifications, nextCursor };
    }),

  // ─── MARK READ ───
  // Mark a single notification as read.
  // The frontend calls this when the user clicks a notification.
  markRead: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Verify the notification belongs to this user
      const notification = await db.notification.findUnique({
        where: { id: input.id },
      });

      if (!notification || notification.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Notification not found",
        });
      }

      await db.notification.update({
        where: { id: input.id },
        data: { read: true },
      });

      // Emit to sync across tabs
      emitNotificationRead(ctx.user.id);

      return { success: true };
    }),

  // ─── MARK ALL READ ───
  // Mark all unread notifications as read (the "Mark all as read" button).
  // Uses updateMany for efficiency — one SQL UPDATE instead of N.
  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    await db.notification.updateMany({
      where: {
        userId: ctx.user.id,
        read: false,
      },
      data: { read: true },
    });

    // Emit to sync across tabs
    emitNotificationRead(ctx.user.id);

    return { success: true };
  }),
});
