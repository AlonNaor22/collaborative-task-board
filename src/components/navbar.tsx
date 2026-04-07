"use client";

// ──────────────────────────────────────────────
// Navbar — Top Navigation Bar
// ──────────────────────────────────────────────
// This is a Client Component because it needs interactivity:
// - Dropdown menu (open/close state managed by Base UI under the hood)
// - Sign out button (calls signOut() which triggers a navigation)
//
// HOW IT GETS THE USER DATA:
// The navbar doesn't call auth() itself (that's server-only).
// Instead, the parent layout.tsx (a Server Component) fetches the
// session and passes the user object down as a prop.
// This is a common pattern: Server Component fetches data →
// passes it to Client Component as props.

import { signOut } from "next-auth/react";
import { LogOut, User } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NotificationBell } from "@/components/notifications/notification-bell";

// ─── Props ───
// We only need the user's name and email for display.
// The `?` means these can be undefined (TypeScript optional properties),
// which is safer than assuming they always exist.
interface NavbarProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

// ─── Helper: Get Initials ───
// Turns "John Doe" into "JD" for the avatar fallback.
// If no name, falls back to "U" (for User).
function getInitials(name?: string | null): string {
  if (!name) return "U";
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function Navbar({ user }: NavbarProps) {
  return (
    <nav className="border-b bg-background">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* ─── Left: App Logo/Title ─── */}
        {/*
          This is just text for now. In a real app you might use
          next/link to make it clickable and navigate to /boards.
          The font-semibold + tracking-tight combo is a common
          pattern for app titles — looks clean and professional.
        */}
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold tracking-tight">
            TaskBoard
          </h1>
        </div>

        {/* ─── Right: Notifications + User Dropdown ─── */}
        <div className="flex items-center gap-1">
        {/* Phase 7: Notification bell with unread badge */}
        <NotificationBell />

        {/*
          DropdownMenu is from shadcn/ui (built on Base UI).
          Base UI handles all the accessibility: keyboard navigation,
          focus trapping, ESC to close, click-outside to close.

          The structure is always:
          - DropdownMenu (wrapper, manages open/close state)
            - DropdownMenuTrigger (the button that opens it)
            - DropdownMenuContent (the floating panel)
              - DropdownMenuItem (each clickable option)
        */}
        <DropdownMenu>
          {/*
            DropdownMenuTrigger renders as a <button> by default.
            We style it to look like a circular avatar button.
            No need for "asChild" in Base UI — just put your
            content directly inside the trigger.
          */}
          <DropdownMenuTrigger className="relative flex h-9 w-9 items-center justify-center rounded-full hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Avatar className="h-9 w-9">
              {/*
                AvatarFallback shows when there's no image.
                We use the user's initials as a placeholder.
                The bg-primary text-primary-foreground classes
                give it a colored background with contrasting text.
              */}
              <AvatarFallback className="bg-primary text-primary-foreground">
                {getInitials(user.name)}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-56">
            {/* ─── User Info Section ─── */}
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">
                  {user.name || "User"}
                </p>
                <p className="text-xs leading-none text-muted-foreground">
                  {user.email}
                </p>
              </div>
            </DropdownMenuLabel>

            <DropdownMenuSeparator />

            {/* ─── Profile Link (placeholder for future) ─── */}
            <DropdownMenuItem disabled>
              <User className="mr-2 h-4 w-4" />
              Profile (coming soon)
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            {/* ─── Sign Out ─── */}
            {/*
              signOut() is from next-auth/react (client-side).
              It clears the session cookie and redirects to /login.

              We pass callbackUrl: "/login" to explicitly control
              where the user lands after signing out.

              Why onClick instead of a form? DropdownMenuItem is
              already a button-like element. signOut() handles the
              POST request internally (CSRF-safe).
            */}
            <DropdownMenuItem
              onClick={() => signOut({ callbackUrl: "/login" })}
              variant="destructive"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        </div>
      </div>
    </nav>
  );
}
