"use client";

// ──────────────────────────────────────────────
// Edit Board Dialog
// ──────────────────────────────────────────────
// Lets OWNER and ADMIN users edit board settings (title, description, color).
// Also includes a delete button for the OWNER.
//
// This component receives the current board data as props and
// pre-fills the form. It's opened from a dropdown menu on the
// board card (the "..." button).

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const PRESET_COLORS = [
  { name: "Blue", value: "#3B82F6" },
  { name: "Green", value: "#22C55E" },
  { name: "Purple", value: "#A855F7" },
  { name: "Orange", value: "#F97316" },
  { name: "Pink", value: "#EC4899" },
  { name: "Teal", value: "#14B8A6" },
  { name: "Red", value: "#EF4444" },
  { name: "Yellow", value: "#EAB308" },
];

interface EditBoardDialogProps {
  board: {
    id: string;
    title: string;
    description: string | null;
    color: string;
  };
  isOwner: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditBoardDialog({
  board,
  isOwner,
  open,
  onOpenChange,
}: EditBoardDialogProps) {
  // ─── State ───
  // Pre-fill with current board values
  const [title, setTitle] = useState(board.title);
  const [description, setDescription] = useState(board.description ?? "");
  const [color, setColor] = useState(board.color);
  const [error, setError] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const router = useRouter();
  const queryClient = useQueryClient();
  const trpc = useTRPC();

  // ─── Update Mutation ───
  const updateBoard = useMutation(
    trpc.board.update.mutationOptions({
      onSuccess: () => {
        onOpenChange(false);
        queryClient.invalidateQueries({ queryKey: trpc.board.list.queryKey() });
        router.refresh();
      },
      onError: (err) => {
        setError(err.message);
      },
    })
  );

  // ─── Delete Mutation ───
  const deleteBoard = useMutation(
    trpc.board.delete.mutationOptions({
      onSuccess: () => {
        onOpenChange(false);
        queryClient.invalidateQueries({ queryKey: trpc.board.list.queryKey() });
        router.refresh();
      },
      onError: (err) => {
        setError(err.message);
      },
    })
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!title.trim()) {
      setError("Title is required");
      return;
    }

    updateBoard.mutate({
      id: board.id,
      title: title.trim(),
      description: description.trim() || null,
      color,
    });
  }

  function handleDelete() {
    deleteBoard.mutate({ id: board.id });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {!showDeleteConfirm ? (
          // ─── Edit Form ───
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Edit board</DialogTitle>
              <DialogDescription>
                Update your board&apos;s settings.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-board-title">Title</Label>
                <Input
                  id="edit-board-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-board-description">
                  Description{" "}
                  <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Textarea
                  id="edit-board-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Color</Label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_COLORS.map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      title={preset.name}
                      className={`h-8 w-8 rounded-full transition-all ${
                        color === preset.value
                          ? "ring-2 ring-offset-2 ring-foreground"
                          : "hover:scale-110"
                      }`}
                      style={{ backgroundColor: preset.value }}
                      onClick={() => setColor(preset.value)}
                    />
                  ))}
                </div>
              </div>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
            </div>

            <DialogFooter className="mt-4">
              {/* ─── Delete Button (OWNER only) ───
                Shows a red "Delete" button that switches to a
                confirmation view. We don't delete immediately
                because it's irreversible. */}
              {isOwner && (
                <Button
                  type="button"
                  variant="destructive"
                  className="mr-auto"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  Delete
                </Button>
              )}
              <Button
                type="submit"
                disabled={updateBoard.isPending || !title.trim()}
              >
                {updateBoard.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          // ─── Delete Confirmation ───
          // A separate view inside the same dialog.
          // This is cleaner than opening a second dialog.
          <>
            <DialogHeader>
              <DialogTitle>Delete board?</DialogTitle>
              <DialogDescription>
                This will permanently delete &quot;{board.title}&quot; and all
                its columns, cards, and comments. This action cannot be undone.
              </DialogDescription>
            </DialogHeader>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <DialogFooter className="mt-4">
              <Button
                variant="outline"
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deleteBoard.isPending}
              >
                {deleteBoard.isPending
                  ? "Deleting..."
                  : "Yes, Delete Board"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
