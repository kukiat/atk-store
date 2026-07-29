import { describe, expect, it } from "vitest";

import {
  adaptiveHeadingResponsiveness,
  compassHeadingDegrees,
  createHeadingCalibrationState,
  createStepDetectorState,
  motionMagnitude,
  processHeadingSample,
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

  it("keeps a strong walking step during a fast turn with reduced confidence", () => {
    const previousStep = processMotionSample(
      createStepDetectorState(),
      2,
      1_000,
      0,
    );
    let state = processMotionSample(previousStep.state, 0, 1_120, 0).state;
    const turningPeak = processMotionSample(state, 3.2, 1_400, 180);
    state = turningPeak.state;
    let turningRelease = processMotionSample(state, 0, 1_480, 0);
    turningRelease = processMotionSample(turningRelease.state, 0, 1_560, 0);
    turningRelease = processMotionSample(turningRelease.state, 0, 1_640, 0);

    expect(previousStep.detected).toBe(true);
    expect(turningPeak.detected).toBe(false);
    expect(turningRelease.detected).toBe(true);
    expect(turningRelease.confidence).toBeGreaterThan(0);
    expect(turningRelease.confidence).toBeLessThan(1);
  });

  it("rejects a weak rotation-only peak without disarming future walking", () => {
    let state = createStepDetectorState();
    const rotationOnly = processMotionSample(state, 1.9, 1_000, 220);
    state = rotationOnly.state;
    state = processMotionSample(state, 0, 1_100, 0).state;
    const walking = processMotionSample(state, 2, 1_400, 0);

    expect(rotationOnly.detected).toBe(false);
    expect(walking.detected).toBe(true);
  });

  it("rejects a strong rotation-only waveform without walking cadence", () => {
    let result = processMotionSample(
      createStepDetectorState(),
      3.2,
      1_000,
      180,
    );
    result = processMotionSample(result.state, 0, 1_080, 0);
    result = processMotionSample(result.state, 0, 1_160, 0);
    result = processMotionSample(result.state, 0, 1_240, 0);

    expect(result.detected).toBe(false);
    expect(result.state.lastStepAtMs).toBeNull();
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

describe("heading calibration", () => {
  it("calibrates a stable cluster across north against the route bearing", () => {
    let state = createHeadingCalibrationState(90);
    let result = processHeadingSample(state, 358, 1_000);

    const headings = [0, 1, 359, 2, 0, 358, 1, 359, 0, 2, 358, 0];
    for (const [index, heading] of headings.entries()) {
      result = processHeadingSample(result.state, heading, 1_050 + index * 50);
    }
    state = result.state;

    expect(result.calibrated).toBe(true);
    expect(result.mapHeadingDegrees).toBeCloseTo(90, 0);

    const turned = processHeadingSample(state, 30, 1_700);
    expect(turned.mapHeadingDegrees).toBeCloseTo(120, 0);
  });

  it("does not calibrate before the stable hold duration", () => {
    let result = processHeadingSample(
      createHeadingCalibrationState(90),
      10,
      1_000,
    );
    for (let index = 1; index < 12; index += 1) {
      result = processHeadingSample(result.state, 10, 1_000 + index * 20);
    }

    expect(result.calibrated).toBe(false);
    expect(result.mapHeadingDegrees).toBeNull();
  });

  it("restarts sampling after an unstable direction jump", () => {
    let result = processHeadingSample(
      createHeadingCalibrationState(45),
      0,
      1_000,
    );
    result = processHeadingSample(result.state, 2, 1_020);
    result = processHeadingSample(result.state, 80, 1_040);

    expect(result.calibrated).toBe(false);
    expect(result.state.samples).toEqual([80]);
  });

  it("ignores stale samples instead of moving a calibrated heading backward", () => {
    let result = processHeadingSample(
      createHeadingCalibrationState(90),
      10,
      1_000,
    );
    for (let index = 1; index < 13; index += 1) {
      result = processHeadingSample(result.state, 10, 1_000 + index * 50);
    }
    const stale = processHeadingSample(result.state, 80, 1_550);

    expect(stale.accepted).toBe(false);
    expect(stale.state).toEqual(result.state);
  });

  it("recovers when the browser resets the orientation event clock", () => {
    let result = processHeadingSample(
      createHeadingCalibrationState(90),
      10,
      2_000,
    );
    for (let index = 1; index < 13; index += 1) {
      result = processHeadingSample(result.state, 10, 2_000 + index * 50);
    }
    const resetClock = processHeadingSample(result.state, 20, 100);

    expect(resetClock.accepted).toBe(true);
    expect(resetClock.calibrated).toBe(true);
    expect(resetClock.mapHeadingDegrees).toBeCloseTo(100);
  });
});

describe("adaptiveHeadingResponsiveness", () => {
  it("catches up faster for a large turn while retaining small-turn smoothing", () => {
    const smallTurn = adaptiveHeadingResponsiveness(0, 5, 16);
    const largeTurn = adaptiveHeadingResponsiveness(0, 90, 16);

    expect(largeTurn).toBeGreaterThan(smallTurn);
    expect(largeTurn).toBeGreaterThanOrEqual(0.7);
    expect(smallTurn).toBeGreaterThan(0);
    expect(smallTurn).toBeLessThan(0.7);
  });
});
