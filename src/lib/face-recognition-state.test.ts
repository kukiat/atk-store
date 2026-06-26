import { describe, expect, it } from "vitest";

import {
  createExternalImageId,
  decideFaceVerification,
} from "./face-recognition-state";

describe("createExternalImageId", () => {
  it("creates a stable non-PII Rekognition external image id", () => {
    expect(createExternalImageId(42)).toBe("atk-store-user-42");
  });

  it("rejects invalid user ids", () => {
    expect(() => createExternalImageId(0)).toThrow("positive integer");
    expect(() => createExternalImageId(1.5)).toThrow("positive integer");
  });
});

describe("decideFaceVerification", () => {
  it("verifies when the matched user and similarity pass the threshold", () => {
    expect(
      decideFaceVerification({
        expectedUserId: 7,
        matchedUserId: 7,
        matchedFaceId: "face-1",
        similarity: 99.2,
        threshold: 99,
      }),
    ).toEqual({
      outcome: "verified",
      matchedUserId: 7,
      matchedFaceId: "face-1",
      similarity: 99.2,
    });
  });

  it("rejects matches for another user", () => {
    expect(
      decideFaceVerification({
        expectedUserId: 7,
        matchedUserId: 8,
        matchedFaceId: "face-2",
        similarity: 99.8,
        threshold: 99,
      }).outcome,
    ).toBe("mismatch");
  });

  it("rejects low-similarity or missing matches", () => {
    expect(
      decideFaceVerification({
        expectedUserId: 7,
        matchedUserId: 7,
        matchedFaceId: "face-1",
        similarity: 98.9,
        threshold: 99,
      }).outcome,
    ).toBe("mismatch");

    expect(
      decideFaceVerification({
        expectedUserId: 7,
        matchedUserId: null,
        matchedFaceId: null,
        similarity: null,
        threshold: 99,
      }).outcome,
    ).toBe("mismatch");
  });
});
