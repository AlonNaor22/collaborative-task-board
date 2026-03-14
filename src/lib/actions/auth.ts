"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { signIn } from "@/server/auth";
import { db } from "@/server/db";

// ──────────────────────────────────────────────
// Auth Server Actions
// ──────────────────────────────────────────────
// "use server" at the top makes every exported function a Server Action.
//
// Server Actions are like AJAX form handlers but built into React.
// When a form calls a server action:
// 1. React serializes the form data
// 2. Sends it to the server via POST
// 3. The function runs on the server (has full access to DB, auth, etc.)
// 4. Returns a result that React receives on the client
//
// WHY Server Actions instead of tRPC for auth forms?
// Auth.js's signIn() function MUST run on the server — it sets
// encrypted HTTP-only cookies that the client can't access.
// Server Actions run on the server, so they can call signIn() directly.
// With tRPC from a client component, we'd need an extra round-trip.

// ─── Validation Schemas ───
// Same rules as the tRPC register mutation (DRY principle).
// Zod validates input BEFORE our logic runs — like @Valid in Spring.
const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

const registerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

// ─── Return Type ───
// Server Actions can't throw errors to the client (they'd crash the page).
// Instead, we return a result object: { error?: string }.
// The form component checks this and displays the message.
type ActionResult = { error?: string };

// ──────────────────────────────────────────────
// Login Action
// ──────────────────────────────────────────────
// Called when the login form is submitted.
// Uses Auth.js signIn() to verify credentials and set the session cookie.
export async function login(formData: FormData): Promise<ActionResult> {
  // 1. Extract and validate form data
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    // .flatten() turns Zod's nested errors into a simple object.
    // We grab the first error message from any field.
    const errors = parsed.error.flatten().fieldErrors;
    const firstError = Object.values(errors).flat()[0];
    return { error: firstError || "Invalid input" };
  }

  try {
    // 2. Call Auth.js signIn with the "credentials" provider.
    // This triggers the `authorize` function in auth.ts:
    //   - Looks up user by email
    //   - Compares password with bcrypt
    //   - Returns user object or null
    //
    // `redirectTo: "/boards"` tells Auth.js where to send the user
    // after successful login. Auth.js handles the redirect internally.
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: "/boards",
    });
  } catch (error) {
    // Auth.js throws specific error types. CredentialsSignin means
    // the email/password combination was wrong.
    if (error instanceof AuthError) {
      if (error.type === "CredentialsSignin") {
        return { error: "Invalid email or password" };
      }
      return { error: "Something went wrong. Please try again." };
    }
    // IMPORTANT: signIn() with redirectTo throws a NEXT_REDIRECT error
    // internally (that's how Next.js server-side redirects work).
    // We must re-throw it so the redirect actually happens.
    throw error;
  }

  return {};
}

// ──────────────────────────────────────────────
// Register Action
// ──────────────────────────────────────────────
// Called when the register form is submitted.
// Creates a new user in the database, then auto-logs them in.
export async function register(formData: FormData): Promise<ActionResult> {
  // 1. Extract and validate form data
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    const firstError = Object.values(errors).flat()[0];
    return { error: firstError || "Invalid input" };
  }

  const { name, email, password } = parsed.data;

  try {
    // 2. Check if email already exists
    const existingUser = await db.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return { error: "An account with this email already exists" };
    }

    // 3. Hash the password (same as tRPC register mutation)
    const hashedPassword = await bcrypt.hash(password, 10);

    // 4. Create the user
    await db.user.create({
      data: { name, email, hashedPassword },
    });

    // 5. Auto-login: sign the user in immediately after registration.
    // This is better UX than making them fill out the login form again.
    await signIn("credentials", {
      email,
      password,
      redirectTo: "/boards",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Something went wrong. Please try again." };
    }
    // Re-throw NEXT_REDIRECT (see login action for explanation)
    throw error;
  }

  return {};
}
