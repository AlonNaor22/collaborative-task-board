"use client";

import { useActionState } from "react";
import Link from "next/link";
import { login } from "@/lib/actions/auth";
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
// Login Page
// ──────────────────────────────────────────────
// "use client" makes this a Client Component — it runs in the browser.
// We need this because:
// 1. useActionState is a React hook (hooks only work in Client Components)
// 2. The form has interactive state (loading, error messages)
//
// HOW THE FORM WORKS:
// 1. User fills in email + password and clicks "Sign In"
// 2. React calls the `login` server action (runs on the server)
// 3. Server action validates input, calls Auth.js signIn()
// 4. If successful → Auth.js sets a session cookie and redirects to /boards
// 5. If failed → returns { error: "..." } which we display below the form
//
// useActionState (React 19):
// This hook connects a server action to form state. It gives us:
// - `state`: the return value of the last action call ({ error?: string })
// - `formAction`: a wrapper around our action that React manages
// - `isPending`: true while the action is running (for loading states)
//
// Think of it like useState + fetch combined — React handles the
// network request and state updates for you.

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(
    // Wrapper needed because useActionState passes (prevState, formData)
    // but our login action only expects (formData).
    async (_prevState: { error?: string }, formData: FormData) => {
      return await login(formData);
    },
    { error: undefined } // Initial state: no error
  );

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold">Welcome back</CardTitle>
        <CardDescription>Sign in to your account to continue</CardDescription>
      </CardHeader>

      <CardContent>
        {/* action={formAction}: when submitted, React calls our server action */}
        <form action={formAction} className="flex flex-col gap-4">
          {/* ─── Error Message ─── */}
          {/* Only shown when the server action returns an error */}
          {state?.error && (
            <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {state.error}
            </div>
          )}

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
              placeholder="Enter your password"
              required
              disabled={isPending}
              autoComplete="current-password"
            />
          </div>

          {/* ─── Submit Button ─── */}
          {/* disabled={isPending}: prevent double-submission while loading */}
          <Button type="submit" size="lg" className="mt-2" disabled={isPending}>
            {isPending ? "Signing in..." : "Sign In"}
          </Button>
        </form>
      </CardContent>

      {/* ─── Footer: Link to Register ─── */}
      <CardFooter className="justify-center">
        <p className="text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="text-primary underline-offset-4 hover:underline">
            Create one
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
