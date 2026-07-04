import { describe, expect, it } from "vitest";

import { assertPositiveMinorUnit, bahtToMinorUnit } from "./money";

describe("wallet money helpers", () => {
  it("converts baht amounts to integer minor units", () => {
    expect(bahtToMinorUnit(100)).toBe(10000);
    expect(bahtToMinorUnit(35.5)).toBe(3550);
    expect(bahtToMinorUnit(0.29)).toBe(29);
  });

  it("rejects invalid wallet mutation amounts", () => {
    expect(() => assertPositiveMinorUnit(1)).not.toThrow();
    expect(() => assertPositiveMinorUnit(0)).toThrow(
      "Amount must be a positive integer minor unit",
    );
    expect(() => assertPositiveMinorUnit(1.5)).toThrow(
      "Amount must be a positive integer minor unit",
    );
  });
});
