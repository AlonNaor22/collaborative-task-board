import { defineConfig } from "vitest/config";
import path from "node:path";

// Vitest config — kept minimal because all current tests are pure logic
// (utilities, Zod-validated procedures, URL parsing). No DOM, no JSX, so
// the default `node` environment is fine.
//
// The alias mirrors tsconfig.json's "@/*" → "./src/*" so test files can
// import production code the same way the rest of the codebase does.
export default defineConfig({
  test: {
    include: ["src/__tests__/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(process.cwd(), "./src"),
    },
  },
});
