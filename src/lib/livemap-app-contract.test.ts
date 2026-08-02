import { describe, expect, it } from "vitest";

import {
  parseAnchorMapping,
  parseAnchoredFilter,
  parseInventorySearch,
} from "./livemap-app-contract";

describe("livemap app API contract", () => {
  it("normalizes inventory search and anchored filters", () => {
    const params = new URLSearchParams({ q: "  coffee  ", anchored: "true" });

    expect(parseInventorySearch(params)).toBe("coffee");
    expect(parseAnchoredFilter(params)).toBe(true);
    expect(parseAnchoredFilter(new URLSearchParams())).toBeUndefined();
  });

  it("rejects invalid filters and oversized search input", () => {
    expect(() =>
      parseAnchoredFilter(new URLSearchParams({ anchored: "yes" })),
    ).toThrow(/anchored/);
    expect(() =>
      parseInventorySearch(new URLSearchParams({ q: "x".repeat(101) })),
    ).toThrow(/100/);
  });

  it("accepts and trims a valid anchor mapping", () => {
    expect(
      parseAnchorMapping({
        anchorId: "  ua-0fbc-anchor  ",
        inventoryId: "93c75b22-c6e1-4409-9877-008c92ca76a6",
      }),
    ).toEqual({
      anchorId: "ua-0fbc-anchor",
      inventoryId: "93c75b22-c6e1-4409-9877-008c92ca76a6",
    });
  });

  it("rejects malformed IDs and non-object JSON", () => {
    expect(() => parseAnchorMapping([])).toThrow(/JSON object/);
    expect(() =>
      parseAnchorMapping({ anchorId: "", inventoryId: "not-a-uuid" }),
    ).toThrow();
  });
});
