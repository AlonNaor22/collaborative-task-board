"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { toast } from "sonner";
import { Mail, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";

// ──────────────────────────────────────────────
// PendingInvitations — Dashboard Invitation Banner
// ──────────────────────────────────────────────
// Displayed on the boards dashboard page (/boards) above the board grid.
// Shows any pending board invitations for the current user with
// Accept and Decline buttons.
//
// If there are no pending invitations, this component renders nothing
// (returns null) — no empty state needed since the board list fills
// the page anyway.
//
// WHY ON THE DASHBOARD (not a separate page)?
// Invitations are contextually relevant to your boards — you see them
// right where your boards are listed. GitHub does this too: repository
// invitations appear on your dashboard, not on a separate page.

export function PendingInvitations() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const { data: invitations } = useQuery(
    trpc.invitation.listPending.queryOptions()
  );

  const acceptInvite = useMutation(
    trpc.invitation.accept.mutationOptions({
      onSuccess: () => {
        toast.success("Invitation accepted! You can now access the board.");
        // Refresh both the invitation list and the board list
        queryClient.invalidateQueries({
          queryKey: trpc.invitation.listPending.queryOptions().queryKey,
        });
        queryClient.invalidateQueries({
          queryKey: trpc.board.list.queryKey(),
        });
      },
      onError: (err) => toast.error(err.message),
    })
  );

  const declineInvite = useMutation(
    trpc.invitation.decline.mutationOptions({
      onSuccess: () => {
        toast.success("Invitation declined.");
        queryClient.invalidateQueries({
          queryKey: trpc.invitation.listPending.queryOptions().queryKey,
        });
      },
      onError: (err) => toast.error(err.message),
    })
  );

  // Don't render anything if no invitations
  if (!invitations || invitations.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-muted-foreground">
        Pending Invitations
      </h3>

      {invitations.map((inv) => (
        <div
          key={inv.id}
          className="flex items-center gap-4 rounded-lg border bg-card p-4"
        >
          {/* ─── Icon ─── */}
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/10">
            <Mail className="h-5 w-5 text-blue-500" />
          </div>

          {/* ─── Info ─── */}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">
              <span
                className="mr-1.5 inline-block h-3 w-3 rounded-full"
                style={{ backgroundColor: inv.board.color ?? "#6b7280" }}
              />
              {inv.board.title}
            </p>
            <p className="text-xs text-muted-foreground">
              Invited by {inv.inviter.name ?? inv.inviter.email}
            </p>
          </div>

          {/* ─── Actions ─── */}
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => acceptInvite.mutate({ invitationId: inv.id })}
              disabled={acceptInvite.isPending || declineInvite.isPending}
            >
              <Check className="mr-1 h-3.5 w-3.5" />
              Accept
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => declineInvite.mutate({ invitationId: inv.id })}
              disabled={acceptInvite.isPending || declineInvite.isPending}
            >
              <X className="mr-1 h-3.5 w-3.5" />
              Decline
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
