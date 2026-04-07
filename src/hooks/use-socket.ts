"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { getSocket } from "@/lib/socket-client";

// ──────────────────────────────────────────────
// useSocket — Board-Scoped Socket.io Hook
// ──────────────────────────────────────────────
// This hook manages the board-specific WebSocket lifecycle:
//   1. Joins a board room to receive board-specific events
//   2. Listens for server events and invalidates TanStack Query caches
//   3. Tracks connection status (connected/disconnected/reconnecting)
//   4. Tracks user presence (who else is viewing this board)
//   5. Cleans up on unmount (leaves room, removes listeners)
//
// WHY A HOOK?
// The socket connection is tied to the component lifecycle — when the user
// navigates to a board page, we connect; when they leave, we disconnect.
// A React hook is the natural way to express this "mount → do stuff → cleanup"
// pattern. It's like Java's try-with-resources: automatic cleanup on exit.
//
// SOCKET SINGLETON:
// The actual socket lives in `src/lib/socket-client.ts` — a shared module
// that both this hook and `useNotificationSocket` import from. This ensures
// one connection per user, shared across all hooks (Phase 7 refactor).

// Connection status type
export type ConnectionStatus = "connected" | "disconnected" | "reconnecting";

// Presence user type
export interface PresenceUser {
  id: string;
  name: string;
  image: string | null;
}

interface UseSocketOptions {
  boardId: string;
}

export function useSocket({ boardId }: UseSocketOptions) {
  const queryClient = useQueryClient();
  const trpc = useTRPC();

  // ─── State ───
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [presenceUsers, setPresenceUsers] = useState<PresenceUser[]>([]);

  // Track the current boardId in a ref so event handlers always see the latest value.
  // Without this, closures would capture a stale boardId.
  const boardIdRef = useRef(boardId);
  boardIdRef.current = boardId;

  // ─── Derive query keys from tRPC ───
  // We need these to tell TanStack Query WHICH cached data to invalidate
  // when a socket event arrives. tRPC structures keys internally, so we
  // must get them from queryOptions() rather than hardcoding.
  const columnListKey = trpc.column.list.queryOptions({ boardId }).queryKey;
  const activityListKey = trpc.activity.listByBoard.queryOptions({ boardId }).queryKey;

  // ─── Socket Connection ───
  useEffect(() => {
    // Get the shared socket singleton from socket-client.ts.
    // This is the same instance used by useNotificationSocket.
    const socket = getSocket();

    // ─── Connection Status Handlers ───
    function onConnect() {
      setStatus("connected");
      // (Re-)join the board room after (re)connecting
      socket.emit("board:join", { boardId: boardIdRef.current });
    }

    function onDisconnect() {
      setStatus("disconnected");
      setPresenceUsers([]); // Clear presence on disconnect
    }

    function onReconnectAttempt() {
      setStatus("reconnecting");
    }

    // ─── Board Event Handlers ───
    // When the server broadcasts a change, we DON'T receive the new data
    // in the event payload. Instead, we invalidate the relevant TanStack Query
    // cache, which triggers a refetch. This keeps things simple and consistent.
    //
    // Think of it like a newspaper subscription: the event is "new edition published",
    // not the actual newspaper. You still go to the newsstand (tRPC) to pick it up.

    function onBoardUpdated(data: { boardId: string }) {
      if (data.boardId === boardIdRef.current) {
        queryClient.invalidateQueries({ queryKey: columnListKey });
      }
    }

    function onBoardComment(data: { boardId: string; cardId: string }) {
      if (data.boardId === boardIdRef.current) {
        // Invalidate both the comment list for this card AND the column list
        // (because card previews might show comment count)
        const commentListKey = trpc.comment.list.queryOptions({ cardId: data.cardId }).queryKey;
        queryClient.invalidateQueries({ queryKey: commentListKey });
      }
    }

    function onBoardActivity(data: { boardId: string }) {
      if (data.boardId === boardIdRef.current) {
        queryClient.invalidateQueries({ queryKey: activityListKey });
      }
    }

    function onBoardPresence(data: {
      boardId: string;
      users: PresenceUser[];
    }) {
      if (data.boardId === boardIdRef.current) {
        setPresenceUsers(data.users);
      }
    }

    // ─── Register Listeners ───
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.io.on("reconnect_attempt", onReconnectAttempt);

    socket.on("board:updated", onBoardUpdated);
    socket.on("board:comment", onBoardComment);
    socket.on("board:activity", onBoardActivity);
    socket.on("board:presence", onBoardPresence);

    // If already connected (e.g., component remounting), join immediately
    if (socket.connected) {
      setStatus("connected");
      socket.emit("board:join", { boardId });
    } else {
      socket.connect();
    }

    // ─── Cleanup ───
    // When the component unmounts (user navigates away from the board),
    // we leave the room and remove listeners.
    // We DON'T disconnect the socket — it can be reused if the user
    // navigates to another board.
    return () => {
      socket.emit("board:leave", { boardId });

      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.io.off("reconnect_attempt", onReconnectAttempt);

      socket.off("board:updated", onBoardUpdated);
      socket.off("board:comment", onBoardComment);
      socket.off("board:activity", onBoardActivity);
      socket.off("board:presence", onBoardPresence);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId]);

  return {
    status,
    presenceUsers,
  };
}
