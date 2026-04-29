import { describe, it, expect } from "vitest";
import { parseMentions } from "@/server/notification";

describe("parseMentions()", () => {
  it("returns empty array when content has no @ symbols", () => {
    expect(parseMentions("Just a plain comment.")).toEqual([]);
  });

  it("returns empty array for empty string", () => {
    expect(parseMentions("")).toEqual([]);
  });

  it("extracts a single @mention", () => {
    expect(parseMentions("Hey @Alice, can you take a look?")).toEqual(["Alice"]);
  });

  it("extracts multiple @mentions in order", () => {
    expect(parseMentions("@Alice and @Bob — please review")).toEqual(["Alice", "Bob"]);
  });

  it("handles mentions adjacent to punctuation", () => {
    // Regex is /@(\w+)/g — punctuation after the word stops the capture
    expect(parseMentions("ping @Charlie!")).toEqual(["Charlie"]);
  });

  it("preserves duplicates (caller is responsible for dedup)", () => {
    // The helper extracts; dedup is the caller's job. This test pins
    // current behavior so a future change to dedup is intentional.
    expect(parseMentions("@Alice and @Alice again")).toEqual(["Alice", "Alice"]);
  });

  it("captures the local part of an email address (known limitation)", () => {
    // The regex matches @word patterns indiscriminately. With a string
    // like "user@example.com", "@example" matches. This is a documented
    // simplification — see the comment in src/server/notification.ts.
    expect(parseMentions("contact user@example.com")).toEqual(["example"]);
  });
});
