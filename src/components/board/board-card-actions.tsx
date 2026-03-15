"use client";

// ──────────────────────────────────────────────
// Board Card Actions — Dropdown Menu on Board Cards
// ──────────────────────────────────────────────
// This is a Client Component because it manages the dropdown
// menu state and the edit dialog open/close state.
//
// WHY A SEPARATE COMPONENT?
// BoardCard (parent) is a Server Component for performance.
// But the "..." menu needs interactivity. By extracting just
// the interactive part into a Client Component, we keep most
// of the card as a lightweight Server Component.
//
// This pattern is called "Islands Architecture" — a sea of
// static server-rendered HTML with small interactive "islands."

import { useState } from "react";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EditBoardDialog } from "./edit-board-dialog";

interface BoardCardActionsProps {
  board: {
    id: string;
    title: string;
    description: string | null;
    color: string;
  };
  isOwner: boolean;
}

export function BoardCardActions({ board, isOwner }: BoardCardActionsProps) {
  const [editOpen, setEditOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="absolute top-3 right-3 flex h-7 w-7 items-center justify-center rounded-md opacity-0 transition-opacity hover:bg-accent focus-visible:opacity-100 group-hover:opacity-100"
          onClick={(e) => {
            // Prevent the card's Link from triggering navigation
            // when clicking the "..." button.
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <MoreHorizontal className="h-4 w-4" />
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          // Stop clicks inside the dropdown from bubbling up to the Link
          onClick={(e) => e.preventDefault()}
        >
          <DropdownMenuItem onClick={() => setEditOpen(true)}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit board
          </DropdownMenuItem>

          {isOwner && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setEditOpen(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete board
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Edit Dialog — rendered outside the dropdown so it
          persists after the dropdown closes */}
      <EditBoardDialog
        board={board}
        isOwner={isOwner}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </>
  );
}
