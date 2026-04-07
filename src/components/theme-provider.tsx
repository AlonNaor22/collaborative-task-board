"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

// ──────────────────────────────────────────────
// ThemeProvider — Dark Mode Wrapper
// ──────────────────────────────────────────────
// A thin Client Component wrapper around next-themes' ThemeProvider.
//
// WHY A SEPARATE FILE?
// The root layout (layout.tsx) is a Server Component — it can't use
// React context or client-side state directly. But next-themes' provider
// needs to run on the client (it reads localStorage, listens for system
// preference changes, and toggles a `.dark` class on <html>).
//
// This wrapper bridges the gap: layout.tsx imports this Client Component,
// which in turn renders the actual provider. Same pattern we used for
// NotificationSocketProvider in Phase 7.
//
// HOW IT WORKS:
// next-themes adds/removes the `dark` class on the <html> element.
// Our globals.css has CSS variables defined under both `:root` (light)
// and `.dark` (dark). Tailwind's `@custom-variant dark` picks up the
// `.dark` class, so all `dark:` utility classes activate automatically.
//
// Think of it like a CSS media query, but controlled by JavaScript:
//   - User clicks toggle → next-themes sets class="dark" on <html>
//   - Tailwind's dark: variants activate → colors change
//   - Preference saved to localStorage → persists across refreshes

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class" // Applies theme via class on <html> (not data-theme)
      defaultTheme="system" // Respect OS preference on first visit
      enableSystem // Allow "system" as a valid theme option
    >
      {children}
    </NextThemesProvider>
  );
}
