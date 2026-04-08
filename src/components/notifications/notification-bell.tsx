"use client";

import { useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useTRPC } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { NotificationItem } from "./notification-item";

// ──────────────────────────────────────────────
// NotificationBell — Navbar Notification Icon
// ──────────────────────────────────────────────
// This component renders a bell icon with an unread badge in the navbar.
// Clicking it opens a Popover dropdown showing recent notifications.
//
// WHY POPOVER (not Dialog)?
// A Dialog is a modal — it blocks interaction with the rest of the page
// and has an overlay. The notification dropdown should be lightweight:
// click the bell, scan notifications, click one to navigate, or close
// by clicking elsewhere. Popover is perfect for this.
//
// DATA FLOW:
//   1. `notification.unreadCount` query → powers the badge number
//   2. `notification.list` query → powers the dropdown list
//   3. `notification.markRead` mutation → called on notification click
//   4. `notification.markAllRead` mutation → "Mark all read" button
//
// Both queries are also invalidated by `useNotificationSocket` when
// real-time events arrive, keeping the badge always up-to-date.

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();

  // ─── Queries ───
  const { data: unreadData } = useQuery(
    trpc.notification.unreadCount.queryOptions()
  );
  const unreadCount = unreadData?.count ?? 0;

  // Only fetch the list when the popover is open (lazy loading).
  // This avoids unnecessary queries when the bell is just sitting there.
  const { data: listData, isLoading: isListLoading } = useQuery({
    ...trpc.notification.list.queryOptions({ limit: 20 }),
    enabled: open,
  });
  const notifications = listData?.notifications ?? [];

  // ─── Mutations ───
  const markRead = useMutation(
    trpc.notification.markRead.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.notification.unreadCount.queryOptions().queryKey,
        });
        queryClient.invalidateQueries({
          queryKey: trpc.notification.list.queryKey(),
        });
      },
    })
  );

  const markAllRead = useMutation(
    trpc.notification.markAllRead.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.notification.unreadCount.queryOptions().queryKey,
        });
        queryClient.invalidateQueries({
          queryKey: trpc.notification.list.queryKey(),
        });
      },
    })
  );

  // ─── Handlers ───
  function handleNotificationClick(notification: {
    id: string;
    read: boolean;
    linkUrl: string | null;
  }) {
    // Mark as read if unread
    if (!notification.read) {
      markRead.mutate({ id: notification.id });
    }
    // Navigate to the linked page
    if (notification.linkUrl) {
      setOpen(false);
      router.push(notification.linkUrl);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground">
        <Bell className="h-5 w-5" />
        {/* ─── Unread Badge ───
          Shows a red circle with the count when there are unread notifications.
          "9+" for double digits to keep the badge small.
          The badge uses absolute positioning to float above the bell icon.
        */}
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 p-0">
        {/* ─── Header ─── */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="text-sm font-semibold">Notifications</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto px-2 py-1 text-xs"
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
            >
              <CheckCheck className="mr-1 h-3 w-3" />
              Mark all read
            </Button>
          )}
        </div>

        {/* ─── Notification List ─── */}
        <ScrollArea className="max-h-80">
          {isListLoading ? (
            // Skeleton loading state — pulsing rows that match NotificationItem layout
            <div className="p-1 space-y-1">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-start gap-3 px-3 py-2.5">
                  <div className="mt-0.5 h-4 w-4 animate-pulse rounded bg-muted" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3.5 w-3/4 animate-pulse rounded bg-muted" />
                    <div className="h-3 w-full animate-pulse rounded bg-muted" />
                  </div>
                  <div className="h-3 w-10 animate-pulse rounded bg-muted" />
                </div>
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Bell className="mb-2 h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                No notifications yet
              </p>
            </div>
          ) : (
            <div className="p-1">
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onClick={() => handleNotificationClick(notification)}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
