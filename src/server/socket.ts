import { Server as SocketIOServer } from "socket.io";
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  SocketData,
} from "@/lib/socket-events";

// ──────────────────────────────────────────────
// Socket.io Server Singleton
// ──────────────────────────────────────────────
// This module stores a reference to the Socket.io server instance so that
// other parts of the codebase (especially tRPC routers) can emit events
// without needing to pass the `io` object around manually.
//
// WHY a singleton?
// Same reason as the Prisma singleton (db.ts). The Socket.io server is
// created once in server.ts and stored here. tRPC routers import `getIO()`
// to broadcast events. Without this, we'd need to thread `io` through
// the tRPC context → every procedure → every helper function. Messy.
//
// Think of it like a static class variable in Java:
//   public class SocketManager {
//     private static Server io;
//     public static void setIO(Server io) { ... }
//     public static Server getIO() { ... }
//   }

// ─── Type alias for our fully-typed Socket.io server ───
// The generics enforce that all .emit() calls match our event definitions.
// If you try to emit an event that doesn't exist, TypeScript errors.
export type TypedSocketServer = SocketIOServer<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>, // inter-server events (unused)
  SocketData
>;

// ─── The singleton reference ───
let io: TypedSocketServer | null = null;

// Called once from server.ts after creating the Socket.io server.
export function setIO(server: TypedSocketServer) {
  io = server;
}

// Called from tRPC routers to emit events.
// Returns null if Socket.io isn't initialized yet (e.g., during build time
// when Next.js pre-renders pages — no server running).
export function getIO(): TypedSocketServer | null {
  return io;
}

// ─── Helper: Broadcast to a board room ───
// Emits a "board:updated" event to all sockets in the given board's room.
// This is the most common broadcast — called after any mutation that changes
// columns, cards, labels, assignees, etc.
//
// WHY a helper instead of calling getIO().to(...).emit() directly?
// 1. DRY — every router would repeat the same null-check + room name
// 2. The room name pattern ("board:<id>") is defined in one place
// 3. Easy to add logging or metrics later
export function emitBoardUpdate(boardId: string) {
  const server = getIO();
  if (!server) return; // Socket.io not running (build time, tests, etc.)

  server.to(`board:${boardId}`).emit("board:updated", { boardId });
}

// Helper: Broadcast a comment change to a board room.
export function emitCommentUpdate(boardId: string, cardId: string) {
  const server = getIO();
  if (!server) return;

  server.to(`board:${boardId}`).emit("board:comment", { boardId, cardId });
}

// Helper: Broadcast an activity log update to a board room.
export function emitActivityUpdate(boardId: string) {
  const server = getIO();
  if (!server) return;

  server.to(`board:${boardId}`).emit("board:activity", { boardId });
}

// ─── Phase 7: Notification Emit Helpers ───
// These target USER rooms ("user:<userId>") instead of board rooms.
// User rooms are auto-joined when the socket connects (see server.ts),
// so the user receives these no matter what page they're on.

// Helper: Tell a user they have a new notification.
// The client invalidates notification queries → badge updates, list refreshes.
export function emitNotification(userId: string) {
  const server = getIO();
  if (!server) return;

  server.to(`user:${userId}`).emit("notification:new", { userId });
}

// Helper: Tell a user their notification was marked as read.
// Syncs across multiple browser tabs — read in one, badge updates in all.
export function emitNotificationRead(userId: string) {
  const server = getIO();
  if (!server) return;

  server.to(`user:${userId}`).emit("notification:read", { userId });
}
