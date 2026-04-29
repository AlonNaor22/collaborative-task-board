import { describe, it, expect } from "vitest";
import { cn } from "@/lib/utils";

describe("cn()", () => {
  it("merges plain class strings", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("ignores falsy values from clsx-style conditionals", () => {
    expect(cn("foo", false && "bar", null, undefined, "baz")).toBe("foo baz");
  });

  it("flattens object-form conditionals", () => {
    expect(cn("base", { active: true, disabled: false })).toBe("base active");
  });

  it("uses tailwind-merge to resolve conflicting utility classes", () => {
    // Last conflicting class wins (px-4 overrides px-2)
    expect(cn("px-2", "px-4")).toBe("px-4");
    // Non-conflicting classes are preserved
    expect(cn("text-sm font-bold", "text-lg")).toBe("font-bold text-lg");
  });

  it("returns empty string when given no inputs", () => {
    expect(cn()).toBe("");
  });
});
