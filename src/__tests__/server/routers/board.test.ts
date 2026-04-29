import { describe, it, expect, beforeEach, vi } from "vitest";

// ─── Mocks ────────────────────────────────────────────────

vi.mock("@/server/db", () => ({
  db: {
    board: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    boardMember: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    invitation: {
      deleteMany: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/server/auth", () => ({ auth: vi.fn() }));

// Socket emitters and activity logger are fire-and-forget side effects.
// Stubbing them isolates the router logic — we don't care that they
// were called for these tests, only that the procedure's behavior and
// return value are correct.
vi.mock("@/server/socket", () => ({
  emitBoardUpdate: vi.fn(),
  emitActivityUpdate: vi.fn(),
  emitCommentUpdate: vi.fn(),
  emitNotification: vi.fn(),
  emitNotificationRead: vi.fn(),
}));

vi.mock("@/server/activity", () => ({
  logActivity: vi.fn(),
}));

// ─── Imports (after mocks) ────────────────────────────────
import { db } from "@/server/db";
import { boardRouter } from "@/server/trpc/routers/board";
import { createCallerFactory } from "@/server/trpc/init";

// ─── Test helpers ─────────────────────────────────────────

const USER_ID = "user-1";
const OTHER_USER_ID = "user-2";

function makeCaller(userId: string = USER_ID) {
  const factory = createCallerFactory(boardRouter);
  // Cast `as never` keeps the test free of next-auth's full Session type
  // — the protectedProcedure middleware only inspects session.user.id.
  return factory({
    session: {
      user: { id: userId, name: "Test User", email: "test@example.com" },
      expires: "2099-01-01T00:00:00.000Z",
    },
  } as never);
}

// ─── Tests ────────────────────────────────────────────────

describe("board router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("list", () => {
    it("returns boards where the current user is a member", async () => {
      const mockBoards = [{ id: "b1", title: "Sprint 23" }];
      vi.mocked(db.board.findMany).mockResolvedValue(mockBoards as never);

      const caller = makeCaller();
      const result = await caller.list();

      expect(result).toEqual(mockBoards);
      // The Prisma where-clause should filter by the *current* user's id
      const callArg = vi.mocked(db.board.findMany).mock.calls[0]?.[0];
      expect(callArg?.where).toMatchObject({
        members: { some: { userId: USER_ID } },
      });
    });
  });

  describe("create", () => {
    it("creates the board and adds the creator as OWNER in one nested write", async () => {
      vi.mocked(db.board.create).mockResolvedValue({
        id: "new-board",
        title: "My Board",
      } as never);

      const caller = makeCaller();
      await caller.create({ title: "My Board" });

      const callArg = vi.mocked(db.board.create).mock.calls[0]?.[0];
      expect(callArg?.data.ownerId).toBe(USER_ID);
      // Nested create ensures the BoardMember row is written atomically
      expect(callArg?.data.members).toEqual({
        create: { userId: USER_ID, role: "OWNER" },
      });
    });

    it("defaults the color to blue (#3B82F6) when none is provided", async () => {
      vi.mocked(db.board.create).mockResolvedValue({} as never);

      const caller = makeCaller();
      await caller.create({ title: "My Board" });

      const callArg = vi.mocked(db.board.create).mock.calls[0]?.[0];
      expect(callArg?.data.color).toBe("#3B82F6");
    });

    it("rejects invalid hex colors (Zod validation)", async () => {
      const caller = makeCaller();
      await expect(
        caller.create({ title: "My Board", color: "not-a-color" })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      expect(db.board.create).not.toHaveBeenCalled();
    });

    it("rejects empty titles (Zod validation)", async () => {
      const caller = makeCaller();
      await expect(caller.create({ title: "" })).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
    });
  });

  describe("getById — authorization", () => {
    it("returns the board when the caller is a member", async () => {
      vi.mocked(db.board.findUnique).mockResolvedValue({
        id: "b1",
        title: "Sprint 23",
        members: [{ userId: USER_ID, role: "MEMBER" }],
      } as never);

      const caller = makeCaller();
      const result = await caller.getById({ id: "b1" });

      expect(result.id).toBe("b1");
    });

    it("throws NOT_FOUND when the caller is not a member (no FORBIDDEN leak)", async () => {
      // Security: returning FORBIDDEN would confirm the board exists.
      // The router collapses both "doesn't exist" and "not a member"
      // into NOT_FOUND to prevent enumeration.
      vi.mocked(db.board.findUnique).mockResolvedValue({
        id: "b1",
        members: [{ userId: OTHER_USER_ID, role: "OWNER" }],
      } as never);

      const caller = makeCaller();
      await expect(caller.getById({ id: "b1" })).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
    });

    it("throws NOT_FOUND when the board does not exist", async () => {
      vi.mocked(db.board.findUnique).mockResolvedValue(null);

      const caller = makeCaller();
      await expect(caller.getById({ id: "ghost" })).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
    });
  });

  describe("update — authorization", () => {
    it("allows OWNER to update the board", async () => {
      vi.mocked(db.boardMember.findUnique).mockResolvedValue({
        userId: USER_ID,
        boardId: "b1",
        role: "OWNER",
      } as never);
      vi.mocked(db.board.update).mockResolvedValue({ id: "b1" } as never);

      const caller = makeCaller();
      await expect(
        caller.update({ id: "b1", title: "New Title" })
      ).resolves.toBeDefined();
    });

    it("allows ADMIN to update the board", async () => {
      vi.mocked(db.boardMember.findUnique).mockResolvedValue({
        userId: USER_ID,
        boardId: "b1",
        role: "ADMIN",
      } as never);
      vi.mocked(db.board.update).mockResolvedValue({ id: "b1" } as never);

      const caller = makeCaller();
      await expect(
        caller.update({ id: "b1", title: "New Title" })
      ).resolves.toBeDefined();
    });

    it("blocks MEMBER with FORBIDDEN", async () => {
      vi.mocked(db.boardMember.findUnique).mockResolvedValue({
        userId: USER_ID,
        boardId: "b1",
        role: "MEMBER",
      } as never);

      const caller = makeCaller();
      await expect(
        caller.update({ id: "b1", title: "New Title" })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(db.board.update).not.toHaveBeenCalled();
    });

    it("returns NOT_FOUND when the caller has no membership row", async () => {
      vi.mocked(db.boardMember.findUnique).mockResolvedValue(null);

      const caller = makeCaller();
      await expect(
        caller.update({ id: "b1", title: "New Title" })
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
  });

  describe("delete — authorization", () => {
    it("allows OWNER to delete the board", async () => {
      vi.mocked(db.boardMember.findUnique).mockResolvedValue({
        userId: USER_ID,
        boardId: "b1",
        role: "OWNER",
      } as never);
      vi.mocked(db.board.delete).mockResolvedValue({} as never);

      const caller = makeCaller();
      const result = await caller.delete({ id: "b1" });

      expect(result).toEqual({ success: true });
      expect(db.board.delete).toHaveBeenCalledWith({ where: { id: "b1" } });
    });

    it("blocks ADMIN with FORBIDDEN (only OWNER can delete)", async () => {
      vi.mocked(db.boardMember.findUnique).mockResolvedValue({
        userId: USER_ID,
        boardId: "b1",
        role: "ADMIN",
      } as never);

      const caller = makeCaller();
      await expect(caller.delete({ id: "b1" })).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      expect(db.board.delete).not.toHaveBeenCalled();
    });

    it("blocks MEMBER with FORBIDDEN", async () => {
      vi.mocked(db.boardMember.findUnique).mockResolvedValue({
        userId: USER_ID,
        boardId: "b1",
        role: "MEMBER",
      } as never);

      const caller = makeCaller();
      await expect(caller.delete({ id: "b1" })).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
    });

    it("returns NOT_FOUND when the caller is not a member at all", async () => {
      vi.mocked(db.boardMember.findUnique).mockResolvedValue(null);

      const caller = makeCaller();
      await expect(caller.delete({ id: "b1" })).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
    });
  });

  describe("changeRole — authorization", () => {
    it("blocks OWNER from changing their own role", async () => {
      vi.mocked(db.boardMember.findUnique).mockResolvedValue({
        userId: USER_ID,
        boardId: "b1",
        role: "OWNER",
      } as never);

      const caller = makeCaller();
      await expect(
        caller.changeRole({ boardId: "b1", userId: USER_ID, role: "ADMIN" })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });

    it("blocks ADMIN from changing roles (OWNER-only operation)", async () => {
      vi.mocked(db.boardMember.findUnique).mockResolvedValue({
        userId: USER_ID,
        boardId: "b1",
        role: "ADMIN",
      } as never);

      const caller = makeCaller();
      await expect(
        caller.changeRole({ boardId: "b1", userId: OTHER_USER_ID, role: "ADMIN" })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
  });

  describe("removeMember — authorization", () => {
    it("blocks OWNER from removing themselves (must delete board instead)", async () => {
      vi.mocked(db.boardMember.findUnique).mockResolvedValue({
        userId: USER_ID,
        boardId: "b1",
        role: "OWNER",
      } as never);

      const caller = makeCaller();
      await expect(
        caller.removeMember({ boardId: "b1", userId: USER_ID })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });

    it("blocks ADMIN from removing another ADMIN", async () => {
      // First findUnique = caller membership (ADMIN)
      // Second findUnique = target membership (ADMIN)
      vi.mocked(db.boardMember.findUnique)
        .mockResolvedValueOnce({
          userId: USER_ID,
          boardId: "b1",
          role: "ADMIN",
        } as never)
        .mockResolvedValueOnce({
          userId: OTHER_USER_ID,
          boardId: "b1",
          role: "ADMIN",
          user: { name: "Other Admin" },
        } as never);

      const caller = makeCaller();
      await expect(
        caller.removeMember({ boardId: "b1", userId: OTHER_USER_ID })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(db.boardMember.delete).not.toHaveBeenCalled();
    });

    it("allows ADMIN to remove a MEMBER and cleans up pending invitations", async () => {
      vi.mocked(db.boardMember.findUnique)
        .mockResolvedValueOnce({
          userId: USER_ID,
          boardId: "b1",
          role: "ADMIN",
        } as never)
        .mockResolvedValueOnce({
          userId: OTHER_USER_ID,
          boardId: "b1",
          role: "MEMBER",
          user: { name: "Some Member" },
        } as never);
      vi.mocked(db.boardMember.delete).mockResolvedValue({} as never);
      vi.mocked(db.invitation.deleteMany).mockResolvedValue({ count: 0 } as never);

      const caller = makeCaller();
      const result = await caller.removeMember({
        boardId: "b1",
        userId: OTHER_USER_ID,
      });

      expect(result).toEqual({ success: true });
      expect(db.boardMember.delete).toHaveBeenCalled();
      // Pending invites for the removed user must be cleaned up so the
      // invitation system doesn't re-add them on the next acceptance.
      expect(db.invitation.deleteMany).toHaveBeenCalledWith({
        where: {
          boardId: "b1",
          inviteeId: OTHER_USER_ID,
          status: "PENDING",
        },
      });
    });

    it("blocks MEMBER from removing anyone", async () => {
      vi.mocked(db.boardMember.findUnique)
        .mockResolvedValueOnce({
          userId: USER_ID,
          boardId: "b1",
          role: "MEMBER",
        } as never)
        .mockResolvedValueOnce({
          userId: OTHER_USER_ID,
          boardId: "b1",
          role: "MEMBER",
          user: { name: "Some Member" },
        } as never);

      const caller = makeCaller();
      await expect(
        caller.removeMember({ boardId: "b1", userId: OTHER_USER_ID })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
  });
});
