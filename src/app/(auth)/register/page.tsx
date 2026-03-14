"use client";

import { useActionState } from "react";
import Link from "next/link";
import { register } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// ──────────────────────────────────────────────
// Register Page
// ──────────────────────────────────────────────
// Very similar to the Login page but with an extra "Name" field.
//
// THE REGISTER FLOW:
// 1. User fills in name, email, password → clicks "Create Account"
// 2. React calls the `register` server action
// 3. Server action:
//    a. Validates input with Zod
//    b. Checks if email already exists in DB
//    c. Hashes password with bcrypt
//    d. Creates user in PostgreSQL via Prisma
//    e. Auto-logs them in via signIn() (so they don't have to login again)
//    f. Redirects to /boards
// 4. If any step fails → returns { error: "..." } displayed here
//
// WHY auto-login after register?
// Imagine signing up for a website and immediately being dumped on the
// login page to type the same credentials again. Annoying, right?
// Auto-login is standard UX — sign up once, you're in.

export default function RegisterPage() {
  const [state, formAction, isPending] = useActionState(
    async (_prevState: { error?: string }, formData: FormData) => {
      return await register(formData);
    },
    { error: undefined }
  );

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold">Create an account</CardTitle>
        <CardDescription>
          Get started with your collaborative task board
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form action={formAction} className="flex flex-col gap-4">
          {/* ─── Error Message ─── */}
          {state?.error && (
            <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {state.error}
            </div>
          )}

          {/* ─── Name Field ─── */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              name="name"
              type="text"
              placeholder="John Doe"
              required
              disabled={isPending}
              autoComplete="name"
            />
          </div>

          {/* ─── Email Field ─── */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              required
              disabled={isPending}
              autoComplete="email"
            />
          </div>

          {/* ─── Password Field ─── */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="At least 6 characters"
              required
              minLength={6}
              disabled={isPending}
              autoComplete="new-password"
            />
          </div>

          {/* ─── Submit Button ─── */}
          <Button type="submit" size="lg" className="mt-2" disabled={isPending}>
            {isPending ? "Creating account..." : "Create Account"}
          </Button>
        </form>
      </CardContent>

      {/* ─── Footer: Link to Login ─── */}
      <CardFooter className="justify-center">
        <p className="text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="text-primary underline-offset-4 hover:underline">
            Sign in
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
