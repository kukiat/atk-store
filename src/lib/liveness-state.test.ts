import { describe, expect, it } from "vitest";

import {
  attemptStatusForOutcome,
  decideLivenessOutcome,
  enrollmentStatusForOutcome,
  isAttemptReusable,
} from "./liveness-state";

describe("decideLivenessOutcome", () => {
  it("accepts a succeeded result at or above the threshold", () => {
    expect(
      decideLivenessOutcome({ status: "SUCCEEDED", confidence: 90, threshold: 90 }),
    ).toEqual({ outcome: "accepted", confidence: 90 });
  });

  it("rejects a succeeded result below the threshold", () => {
    expect(
      decideLivenessOutcome({ status: "SUCCEEDED", confidence: 80, threshold: 90 }),
    ).toEqual({ outcome: "rejected", confidence: 80 });
  });

  it("treats a succeeded result with missing confidence as rejected", () => {
    expect(
      decideLivenessOutcome({ status: "SUCCEEDED", confidence: null, threshold: 90 }),
    ).toEqual({ outcome: "rejected", confidence: 0 });
  });

  it("rejects terminal failure statuses", () => {
    expect(
      decideLivenessOutcome({ status: "FAILED", confidence: null, threshold: 90 }),
    ).toEqual({ outcome: "rejected" });
    expect(
      decideLivenessOutcome({ status: "EXPIRED", confidence: null, threshold: 90 }),
    ).toEqual({ outcome: "rejected" });
  });

  it("returns pending for not-yet-finished statuses (no polling)", () => {
    expect(
      decideLivenessOutcome({ status: "CREATED", confidence: null, threshold: 90 }),
    ).toEqual({ outcome: "pending" });
    expect(
      decideLivenessOutcome({
        status: "IN_PROGRESS",
        confidence: null,
        threshold: 90,
      }),
    ).toEqual({ outcome: "pending" });
  });
});

describe("isAttemptReusable", () => {
  const now = new Date("2026-06-24T00:00:00Z");

  it("reuses a pending, unexpired attempt", () => {
    expect(
      isAttemptReusable(
        { status: "pending", expiresAt: new Date(now.getTime() + 60_000) },
        now,
      ),
    ).toBe(true);
  });

  it("does not reuse an expired pending attempt", () => {
    expect(
      isAttemptReusable(
        { status: "pending", expiresAt: new Date(now.getTime() - 1) },
        now,
      ),
    ).toBe(false);
  });

  it("does not reuse a terminal attempt", () => {
    for (const status of ["succeeded", "failed", "expired", "cancelled"] as const) {
      expect(
        isAttemptReusable(
          { status, expiresAt: new Date(now.getTime() + 60_000) },
          now,
        ),
      ).toBe(false);
    }
  });
});

describe("status mapping", () => {
  it("maps outcomes to enrollment status", () => {
    expect(enrollmentStatusForOutcome("accepted")).toBe("registered");
    expect(enrollmentStatusForOutcome("pending")).toBe("pending");
    expect(enrollmentStatusForOutcome("rejected")).toBe("not_registered");
  });

  it("maps outcomes to attempt status", () => {
    expect(attemptStatusForOutcome("accepted")).toBe("succeeded");
    expect(attemptStatusForOutcome("rejected")).toBe("failed");
    expect(attemptStatusForOutcome("pending")).toBe("pending");
  });
});
