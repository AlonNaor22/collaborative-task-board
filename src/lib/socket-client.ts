import { io, type Socket } from "socket.io-client";
import type {
  ServerToClientEvents,
  ClientToServerEvents,
} from "./socket-events";

// ──────────────────────────────────────────────
// Socket.io Client Singleton
// ──────────────────────────────────────────────
// This module provides a single, shared Socket.io connection for the
// entire frontend. Both `useSocket` (board-scoped) and
// `useNotificationSocket` (app-wide) import from here.
//
// WHY EXTRACT THIS?
// Before Phase 7, the socket singleton lived inside `use-socket.ts`.
// But now we need two hooks sharing the SAME connection:
//   1. useSocket — joins board rooms, handles board events
//   2. useNotificationSocket — handles notification events (on user rooms)
//
// If each hook created its own socket, we'd have TWO connections to the
// server for the same user — wasteful and confusing (duplicate events,
// double authentication, etc.). By extracting the singleton here, both
// hooks share one connection, one auth handshake, one reconnect cycle.
//
// Think of it like a shared database connection pool in backend code.

export type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socketInstance: TypedSocket | null = null;

// Get or create the socket instance. Called by both hooks.
// The socket is created on first call and reused thereafter.
export function getSocket(): TypedSocket {
  if (!socketInstance) {
    socketInstance = io({
      // No URL — connects to the same host:port as the page.
      withCredentials: true, // Send session cookie for authentication
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
    });
  }
  return socketInstance;
}
