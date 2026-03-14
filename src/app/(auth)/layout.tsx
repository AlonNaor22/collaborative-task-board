// ──────────────────────────────────────────────
// Auth Layout (Route Group)
// ──────────────────────────────────────────────
// The (auth) folder is a "route group" in Next.js. The parentheses
// tell Next.js: "use this folder for organization, but DON'T include
// it in the URL." So:
//   src/app/(auth)/login/page.tsx  → URL: /login   (NOT /auth/login)
//   src/app/(auth)/register/page.tsx → URL: /register
//
// WHY a route group? Login and register pages share the same layout
// (centered card on a plain background), which is DIFFERENT from the
// dashboard layout (sidebar + navbar). Route groups let each group
// have its own layout without affecting URLs.
//
// This is a Server Component (no "use client") — it just wraps
// children in a centered flex container. No interactivity needed.

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // min-h-screen: fill the entire viewport height
    // flex items-center justify-center: center the card both horizontally and vertically
    // bg-muted/40: very subtle gray background to differentiate from the card
    // p-4: padding so the card doesn't touch screen edges on mobile
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      {/* max-w-md: cap the card width at 448px (looks good on desktop, fills mobile) */}
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
