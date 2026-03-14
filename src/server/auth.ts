import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { authConfig } from "./auth.config";

// ──────────────────────────────────────────────
// Auth.js v5 Full Configuration
// ──────────────────────────────────────────────
// This file is the "implementation" — it takes the edge-safe rules
// from auth.config.ts and adds the heavy lifting: database queries
// and password hashing.
//
// NextAuth() returns 4 things we'll use throughout the app:
// - auth:     function to get the current session (used in tRPC context)
// - signIn:   function to log a user in (used in login page)
// - signOut:  function to log a user out (used in navbar)
// - handlers: HTTP handlers for GET/POST (used in the API route)
//
// HOW THE LOGIN FLOW WORKS:
// 1. User submits email + password on the login page
// 2. signIn("credentials", { email, password }) is called
// 3. Auth.js calls our `authorize` function below
// 4. We look up the user in the DB and compare password hashes
// 5. If valid → Auth.js creates a JWT, stores it in an encrypted cookie
// 6. On every subsequent request, auth() reads that cookie and returns
//    the session: { user: { id, name, email } }

export const { auth, signIn, signOut, handlers } = NextAuth({
  // Spread the edge config (pages, callbacks, empty providers array)
  ...authConfig,

  // ─── Session Strategy ───
  // "jwt" means the session lives in an encrypted cookie on the client.
  // Alternative is "database" (store sessions in a DB table), but JWT
  // is simpler — no extra table, no extra DB queries per request.
  // The cookie is encrypted with AUTH_SECRET from your .env file.
  session: { strategy: "jwt" },

  // ─── Providers ───
  // Override the empty providers array from auth.config.ts.
  // Credentials = email/password login (as opposed to OAuth like Google/GitHub).
  // We use Credentials because:
  // 1. No external OAuth app setup needed
  // 2. Full control over the auth flow
  // 3. Good for a portfolio project (self-contained)
  providers: [
    Credentials({
      // `authorize` is the core function. Auth.js calls it when a user
      // tries to log in. It receives whatever the login form sent.
      // Return a user object → login succeeds.
      // Return null → login fails (Auth.js shows "Invalid credentials").
      async authorize(credentials) {
        const email = credentials.email as string;
        const password = credentials.password as string;

        if (!email || !password) {
          return null;
        }

        // Look up the user by email
        const user = await db.user.findUnique({
          where: { email },
        });

        // No user with that email? Return null (don't reveal "user not found"
        // to prevent email enumeration attacks — a security best practice).
        if (!user) {
          return null;
        }

        // Compare the submitted password with the stored hash.
        // bcrypt.compare does: hash(submitted) === storedHash
        // This is constant-time to prevent timing attacks.
        const passwordMatch = await bcrypt.compare(password, user.hashedPassword);

        if (!passwordMatch) {
          return null;
        }

        // Return the user object. Auth.js puts this into the JWT token.
        // IMPORTANT: Never return hashedPassword — it should never leave the server.
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
        };
      },
    }),
  ],
});
