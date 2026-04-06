// ──────────────────────────────────────────────
// Socket.io Event Type Definitions
// ──────────────────────────────────────────────
// These types define the "contract" between the Socket.io server and client.
// Think of them like a TypeScript interface for your API — both sides must
// agree on what events exist and what data they carry.
//
// WHY define these separately?
// Both the server (server.ts) and client (useSocket hook) import these types.
// If you add a new event or change a payload, TypeScript will immediately
// flag everywhere that needs updating. Without this, you'd get silent
// mismatches — the server sends { boardId: string } but the client expects
// { id: string } — and bugs only show up at runtime.
//
// Socket.io uses three type parameters:
// 1. ServerToClientEvents — events the server SENDS, client RECEIVES
// 2. ClientToServerEvents — events the client SENDS, server RECEIVES
// 3. InterServerEvents — events between server instances (for scaling)
//
// We only need #1 and #2 for now.

// ─── Server → Client Events ───
// These events are PUSHED from the server to connected clients.
// The client sets up listeners: socket.on("board:updated", (data) => { ... })
export interface ServerToClientEvents {
  // Board data changed — tells client to refetch columns/cards.
  // We send the boardId so the client knows WHICH query to invalidate.
  // We DON'T send the actual data — TanStack Query handles the refetch.
  //
  // WHY invalidate instead of sending data?
  // 1. Simpler — no need to keep socket payloads in sync with tRPC return types
  // 2. Consistent — the refetch uses the same tRPC query, so data shape is guaranteed
  // 3. Secure — the tRPC query checks membership, so unauthorized users can't
  //    see data even if they somehow receive the event
  "board:updated": (data: { boardId: string }) => void;

  // A comment was added/edited/deleted on a card.
  // The client invalidates the comment list query for that card.
  "board:comment": (data: { boardId: string; cardId: string }) => void;

  // Activity log entry was added.
  // The client invalidates the activity list query.
  "board:activity": (data: { boardId: string }) => void;

  // User presence: someone joined or left the board view.
  // The client updates the "who's viewing" avatars.
  "board:presence": (data: {
    boardId: string;
    users: { id: string; name: string; image: string | null }[];
  }) => void;
}

// ─── Client → Server Events ───
// These events are SENT from the client to the server.
// The client calls: socket.emit("board:join", { boardId: "..." })
export interface ClientToServerEvents {
  // Join a board's Socket.io room to receive its events.
  // Called when the user navigates to /boards/[id].
  "board:join": (data: { boardId: string }) => void;

  // Leave a board's room.
  // Called when the user navigates away from the board page.
  "board:leave": (data: { boardId: string }) => void;
}

// ─── Socket Data (attached to each connection) ───
// When a socket connects, the auth middleware attaches user info.
// This is accessible in event handlers via socket.data.
export interface SocketData {
  userId: string;
  userName: string;
  userImage: string | null;
}
