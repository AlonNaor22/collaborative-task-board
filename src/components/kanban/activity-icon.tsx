import {
  Plus,
  MoveRight,
  Tag,
  UserPlus,
  UserMinus,
  Calendar,
  MessageSquare,
  Trash2,
  Columns,
  Layout,
  Activity,
} from "lucide-react";

// ──────────────────────────────────────────────
// ActivityIcon
// ──────────────────────────────────────────────
// Maps an activity action string to a Lucide icon.
// Centralised here so both ActivityPanel and the card modal
// activity section use the same icons.

interface ActivityIconProps {
  action: string;
  className?: string;
}

export function ActivityIcon({ action, className }: ActivityIconProps) {
  const Icon = getIcon(action);
  return <Icon className={className} />;
}

function getIcon(action: string) {
  switch (action) {
    case "created_card":      return Plus;
    case "moved_card":        return MoveRight;
    case "added_label":       return Tag;
    case "removed_label":     return Tag;
    case "added_assignee":    return UserPlus;
    case "removed_assignee":  return UserMinus;
    case "set_due_date":      return Calendar;
    case "created_comment":   return MessageSquare;
    case "deleted_comment":   return Trash2;
    case "created_column":    return Columns;
    case "deleted_column":    return Columns;
    case "created_board":     return Layout;
    default:                  return Activity;
  }
}
