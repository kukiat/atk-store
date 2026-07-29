import { describe, expect, it } from "vitest";

import {
  compassHeadingDegrees,
  createStepDetectorState,
  motionMagnitude,
  processMotionSample,
  rotationRateMagnitude,
  smoothHeadingDegrees,
} from "@/lib/live-map-motion";

describe("motionMagnitude", () => {
  it("falls back to gravity-inclusive acceleration when linear axes are null", () => {
    expect(
      motionMagnitude({ x: null, y: null, z: null }, { x: 0, y: 0, z: 11.81 }),
    ).toBeCloseTo(2);
  });

  it("returns zero when neither sensor source has usable axes", () => {
    expect(motionMagnitude(null, { x: null, y: null, z: null })).toBe(0);
  });
});

describe("processMotionSample", () => {
  it("detects a single bounded peak from a low-frequency sensor stream", () => {
    const result = processMotionSample(createStepDetectorState(), 1.7, 1_000);

    expect(result.detected).toBe(true);
  });

  it("detects distinct fast steps without counting one peak twice", () => {
    let state = createStepDetectorState();

    const firstPeak = processMotionSample(state, 2, 1_000);
    state = firstPeak.state;
    const samePeak = processMotionSample(state, 2, 1_100);
    state = samePeak.state;
    state = processMotionSample(state, 0, 1_160).state;
    state = processMotionSample(state, 0, 1_220).state;
    const secondPeak = processMotionSample(state, 2, 1_320);

    expect(firstPeak.detected).toBe(true);
    expect(samePeak.detected).toBe(false);
    expect(secondPeak.detected).toBe(true);
    expect(secondPeak.stepMeters).toBeGreaterThan(firstPeak.stepMeters);
  });

  it("ignores sub-threshold motion noise", () => {
    const result = processMotionSample(createStepDetectorState(), 0.6, 1_000);

    expect(result.detected).toBe(false);
  });

  it("rejects a motion peak during rapid phone rotation", () => {
    const rotated = processMotionSample(
      createStepDetectorState(),
      2,
      1_000,
      180,
    );
    const settled = processMotionSample(rotated.state, 0, 1_100, 0);
    const walking = processMotionSample(settled.state, 2, 1_400, 0);

    expect(rotated.detected).toBe(false);
    expect(walking.detected).toBe(true);
  });

  it("keeps normal turns eligible for step detection", () => {
    expect(
      processMotionSample(createStepDetectorState(), 2, 1_000, 60).detected,
    ).toBe(true);
  });
});

describe("rotationRateMagnitude", () => {
  it("combines the available rotation axes and ignores missing values", () => {
    expect(rotationRateMagnitude({ alpha: 30, beta: 40, gamma: null })).toBe(
      50,
    );
    expect(rotationRateMagnitude(null)).toBe(0);
  });
});

describe("compassHeadingDegrees", () => {
  it("compensates for an upright device with roll", () => {
    expect(compassHeadingDegrees(300, 90, 30)).toBeCloseTo(30);
  });

  it("uses inverse alpha when the device is lying flat", () => {
    expect(compassHeadingDegrees(300, 0, 0)).toBeCloseTo(60);
  });

  it("rejects non-finite orientation values", () => {
    expect(compassHeadingDegrees(Number.NaN, 90, 30)).toBeNull();
  });
});

describe("smoothHeadingDegrees", () => {
  it("takes the short turn across north and responds in one frame", () => {
    expect(smoothHeadingDegrees(359, 1, 0.8)).toBeCloseTo(0.6);
    expect(smoothHeadingDegrees(1, 359, 0.8)).toBeCloseTo(359.4);
  });
});
