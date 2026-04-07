"use client";

import { useNotificationSocket } from "@/hooks/use-notification-socket";

// ──────────────────────────────────────────────
// NotificationSocketProvider — Socket.io Wrapper
// ──────────────────────────────────────────────
// A thin Client Component that activates the notification socket hook
// and renders its children unchanged.
//
// WHY IS THIS NEEDED?
// The dashboard layout (`(dashboard)/layout.tsx`) is a Server Component.
// React hooks (like useNotificationSocket) can only run in Client Components.
// This wrapper bridges the gap:
//
//   Server Component (layout.tsx)
//     └─ Client Component (NotificationSocketProvider) ← activates the hook
//         └─ Server Component (page content) ← rendered as children
//
// It's a common Next.js pattern: a "provider" Client Component that
// wraps server-rendered content to add client-side behavior (state,
// effects, context, etc.).

export function NotificationSocketProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  useNotificationSocket();
  return <>{children}</>;
}
