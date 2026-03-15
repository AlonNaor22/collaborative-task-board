"use client";

// ──────────────────────────────────────────────
// Create Board Dialog
// ──────────────────────────────────────────────
// A modal dialog for creating new boards.
// This is a Client Component because it needs:
// 1. useState for form field values
// 2. useMutation from tRPC for the API call
// 3. useRouter for refreshing the page after creation
//
// HOW DIALOGS WORK IN BASE UI:
// The Dialog component manages its own open/close state internally.
// You can also control it externally with the `open` prop.
// We use controlled mode so we can close the dialog after
// successful creation.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { useMutation } from "@tanstack/react-query";
import { Plus } from "lucide-react";
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
  DialogTrigger,
} from "@/components/ui/dialog";

// ─── Preset Colors ───
// Instead of a full color picker (complex to build), we offer
// a set of nice preset colors. This is the same approach Notion
// and Linear use — simpler UX, still visually appealing.
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

export function CreateBoardDialog() {
  // ─── State ───
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0].value);
  const [error, setError] = useState("");

  const router = useRouter();
  const queryClient = useQueryClient();

  // ─── tRPC Mutation ───
  // useMutation is from TanStack Query. It gives us:
  // - mutate(): fire the request
  // - isPending: loading state (to disable button, show spinner)
  // - error: if the request fails
  //
  // The tRPC integration auto-types everything: the input must match
  // createBoardSchema, and the response matches what board.create returns.
  const trpc = useTRPC();
  const createBoard = useMutation(
    trpc.board.create.mutationOptions({
      onSuccess: () => {
        // Close the dialog
        setOpen(false);
        // Reset form fields for next time
        resetForm();
        // Invalidate the board list cache so it refetches.
        // This is TanStack Query's way of saying "this data is stale,
        // fetch it again." The boards page will automatically update.
        queryClient.invalidateQueries({ queryKey: trpc.board.list.queryKey() });
        // Also refresh the server component data
        router.refresh();
      },
      onError: (err) => {
        setError(err.message);
      },
    })
  );

  function resetForm() {
    setTitle("");
    setDescription("");
    setColor(PRESET_COLORS[0].value);
    setError("");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!title.trim()) {
      setError("Title is required");
      return;
    }

    createBoard.mutate({
      title: title.trim(),
      description: description.trim() || undefined,
      color,
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) resetForm();
      }}
    >
      {/* ─── Trigger Button ───
        This is the "Create Board" button visible on the page.
        DialogTrigger automatically opens the dialog when clicked. */}
      <DialogTrigger className="flex h-full min-h-[120px] w-full items-center justify-center gap-2 rounded-lg border border-dashed bg-card text-muted-foreground transition-colors hover:border-primary hover:text-primary">
        <Plus className="h-5 w-5" />
        <span className="font-medium">Create Board</span>
      </DialogTrigger>

      {/* ─── Dialog Content ─── */}
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create a new board</DialogTitle>
            <DialogDescription>
              Give your board a name and pick a color. You can change these
              later.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            {/* ─── Title Field ─── */}
            <div className="space-y-2">
              <Label htmlFor="board-title">Title</Label>
              <Input
                id="board-title"
                placeholder="e.g., Sprint 23, Marketing Campaign"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
              />
            </div>

            {/* ─── Description Field ─── */}
            <div className="space-y-2">
              <Label htmlFor="board-description">
                Description{" "}
                <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="board-description"
                placeholder="What's this board for?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>

            {/* ─── Color Picker ─── */}
            {/*
              We use a grid of colored circles. Clicking one selects it.
              The selected color gets a ring (outline) to indicate selection.

              Why buttons not radio inputs? Buttons are more flexible to style
              and the UX is the same (click to select). We manage the state
              ourselves with useState.
            */}
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

            {/* ─── Preview ─── */}
            {/*
              Show a mini preview of what the board card will look like.
              This gives instant feedback — the user sees the color and title
              as they type, making the creation feel more tangible.
            */}
            {title && (
              <div className="overflow-hidden rounded-lg border">
                <div className="h-2" style={{ backgroundColor: color }} />
                <div className="p-3">
                  <p className="font-semibold text-sm">{title}</p>
                  {description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                      {description}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* ─── Error Message ─── */}
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>

          <DialogFooter className="mt-4">
            <Button
              type="submit"
              disabled={createBoard.isPending || !title.trim()}
            >
              {createBoard.isPending ? "Creating..." : "Create Board"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
