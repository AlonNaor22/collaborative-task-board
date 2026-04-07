"use client";

import { Mail, UserPlus, AtSign, Clock } from "lucide-react";
import type { NotificationType } from "@/generated/prisma/client";

// ──────────────────────────────────────────────
// NotificationItem — Single Notification Row
// ──────────────────────────────────────────────
// A presentational component that renders one notification in the bell dropdown.
// Think of it like a single row in GitHub's notification list:
//   [icon] [title + message]    [time ago]
//
// The icon changes based on the notification type, and unread notifications
// have a highlighted background to draw attention.

// ─── Type-to-Icon Mapping ───
// Each notification type gets a unique icon and color so the user
// can quickly scan and identify what happened without reading the text.
const typeConfig: Record<
  NotificationType,
  { icon: typeof Mail; color: string }
> = {
  INVITATION: { icon: Mail, color: "text-blue-500" },
  ASSIGNMENT: { icon: UserPlus, color: "text-green-500" },
  MENTION: { icon: AtSign, color: "text-purple-500" },
  DUE_DATE: { icon: Clock, color: "text-orange-500" },
};

// ─── Relative Time Formatter ───
// Turns a Date into a human-readable string like "2m ago", "3h ago", "5d ago".
// We do this manually instead of using a library (date-fns, dayjs) to avoid
// adding a dependency for one simple function.
function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

interface NotificationItemProps {
  notification: {
    id: string;
    type: NotificationType;
    title: string;
    message: string;
    read: boolean;
    linkUrl: string | null;
    createdAt: Date;
  };
  onClick: () => void;
}

export function NotificationItem({
  notification,
  onClick,
}: NotificationItemProps) {
  const { icon: Icon, color } = typeConfig[notification.type];

  return (
    <button
      onClick={onClick}
      className={`flex w-full items-start gap-3 rounded-md px-3 py-2.5 text-left transition-colors hover:bg-accent ${
        !notification.read ? "bg-accent/50" : ""
      }`}
    >
      {/* ─── Icon ─── */}
      <div className={`mt-0.5 flex-shrink-0 ${color}`}>
        <Icon className="h-4 w-4" />
      </div>

      {/* ─── Content ─── */}
      <div className="min-w-0 flex-1">
        <p
          className={`text-sm leading-tight ${
            !notification.read ? "font-medium" : "text-muted-foreground"
          }`}
        >
          {notification.title}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
          {notification.message}
        </p>
      </div>

      {/* ─── Time + Unread Dot ─── */}
      <div className="flex flex-shrink-0 items-center gap-1.5">
        <span className="text-[11px] text-muted-foreground">
          {timeAgo(new Date(notification.createdAt))}
        </span>
        {!notification.read && (
          <div className="h-2 w-2 rounded-full bg-blue-500" />
        )}
      </div>
    </button>
  );
}
