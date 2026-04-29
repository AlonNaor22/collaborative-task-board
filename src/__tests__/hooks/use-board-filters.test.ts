import { describe, it, expect } from "vitest";
import { parseFilters } from "@/hooks/use-board-filters";

// We test parseFilters directly as a pure function rather than rendering
// the hook. The hook itself is a thin wrapper around parseFilters +
// router.replace, so covering the parser covers the substantive logic
// without pulling in React, next/navigation, and a DOM environment.

describe("parseFilters()", () => {
  it("returns defaults when params are empty", () => {
    expect(parseFilters(new URLSearchParams())).toEqual({
      q: "",
      labelIds: [],
      assigneeIds: [],
      due: "all",
    });
  });

  it("reads the q (search) param", () => {
    expect(parseFilters(new URLSearchParams("q=hello")).q).toBe("hello");
  });

  it("collects multiple label params into labelIds", () => {
    const filters = parseFilters(new URLSearchParams("label=a&label=b&label=c"));
    expect(filters.labelIds).toEqual(["a", "b", "c"]);
  });

  it("collects multiple assignee params into assigneeIds", () => {
    const filters = parseFilters(new URLSearchParams("assignee=u1&assignee=u2"));
    expect(filters.assigneeIds).toEqual(["u1", "u2"]);
  });

  it("accepts each whitelisted due value", () => {
    expect(parseFilters(new URLSearchParams("due=overdue")).due).toBe("overdue");
    expect(parseFilters(new URLSearchParams("due=soon")).due).toBe("soon");
    expect(parseFilters(new URLSearchParams("due=none")).due).toBe("none");
    expect(parseFilters(new URLSearchParams("due=all")).due).toBe("all");
  });

  it("falls back to 'all' when due is unknown garbage", () => {
    // Defensive: a manually-edited URL like ?due=banana shouldn't crash.
    expect(parseFilters(new URLSearchParams("due=banana")).due).toBe("all");
  });

  it("handles all filters set together", () => {
    const params = new URLSearchParams(
      "q=urgent&label=l1&label=l2&assignee=u1&due=overdue"
    );
    expect(parseFilters(params)).toEqual({
      q: "urgent",
      labelIds: ["l1", "l2"],
      assigneeIds: ["u1"],
      due: "overdue",
    });
  });
});
