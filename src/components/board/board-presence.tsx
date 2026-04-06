"use client";

import type { PresenceUser } from "@/hooks/use-socket";

// ──────────────────────────────────────────────
// BoardPresence — "Who's viewing this board" avatars
// ──────────────────────────────────────────────
// Shows a row of avatar circles for users currently viewing the board.
// This is similar to Google Docs' avatar row — it lets team members
// know who's actively looking at the same board.
//
// HOW IT WORKS:
// The useSocket hook receives "board:presence" events from the server
// whenever someone joins or leaves the board room. It passes the user
// list here as props. The server deduplicates by userId, so opening
// two tabs only shows one avatar.
//
// DESIGN:
// - Shows up to 4 avatars, then "+N more" for overflow
// - Each avatar is a colored circle with the user's initial
// - Tooltip on hover shows the full name
// - Excludes the current user (you don't need to see yourself)

interface BoardPresenceProps {
  users: PresenceUser[];
  currentUserId: string;
}

export function BoardPresence({ users, currentUserId }: BoardPresenceProps) {
  // Filter out the current user — you already know you're here
  const otherUsers = users.filter((u) => u.id !== currentUserId);

  if (otherUsers.length === 0) return null;

  const maxVisible = 4;
  const visible = otherUsers.slice(0, maxVisible);
  const overflow = otherUsers.length - maxVisible;

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-muted-foreground mr-1">Viewing:</span>
      <div className="flex -space-x-2">
        {visible.map((user) => (
          <div
            key={user.id}
            title={user.name}
            className="relative flex h-7 w-7 items-center justify-center rounded-full border-2 border-background text-xs font-medium text-white"
            style={{
              backgroundColor: stringToColor(user.name),
            }}
          >
            {getInitial(user.name)}
          </div>
        ))}
        {overflow > 0 && (
          <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-background bg-muted text-xs font-medium text-muted-foreground">
            +{overflow}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Helpers ───

// Get the first character of a name for the avatar
function getInitial(name: string): string {
  return name.charAt(0).toUpperCase();
}

// Generate a consistent color from a string.
// Same name always → same color (deterministic hash).
// This is like Java's hashCode() but we map it to HSL color space.
function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  // Use HSL with fixed saturation (60%) and lightness (45%) for readable text
  const hue = ((hash % 360) + 360) % 360;
  return `hsl(${hue}, 60%, 45%)`;
}
