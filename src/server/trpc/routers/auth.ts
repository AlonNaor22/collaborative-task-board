import { z } from "zod";
import bcrypt from "bcryptjs";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, publicProcedure } from "../init";
import { db } from "@/server/db";

// ──────────────────────────────────────────────
// Auth Router
// ──────────────────────────────────────────────
// This router handles user registration. Login is handled by
// Auth.js directly (Step 4), not through tRPC.
//
// Think of this like a Java @RestController with one endpoint:
//   @PostMapping("/auth/register")
//   public User register(@RequestBody RegisterDto dto) { ... }
//
// But with tRPC, the frontend calls it like a function:
//   trpc.auth.register.mutate({ name, email, password })
// And TypeScript enforces the types on both sides.

export const authRouter = createTRPCRouter({
  // `register` is a "mutation" (not a "query") because it CHANGES data.
  // In REST terms: queries = GET, mutations = POST/PUT/DELETE.
  // In database terms: queries = SELECT, mutations = INSERT/UPDATE/DELETE.
  register: publicProcedure
    // `.input()` defines the expected shape of incoming data using Zod.
    // This is like @Valid @RequestBody in Spring — it validates BEFORE
    // your logic runs. If someone sends { email: 123 }, Zod rejects it
    // automatically with a clear error message.
    .input(
      z.object({
        name: z.string().min(1, "Name is required"),
        email: z.string().email("Invalid email address"),
        password: z.string().min(6, "Password must be at least 6 characters"),
      })
    )
    // `.mutation()` is the actual logic that runs after validation passes.
    // `ctx` = context (session info), `input` = validated data from above.
    .mutation(async ({ input }) => {
      const { name, email, password } = input;

      // 1. Check if email already exists
      const existingUser = await db.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        // TRPCError is like throwing a custom exception.
        // CONFLICT = HTTP 409 — "this resource already exists"
        throw new TRPCError({
          code: "CONFLICT",
          message: "Email already in use",
        });
      }

      // 2. Hash the password
      // bcrypt.hash(password, 10) — the "10" is the salt rounds.
      // More rounds = slower but more secure. 10 is the standard.
      // This turns "mypassword" into something like "$2a$10$xJ3k..."
      // which is impossible to reverse.
      const hashedPassword = await bcrypt.hash(password, 10);

      // 3. Create the user in the database
      // Prisma's `.create()` is like SQL: INSERT INTO users (name, email, ...)
      const user = await db.user.create({
        data: {
          name,
          email,
          hashedPassword,
        },
      });

      // 4. Return the created user (without the password hash!)
      // Never send password hashes to the client, even hashed ones.
      return {
        id: user.id,
        name: user.name,
        email: user.email,
      };
    }),
});
