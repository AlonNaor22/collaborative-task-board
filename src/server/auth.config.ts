import type { NextAuthConfig } from "next-auth";

// ──────────────────────────────────────────────
// Auth.js Edge-Compatible Configuration
// ──────────────────────────────────────────────
// WHY a separate config file?
// Next.js middleware runs on the "Edge runtime" — a lightweight
// JavaScript environment (like a CDN worker) that can't use
// Node.js-specific libraries like Prisma or bcrypt.
//
// But middleware needs to know: "is this user logged in?"
// So we put the RULES here (which pages need auth, where to
// redirect) and keep the HEAVY STUFF (DB queries, password
// hashing) in auth.ts.
//
// Think of it like a Java interface: this file declares the
// contract, auth.ts provides the implementation.

export const authConfig = {
  // ─── Custom Pages ───
  // By default, Auth.js generates its own login page at /api/auth/signin.
  // We want our own custom pages, so we tell Auth.js where they are.
  pages: {
    signIn: "/login",
    // newUser: "/register",  // Auth.js doesn't have a built-in register page,
    // we'll handle registration through tRPC instead.
  },

  // ─── Callbacks ───
  // Callbacks are hooks that run at specific points in the auth flow.
  // They let you customize what data gets stored and how access works.
  callbacks: {
    // `authorized` runs on EVERY request (via middleware).
    // It decides: "should this request be allowed through?"
    // Return true = allow, false = redirect to login page.
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const pathname = nextUrl.pathname;

      // Public routes — anyone can access these, even without login
      const publicRoutes = ["/login", "/register"];
      const isPublicRoute = publicRoutes.includes(pathname);

      // API routes handle their own auth (tRPC has protectedProcedure)
      const isApiRoute = pathname.startsWith("/api");

      if (isApiRoute) {
        return true; // Let API routes through — they handle their own auth
      }

      if (isPublicRoute) {
        // If already logged in and trying to visit login/register,
        // redirect them to the dashboard (no need to log in again)
        if (isLoggedIn) {
          return Response.redirect(new URL("/boards", nextUrl));
        }
        return true; // Not logged in → show the login/register page
      }

      // Everything else (dashboard, boards, etc.) requires login.
      // If not logged in, Auth.js automatically redirects to pages.signIn ("/login")
      return isLoggedIn;
    },

    // `jwt` runs when a JWT token is created or updated.
    // By default, Auth.js doesn't put the user's database ID in the token.
    // We need the ID to query the database in our tRPC procedures,
    // so we manually add it here.
    jwt({ token, user }) {
      // `user` is only available on initial sign-in (not on subsequent requests).
      // On sign-in, copy the user's DB id into the token.
      if (user) {
        token.id = user.id;
      }
      return token;
    },

    // `session` runs when the session is read (e.g., via auth() in server code).
    // The session object is what your app sees. By default it has
    // { user: { name, email, image } } but NOT the id.
    // We pull the id from the JWT token (where we stored it above)
    // and inject it into the session so our tRPC context can use it.
    session({ session, token }) {
      if (token?.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },

  // Providers are defined in auth.ts (the full config).
  // We leave an empty array here because the Credentials provider
  // needs Prisma + bcrypt, which can't run on Edge.
  providers: [],
} satisfies NextAuthConfig;
