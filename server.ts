import { createServer } from "http";
import next from "next";
import { Server as SocketIOServer } from "socket.io";
import { setIO, type TypedSocketServer } from "@/server/socket";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  SocketData,
} from "@/lib/socket-events";

// ──────────────────────────────────────────────
// Custom Server: Next.js + Socket.io
// ──────────────────────────────────────────────
// Normally, `next dev` or `next start` runs a built-in HTTP server that
// handles page requests and API routes. But we need WebSockets too, and
// the built-in server doesn't support them.
//
// SOLUTION: Create our own HTTP server and attach BOTH Next.js and Socket.io:
//
//   HTTP server (port 3000)
//   ├── Next.js (handles all regular requests: pages, API, static files)
//   └── Socket.io (handles WebSocket upgrade requests)
//
// HOW IT WORKS:
// 1. We create a raw Node.js HTTP server
// 2. We let Next.js handle all normal HTTP requests (req, res)
// 3. Socket.io intercepts WebSocket "upgrade" requests on the same port
// 4. Both coexist — regular HTTP and persistent WebSocket connections
//
// Think of the HTTP server as a building, and Next.js and Socket.io as
// two tenants. HTTP requests go to Next.js's floor; WebSocket upgrades
// go to Socket.io's floor. The building (port) is shared.

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

async function main() {
  // ─── Step 1: Initialize Next.js ───
  // `next()` creates the Next.js application instance.
  // In dev mode, it enables hot reload, error overlay, etc.
  // `prepare()` compiles pages and sets up the dev server.
  const app = next({ dev, hostname, port });
  const handler = app.getRequestHandler();

  await app.prepare();

  // ─── Step 2: Create HTTP Server ───
  // This is a raw Node.js HTTP server. All incoming requests go through
  // this handler. We forward everything to Next.js's request handler,
  // which knows how to route pages, API calls, and static files.
  const httpServer = createServer((req, res) => {
    handler(req, res);
  });

  // ─── Step 3: Attach Socket.io ───
  // Socket.io piggybacks on the HTTP server. When a browser sends a
  // WebSocket "upgrade" request (HTTP → persistent connection), Socket.io
  // intercepts it. Regular HTTP requests pass through to Next.js untouched.
  //
  // `cors: { origin: "*" }` allows connections from any origin in development.
  // In production, you'd restrict this to your domain.
  //
  // The generic parameters enforce type safety on all socket events.
  const io: TypedSocketServer = new SocketIOServer<
    ClientToServerEvents,
    ServerToClientEvents,
    Record<string, never>,
    SocketData
  >(httpServer, {
    cors: {
      origin: dev ? "*" : false, // In production, same-origin only
    },
    // Socket.io transport options:
    // "polling" = HTTP long-polling (fallback, works everywhere)
    // "websocket" = true WebSocket (better performance)
    // Socket.io tries WebSocket first, falls back to polling if blocked.
    transports: ["websocket", "polling"],
  });

  // ─── Step 4: Store the IO instance ───
  // Save it to the singleton so tRPC routers can access it via getIO().
  setIO(io);

  // ─── Step 5: Auth Middleware ───
  // Runs ONCE when a socket first connects (the handshake).
  // We validate the user's session before accepting the connection.
  //
  // HOW?
  // The client sends its session cookie with the WebSocket handshake.
  // We use Next.js's auth() function to validate it — same function
  // used in tRPC context. If invalid, we reject the connection.
  //
  // NOTE: We dynamically import auth() to avoid module resolution
  // issues at startup. The `@/server/auth` module uses Prisma, which
  // might not be ready when server.ts first loads.
  io.use(async (socket, nextFn) => {
    try {
      // Extract cookies from the handshake headers.
      // When the browser opens a WebSocket, it sends cookies just like
      // a regular HTTP request. We parse them to find the session token.
      const cookieHeader = socket.handshake.headers.cookie;
      if (!cookieHeader) {
        return nextFn(new Error("No session cookie"));
      }

      // Dynamically import auth to get the session validator.
      // We use the same decode function Auth.js provides.
      const { auth } = await import("@/server/auth");

      // Auth.js v5 can decode a session from cookies.
      // We create a minimal request-like object with the cookie header.
      // NOTE: In Auth.js v5 with JWT strategy, the session is in an
      // encrypted cookie. auth() decodes it automatically.
      //
      // We use a workaround: call auth() from a mock request context.
      // This approach reads the cookie from the global headers context.
      // In the socket middleware, we need a different approach — we'll
      // decode the JWT directly from the cookie.
      const { decode } = await import("next-auth/jwt");

      // Parse cookies to find the session token
      const cookies = Object.fromEntries(
        cookieHeader.split(";").map((c) => {
          const [key, ...vals] = c.trim().split("=");
          return [key, vals.join("=")];
        })
      );

      // Auth.js v5 stores the JWT in a cookie named:
      //   - "authjs.session-token" (production, secure cookies)
      //   - "__Secure-authjs.session-token" (HTTPS production)
      // In development, it's "authjs.session-token"
      const tokenCookieName = dev
        ? "authjs.session-token"
        : "__Secure-authjs.session-token";

      const token = cookies[tokenCookieName];
      if (!token) {
        return nextFn(new Error("No session token in cookies"));
      }

      // Decode the JWT using Auth.js's secret
      const decoded = await decode({
        token,
        secret: process.env.AUTH_SECRET!,
        salt: tokenCookieName,
      });

      if (!decoded?.sub) {
        return nextFn(new Error("Invalid session token"));
      }

      // Attach user info to the socket for use in event handlers.
      // socket.data persists for the lifetime of the connection.
      socket.data.userId = decoded.sub;
      socket.data.userName = (decoded.name as string) ?? "Anonymous";
      socket.data.userImage = (decoded.picture as string) ?? null;

      nextFn();
    } catch (err) {
      console.error("[Socket.io] Auth error:", err);
      nextFn(new Error("Authentication failed"));
    }
  });

  // ─── Step 6: Connection Handler ───
  // Runs when an authenticated socket successfully connects.
  io.on("connection", (socket) => {
    console.log(
      `[Socket.io] User connected: ${socket.data.userName} (${socket.data.userId})`
    );

    // ─── Join a board room ───
    // When the client calls socket.emit("board:join", { boardId }),
    // we add this socket to the room "board:<boardId>".
    // Think of rooms like channels — events sent to a room only go to
    // sockets in that room. So board A's events don't bother board B's users.
    socket.on("board:join", async (data) => {
      const room = `board:${data.boardId}`;

      // Leave any other board rooms first (a user can only view one board at a time)
      for (const existingRoom of socket.rooms) {
        if (existingRoom.startsWith("board:") && existingRoom !== room) {
          socket.leave(existingRoom);
        }
      }

      socket.join(room);
      console.log(
        `[Socket.io] ${socket.data.userName} joined room ${room}`
      );

      // Broadcast updated presence to all users in this room
      await broadcastPresence(io, data.boardId);
    });

    // ─── Leave a board room ───
    socket.on("board:leave", async (data) => {
      const room = `board:${data.boardId}`;
      socket.leave(room);
      console.log(
        `[Socket.io] ${socket.data.userName} left room ${room}`
      );

      // Update presence after leaving
      await broadcastPresence(io, data.boardId);
    });

    // ─── Disconnect ───
    // Fires when the WebSocket connection drops (user closes tab, network loss, etc.)
    // Socket.io automatically removes the socket from all rooms, but we need to
    // update presence for any board room they were in.
    socket.on("disconnecting", async () => {
      // socket.rooms includes all rooms this socket was in
      for (const room of socket.rooms) {
        if (room.startsWith("board:")) {
          const boardId = room.replace("board:", "");
          // We need to broadcast after this socket leaves, so use a small delay
          // to let Socket.io remove the socket from rooms first.
          setTimeout(() => broadcastPresence(io, boardId), 100);
        }
      }
      console.log(
        `[Socket.io] User disconnected: ${socket.data.userName}`
      );
    });
  });

  // ─── Step 7: Start Listening ───
  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log(`> Socket.io server attached`);
  });
}

// ──────────────────────────────────────────────
// Presence Broadcaster
// ──────────────────────────────────────────────
// Gets all connected sockets in a board room and broadcasts the user list.
// This is what powers the "who's viewing this board" avatars.
//
// HOW IT WORKS:
// 1. Get all sockets in the room "board:<boardId>"
// 2. Extract unique users (a user might have multiple tabs → multiple sockets)
// 3. Broadcast the user list to the room
async function broadcastPresence(io: TypedSocketServer, boardId: string) {
  const room = `board:${boardId}`;
  const sockets = await io.in(room).fetchSockets();

  // Deduplicate by userId (one entry per person, not per tab)
  const uniqueUsers = new Map<
    string,
    { id: string; name: string; image: string | null }
  >();

  for (const s of sockets) {
    if (s.data.userId && !uniqueUsers.has(s.data.userId)) {
      uniqueUsers.set(s.data.userId, {
        id: s.data.userId,
        name: s.data.userName,
        image: s.data.userImage,
      });
    }
  }

  io.to(room).emit("board:presence", {
    boardId,
    users: Array.from(uniqueUsers.values()),
  });
}

// ─── Start the server ───
main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
