"use client";

import type { ConnectionStatus } from "@/hooks/use-socket";
import { Wifi, WifiOff, Loader2 } from "lucide-react";

// ──────────────────────────────────────────────
// ConnectionStatus — WebSocket connection indicator
// ──────────────────────────────────────────────
// A small badge that shows the current state of the WebSocket connection:
//   - Connected (green) — real-time sync is active
//   - Reconnecting (yellow/animated) — connection dropped, trying to reconnect
//   - Disconnected (red) — no connection, changes won't sync
//
// WHY SHOW THIS?
// In a collaborative app, users need to know if their changes are syncing.
// If the connection drops and someone else moves a card, you'd miss it.
// This indicator makes the connection state transparent.
//
// DESIGN:
// - Subtle by default (small, muted colors)
// - Only draws attention when there's a problem (yellow/red)
// - Uses common icons (Wifi) that users universally understand

interface ConnectionStatusProps {
  status: ConnectionStatus;
}

export function ConnectionStatusIndicator({ status }: ConnectionStatusProps) {
  if (status === "connected") {
    return (
      <div className="flex items-center gap-1.5 text-xs text-emerald-600">
        <Wifi className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Live</span>
      </div>
    );
  }

  if (status === "reconnecting") {
    return (
      <div className="flex items-center gap-1.5 text-xs text-amber-600">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        <span className="hidden sm:inline">Reconnecting...</span>
      </div>
    );
  }

  // Disconnected
  return (
    <div className="flex items-center gap-1.5 text-xs text-red-500">
      <WifiOff className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">Offline</span>
    </div>
  );
}
