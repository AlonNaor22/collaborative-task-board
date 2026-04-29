import { describe, it, expect, beforeEach, vi } from "vitest";
import { TRPCError } from "@trpc/server";

// ─── Mocks ────────────────────────────────────────────────
// Module mocks are hoisted by vitest, so they apply before any
// of the real modules below are imported.

vi.mock("@/server/db", () => ({
  db: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}));

// init.ts imports `auth` from @/server/auth at module load. We don't
// invoke it (createCallerFactory bypasses createTRPCContext), but the
// real auth.ts runs NextAuth() at module scope and would fail without
// full Auth.js env setup. Stubbing keeps test imports cheap.
vi.mock("@/server/auth", () => ({
  auth: vi.fn(),
}));

// bcrypt.hash with 10 rounds is ~50ms/call — fine for one test, slow
// when many tests grow. Stub to a deterministic string.
vi.mock("bcryptjs", () => ({
  default: {
    hash: vi.fn().mockResolvedValue("hashed-password"),
  },
}));

// ─── Imports (after mocks) ────────────────────────────────
import { db } from "@/server/db";
import { authRouter } from "@/server/trpc/routers/auth";
import { createCallerFactory } from "@/server/trpc/init";

const createCaller = createCallerFactory(authRouter);

// auth.register is a public procedure — context.session is null.
const publicCaller = createCaller({ session: null });

describe("auth.register", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a new user when the email is not taken", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue(null);
    vi.mocked(db.user.create).mockResolvedValue({
      id: "user-123",
      name: "Alice",
      email: "alice@example.com",
      hashedPassword: "hashed-password",
      image: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    const result = await publicCaller.register({
      name: "Alice",
      email: "alice@example.com",
      password: "password123",
    });

    expect(result).toEqual({
      id: "user-123",
      name: "Alice",
      email: "alice@example.com",
    });
    // Critical: never leak the password hash to the client
    expect(result).not.toHaveProperty("hashedPassword");
  });

  it("hashes the password before persisting", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue(null);
    vi.mocked(db.user.create).mockResolvedValue({
      id: "user-123",
      name: "Alice",
      email: "alice@example.com",
    } as never);

    await publicCaller.register({
      name: "Alice",
      email: "alice@example.com",
      password: "password123",
    });

    const createCall = vi.mocked(db.user.create).mock.calls[0]?.[0];
    expect(createCall?.data.hashedPassword).toBe("hashed-password");
    // Critical: the plaintext password must never reach the database
    expect(createCall?.data).not.toHaveProperty("password");
  });

  it("throws CONFLICT when the email already exists", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({
      id: "existing-user",
      email: "alice@example.com",
    } as never);

    await expect(
      publicCaller.register({
        name: "Alice",
        email: "alice@example.com",
        password: "password123",
      })
    ).rejects.toThrow(TRPCError);

    await expect(
      publicCaller.register({
        name: "Alice",
        email: "alice@example.com",
        password: "password123",
      })
    ).rejects.toMatchObject({ code: "CONFLICT" });

    expect(db.user.create).not.toHaveBeenCalled();
  });

  it("rejects passwords shorter than 6 characters (Zod validation)", async () => {
    await expect(
      publicCaller.register({
        name: "Alice",
        email: "alice@example.com",
        password: "abc",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    expect(db.user.findUnique).not.toHaveBeenCalled();
  });

  it("rejects malformed email addresses (Zod validation)", async () => {
    await expect(
      publicCaller.register({
        name: "Alice",
        email: "not-an-email",
        password: "password123",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects empty names (Zod validation)", async () => {
    await expect(
      publicCaller.register({
        name: "",
        email: "alice@example.com",
        password: "password123",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
