"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ──────────────────────────────────────────────
// InviteBoardDialog — Invite Users to a Board
// ──────────────────────────────────────────────
// Follows the same dialog pattern as CreateBoardDialog:
// controlled open state, form inside DialogContent, mutation via tRPC.
//
// The user types an email address and selects a role (MEMBER or ADMIN).
// On submit, the `invitation.send` procedure handles all the validation
// (user exists, not already a member, no duplicate invite, etc.) and
// returns appropriate error messages.
//
// WHY EMAIL INPUT (not user search dropdown)?
// For a portfolio project, a simple email input is sufficient.
// The user knows who they want to invite. A search dropdown would
// require debounced queries and a combobox component — more complexity
// than the feature warrants. The tRPC router's error messages handle
// edge cases clearly ("No user found with that email address").

interface InviteBoardDialogProps {
  boardId: string;
}

export function InviteBoardDialog({ boardId }: InviteBoardDialogProps) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"MEMBER" | "ADMIN">("MEMBER");
  const [error, setError] = useState("");
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const sendInvite = useMutation(
    trpc.invitation.send.mutationOptions({
      onSuccess: () => {
        toast.success("Invitation sent!");
        setOpen(false);
        setEmail("");
        setRole("MEMBER");
        setError("");
        // Refresh board data (member list) and invitation list
        queryClient.invalidateQueries({
          queryKey: trpc.invitation.listByBoard.queryOptions({ boardId }).queryKey,
        });
      },
      onError: (err) => {
        setError(err.message);
      },
    })
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!email.trim()) {
      setError("Email is required");
      return;
    }

    sendInvite.mutate({
      boardId,
      inviteeEmail: email.trim(),
      role,
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-input bg-background px-3 text-sm font-medium shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground h-8">
        <UserPlus className="h-4 w-4" />
        Invite
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite to Board</DialogTitle>
          <DialogDescription>
            Send an invitation by email. The user must have an account.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* ─── Email Input ─── */}
          <div className="space-y-2">
            <Label htmlFor="invite-email">Email address</Label>
            <Input
              id="invite-email"
              type="email"
              placeholder="user@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={sendInvite.isPending}
            />
          </div>

          {/* ─── Role Select ─── */}
          <div className="space-y-2">
            <Label htmlFor="invite-role">Role</Label>
            <Select
              value={role}
              onValueChange={(v) => setRole(v as "MEMBER" | "ADMIN")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MEMBER">
                  Member — can view and interact with cards
                </SelectItem>
                <SelectItem value="ADMIN">
                  Admin — can also edit board settings and invite others
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* ─── Error Message ─── */}
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={sendInvite.isPending}>
              {sendInvite.isPending ? "Sending..." : "Send Invitation"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
