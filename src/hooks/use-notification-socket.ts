"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { getSocket } from "@/lib/socket-client";

// ──────────────────────────────────────────────
// useNotificationSocket — App-Wide Notification Listener
// ──────────────────────────────────────────────
// This hook listens for notification events on the user's Socket.io room
// and invalidates TanStack Query caches so the UI updates in real-time.
//
// HOW IT DIFFERS FROM useSocket:
// - useSocket is BOARD-SCOPED — it mounts on the board detail page,
//   joins/leaves board rooms, and handles board-specific events.
// - useNotificationSocket is APP-WIDE — it mounts in the dashboard layout
//   (via NotificationSocketProvider) and stays active across all pages.
//
// The user room ("user:<userId>") is auto-joined by the server on connection
// (see server.ts), so this hook doesn't need to emit any join events.
// It just listens for incoming notification signals and invalidates queries.
//
// WHY SEPARATE FROM useSocket?
// The notification bell is in the navbar, which is visible on ALL authenticated
// pages — not just the board detail page. If we put notification logic in
// useSocket, it would only work when viewing a specific board.

export function useNotificationSocket() {
  const queryClient = useQueryClient();
  const trpc = useTRPC();

  useEffect(() => {
    const socket = getSocket();

    // Derive query keys from tRPC — same pattern as useSocket.
    // These keys tell TanStack Query which cached data to invalidate.
    const unreadCountKey = trpc.notification.unreadCount.queryOptions().queryKey;
    const listKey = trpc.notification.list.queryKey();

    // When a new notification arrives, refetch both the count and the list.
    function onNotificationNew() {
      queryClient.invalidateQueries({ queryKey: unreadCountKey });
      queryClient.invalidateQueries({ queryKey: listKey });
    }

    // When notifications are marked as read (possibly from another tab),
    // refetch to keep the badge and list in sync.
    function onNotificationRead() {
      queryClient.invalidateQueries({ queryKey: unreadCountKey });
      queryClient.invalidateQueries({ queryKey: listKey });
    }

    socket.on("notification:new", onNotificationNew);
    socket.on("notification:read", onNotificationRead);

    // Ensure the socket is connected (it might already be if useSocket ran first)
    if (!socket.connected) {
      socket.connect();
    }

    return () => {
      socket.off("notification:new", onNotificationNew);
      socket.off("notification:read", onNotificationRead);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
