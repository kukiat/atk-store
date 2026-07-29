import { describe, expect, it } from "vitest";

import { canUpdateNavigationSession } from "@/lib/navigation-session-status";

describe("canUpdateNavigationSession", () => {
  it("allows a confirmed arrival to resume navigation after walking away", () => {
    expect(canUpdateNavigationSession("arrived", "navigating")).toBe(true);
  });

  it("keeps cancelled sessions terminal", () => {
    expect(canUpdateNavigationSession("cancelled", "navigating")).toBe(false);
    expect(canUpdateNavigationSession("cancelled", "arrived")).toBe(false);
  });

  it("accepts all transitions while navigation is active", () => {
    expect(canUpdateNavigationSession("navigating", "navigating")).toBe(true);
    expect(canUpdateNavigationSession("navigating", "arrived")).toBe(true);
    expect(canUpdateNavigationSession("navigating", "cancelled")).toBe(true);
  });
});
