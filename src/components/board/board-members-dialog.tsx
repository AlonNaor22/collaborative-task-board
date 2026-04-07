"use client";

import { useState } from "react";
import { Users, Crown, Shield, User, X, Clock } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";

// ──────────────────────────────────────────────
// BoardMembersDialog — Member Management Panel
// ──────────────────────────────────────────────
// Shows all board members with their roles and provides management
// actions for the OWNER (change roles, remove members).
//
// Also shows pending invitations at the bottom so admins can see
// who's been invited but hasn't responded yet.
//
// AUTHORIZATION IN THE UI:
// We use `currentUserRole` to conditionally show/hide management controls.
// But the REAL authorization happens server-side in the tRPC routers —
// the UI just hides buttons that would result in FORBIDDEN errors.
// This is defense in depth: UI hides + server enforces.

// ─── Role Icon Map ───
const roleIcons = {
  OWNER: Crown,
  ADMIN: Shield,
  MEMBER: User,
} as const;

const roleColors = {
  OWNER: "text-amber-500",
  ADMIN: "text-blue-500",
  MEMBER: "text-muted-foreground",
} as const;

function getInitials(name?: string | null): string {
  if (!name) return "U";
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

interface BoardMembersDialogProps {
  boardId: string;
  currentUserRole: string;
}

export function BoardMembersDialog({
  boardId,
  currentUserRole,
}: BoardMembersDialogProps) {
  const [open, setOpen] = useState(false);
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // ─── Queries ───
  // Fetch board data (includes members) when dialog is open
  const { data: board } = useQuery({
    ...trpc.board.getById.queryOptions({ id: boardId }),
    enabled: open,
  });

  // Fetch pending invitations (only OWNER/ADMIN)
  const { data: pendingInvitations } = useQuery({
    ...trpc.invitation.listByBoard.queryOptions({ boardId }),
    enabled: open && (currentUserRole === "OWNER" || currentUserRole === "ADMIN"),
  });

  // ─── Mutations ───
  const changeRole = useMutation(
    trpc.board.changeRole.mutationOptions({
      onSuccess: () => {
        toast.success("Role updated");
        queryClient.invalidateQueries({
          queryKey: trpc.board.getById.queryOptions({ id: boardId }).queryKey,
        });
      },
      onError: (err) => toast.error(err.message),
    })
  );

  const removeMember = useMutation(
    trpc.board.removeMember.mutationOptions({
      onSuccess: () => {
        toast.success("Member removed");
        queryClient.invalidateQueries({
          queryKey: trpc.board.getById.queryOptions({ id: boardId }).queryKey,
        });
      },
      onError: (err) => toast.error(err.message),
    })
  );

  const members = board?.members ?? [];
  const isOwner = currentUserRole === "OWNER";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-input bg-background px-3 text-sm font-medium shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground h-8">
        <Users className="h-4 w-4" />
        Members
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Board Members</DialogTitle>
          <DialogDescription>
            {members.length} member{members.length !== 1 ? "s" : ""} on this board
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-96">
          {/* ─── Member List ─── */}
          <div className="space-y-1">
            {members.map((member) => {
              const RoleIcon = roleIcons[member.role as keyof typeof roleIcons] ?? User;
              const roleColor = roleColors[member.role as keyof typeof roleColors] ?? "text-muted-foreground";

              return (
                <div
                  key={member.userId}
                  className="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-accent/50"
                >
                  {/* Avatar */}
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary/10 text-xs">
                      {getInitials(member.user.name)}
                    </AvatarFallback>
                  </Avatar>

                  {/* Name + Email */}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-tight truncate">
                      {member.user.name ?? "Unknown"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {member.user.email}
                    </p>
                  </div>

                  {/* Role display/selector */}
                  {isOwner && member.role !== "OWNER" ? (
                    // OWNER can change other members' roles
                    <Select
                      value={member.role}
                      onValueChange={(newRole) =>
                        changeRole.mutate({
                          boardId,
                          userId: member.userId,
                          role: newRole as "ADMIN" | "MEMBER",
                        })
                      }
                    >
                      <SelectTrigger className="w-28 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ADMIN">Admin</SelectItem>
                        <SelectItem value="MEMBER">Member</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    // Non-owners see a read-only role badge
                    <div className={`flex items-center gap-1 text-xs ${roleColor}`}>
                      <RoleIcon className="h-3.5 w-3.5" />
                      {member.role.charAt(0) + member.role.slice(1).toLowerCase()}
                    </div>
                  )}

                  {/* Remove button — OWNER can remove anyone except themselves */}
                  {isOwner && member.role !== "OWNER" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() =>
                        removeMember.mutate({
                          boardId,
                          userId: member.userId,
                        })
                      }
                      disabled={removeMember.isPending}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>

          {/* ─── Pending Invitations Section ─── */}
          {pendingInvitations && pendingInvitations.length > 0 && (
            <>
              <Separator className="my-3" />
              <div className="px-3 pb-1">
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Pending Invitations
                </p>
                {pendingInvitations.map((inv) => (
                  <div
                    key={inv.id}
                    className="flex items-center gap-3 rounded-md px-3 py-2 opacity-60"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-muted text-xs">
                        {getInitials(inv.invitee.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-tight truncate">
                        {inv.invitee.name ?? "Unknown"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {inv.invitee.email}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      Pending
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
