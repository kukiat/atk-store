type AccelerationAxes = {
  x: number | null;
  y: number | null;
  z: number | null;
};

type RotationRateAxes = {
  alpha: number | null;
  beta: number | null;
  gamma: number | null;
};

export type StepDetectorState = {
  filteredMagnitude: number;
  armed: boolean;
  lastStepAtMs: number | null;
  pendingTurningStep: {
    peakAtMs: number;
    stepMeters: number;
    confidence: number;
  } | null;
};

export type HeadingCalibrationState = {
  expectedMapHeadingDegrees: number;
  samples: number[];
  firstSampleAtMs: number | null;
  lastSampleAtMs: number | null;
  calibratedDeviceHeadingDegrees: number | null;
};

const STANDARD_GRAVITY = 9.81;
const FILTER_ALPHA = 0.45;
const STEP_TRIGGER = 0.8;
const RAW_STEP_TRIGGER = 1.6;
const STEP_RELEASE = 0.5;
const MIN_STEP_INTERVAL_MS = 260;
const DEFAULT_STEP_METERS = 0.68;
const MIN_STEP_METERS = 0.56;
const MAX_STEP_METERS = 0.78;
const ROTATION_THRESHOLD_START = 80;
const ROTATION_THRESHOLD_SCALE = 0.007;
const MAX_ROTATION_THRESHOLD_BOOST = 1.2;
const FULL_CONFIDENCE_ROTATION_RATE = 60;
const MIN_TURNING_STEP_CONFIDENCE = 0.35;
const TURNING_CONFIDENCE_RANGE = 300;
const TURNING_CADENCE_REQUIRED_RATE = 120;
const MAX_TURNING_CADENCE_MS = 950;
const TURNING_RELEASE_MAX_MS = 400;
const HEADING_CALIBRATION_SAMPLES = 12;
const HEADING_CALIBRATION_DURATION_MS = 600;
const HEADING_SAMPLE_MAX_GAP_MS = 300;
const HEADING_STABILITY_DEGREES = 15;

export function normalizeDegrees(value: number) {
  return ((value % 360) + 360) % 360;
}

function shortestHeadingDeltaDegrees(fromDegrees: number, toDegrees: number) {
  return ((normalizeDegrees(toDegrees - fromDegrees) + 180) % 360) - 180;
}

function circularMeanDegrees(values: number[]) {
  if (values.length === 0) return null;
  const radians = values.map(
    (value) => (normalizeDegrees(value) * Math.PI) / 180,
  );
  const x = radians.reduce((sum, value) => sum + Math.cos(value), 0);
  const y = radians.reduce((sum, value) => sum + Math.sin(value), 0);
  if (Math.abs(x) < 1e-7 && Math.abs(y) < 1e-7) return null;
  return normalizeDegrees((Math.atan2(y, x) * 180) / Math.PI);
}

export function compassHeadingDegrees(
  alphaDegrees: number,
  betaDegrees: number,
  gammaDegrees: number,
) {
  if (
    !Number.isFinite(alphaDegrees) ||
    !Number.isFinite(betaDegrees) ||
    !Number.isFinite(gammaDegrees)
  ) {
    return null;
  }

  const degreesToRadians = Math.PI / 180;
  const alpha = alphaDegrees * degreesToRadians;
  const beta = betaDegrees * degreesToRadians;
  const gamma = gammaDegrees * degreesToRadians;
  const sinBeta = Math.sin(beta);
  const sinGamma = Math.sin(gamma);

  if (Math.abs(sinBeta) < 1e-7 && Math.abs(sinGamma) < 1e-7) {
    return normalizeDegrees(360 - alphaDegrees);
  }

  const cosGamma = Math.cos(gamma);
  const vectorX =
    -Math.cos(alpha) * sinGamma - Math.sin(alpha) * sinBeta * cosGamma;
  const vectorY =
    -Math.sin(alpha) * sinGamma + Math.cos(alpha) * sinBeta * cosGamma;
  return normalizeDegrees(Math.atan2(vectorX, vectorY) / degreesToRadians);
}

function finiteAxes(acceleration: AccelerationAxes | null) {
  if (!acceleration) return null;
  const axes = [acceleration.x, acceleration.y, acceleration.z];
  if (!axes.some((axis) => typeof axis === "number" && Number.isFinite(axis))) {
    return null;
  }
  return axes.map((axis) =>
    typeof axis === "number" && Number.isFinite(axis) ? axis : 0,
  );
}

export function motionMagnitude(
  acceleration: AccelerationAxes | null,
  accelerationIncludingGravity: AccelerationAxes | null,
) {
  const linearAxes = finiteAxes(acceleration);
  if (linearAxes) return Math.hypot(...linearAxes);

  const gravityAxes = finiteAxes(accelerationIncludingGravity);
  return gravityAxes
    ? Math.abs(Math.hypot(...gravityAxes) - STANDARD_GRAVITY)
    : 0;
}

export function rotationRateMagnitude(rotationRate: RotationRateAxes | null) {
  if (!rotationRate) return 0;
  const axes = [rotationRate.alpha, rotationRate.beta, rotationRate.gamma].map(
    (axis) => (typeof axis === "number" && Number.isFinite(axis) ? axis : 0),
  );
  return Math.hypot(...axes);
}

export function createStepDetectorState(): StepDetectorState {
  return {
    filteredMagnitude: 0,
    armed: true,
    lastStepAtMs: null,
    pendingTurningStep: null,
  };
}

function estimateStepMeters(intervalMs: number | null) {
  if (intervalMs === null || intervalMs > 1_500) return DEFAULT_STEP_METERS;
  const boundedInterval = Math.min(900, Math.max(320, intervalMs));
  const cadenceAdjusted =
    DEFAULT_STEP_METERS + (600 - boundedInterval) * 0.0003;
  return Math.min(MAX_STEP_METERS, Math.max(MIN_STEP_METERS, cadenceAdjusted));
}

export function processMotionSample(
  state: StepDetectorState,
  magnitude: number,
  nowMs: number,
  rotationRateDegreesPerSecond = 0,
) {
  const safeMagnitude =
    Number.isFinite(magnitude) && magnitude > 0 ? magnitude : 0;
  const safeRotationRate =
    Number.isFinite(rotationRateDegreesPerSecond) &&
    rotationRateDegreesPerSecond > 0
      ? rotationRateDegreesPerSecond
      : 0;
  const rotationThresholdBoost = Math.min(
    MAX_ROTATION_THRESHOLD_BOOST,
    Math.max(0, safeRotationRate - ROTATION_THRESHOLD_START) *
      ROTATION_THRESHOLD_SCALE,
  );
  const rotationConfidence = Math.max(
    MIN_TURNING_STEP_CONFIDENCE,
    1 -
      Math.max(0, safeRotationRate - FULL_CONFIDENCE_ROTATION_RATE) /
        TURNING_CONFIDENCE_RANGE,
  );
  const filteredMagnitude =
    state.filteredMagnitude +
    (safeMagnitude - state.filteredMagnitude) * FILTER_ALPHA;
  const armed = state.armed || filteredMagnitude <= STEP_RELEASE;
  const pendingTurningStep = state.pendingTurningStep;
  if (pendingTurningStep) {
    const pendingAgeMs = nowMs - pendingTurningStep.peakAtMs;
    if (
      pendingAgeMs > 0 &&
      pendingAgeMs <= TURNING_RELEASE_MAX_MS &&
      filteredMagnitude <= STEP_RELEASE
    ) {
      return {
        detected: true,
        stepMeters: pendingTurningStep.stepMeters,
        confidence: pendingTurningStep.confidence,
        state: {
          filteredMagnitude,
          armed: true,
          lastStepAtMs: nowMs,
          pendingTurningStep: null,
        },
      };
    }
    if (pendingAgeMs >= 0 && pendingAgeMs <= TURNING_RELEASE_MAX_MS) {
      return {
        detected: false,
        stepMeters: 0,
        confidence: 0,
        state: {
          filteredMagnitude,
          armed: false,
          lastStepAtMs: state.lastStepAtMs,
          pendingTurningStep,
        },
      };
    }
  }

  const crossedTrigger =
    armed &&
    (filteredMagnitude >= STEP_TRIGGER + rotationThresholdBoost ||
      safeMagnitude >= RAW_STEP_TRIGGER + rotationThresholdBoost * 1.5);
  const intervalMs =
    state.lastStepAtMs === null ? null : nowMs - state.lastStepAtMs;
  const highRotation = safeRotationRate > TURNING_CADENCE_REQUIRED_RATE;
  const hasWalkingCadence =
    intervalMs !== null &&
    intervalMs >= MIN_STEP_INTERVAL_MS &&
    intervalMs <= MAX_TURNING_CADENCE_MS;
  if (crossedTrigger && highRotation) {
    if (hasWalkingCadence) {
      return {
        detected: false,
        stepMeters: 0,
        confidence: 0,
        state: {
          filteredMagnitude,
          armed: false,
          lastStepAtMs: state.lastStepAtMs,
          pendingTurningStep: {
            peakAtMs: nowMs,
            stepMeters: estimateStepMeters(intervalMs),
            confidence: rotationConfidence,
          },
        },
      };
    }
    return {
      detected: false,
      stepMeters: 0,
      confidence: 0,
      state: {
        filteredMagnitude,
        armed: state.armed,
        lastStepAtMs: state.lastStepAtMs,
        pendingTurningStep: null,
      },
    };
  }
  const detected =
    crossedTrigger &&
    (intervalMs === null || intervalMs >= MIN_STEP_INTERVAL_MS);

  return {
    detected,
    stepMeters: detected ? estimateStepMeters(intervalMs) : 0,
    confidence: detected ? rotationConfidence : 0,
    state: {
      filteredMagnitude,
      armed: crossedTrigger ? false : armed,
      lastStepAtMs: detected ? nowMs : state.lastStepAtMs,
      pendingTurningStep: null,
    },
  };
}

export function smoothHeadingDegrees(
  currentDegrees: number,
  targetDegrees: number,
  responsiveness = 0.8,
) {
  const factor = Math.min(1, Math.max(0, responsiveness));
  const shortestDelta = shortestHeadingDeltaDegrees(
    currentDegrees,
    targetDegrees,
  );
  return normalizeDegrees(currentDegrees + shortestDelta * factor);
}

export function adaptiveHeadingResponsiveness(
  currentDegrees: number,
  targetDegrees: number,
  elapsedMs: number,
) {
  const safeElapsedMs =
    Number.isFinite(elapsedMs) && elapsedMs > 0 ? Math.min(100, elapsedMs) : 16;
  const timeResponse = 1 - Math.exp(-safeElapsedMs / 70);
  const turnDegrees = Math.abs(
    shortestHeadingDeltaDegrees(currentDegrees, targetDegrees),
  );
  const turnResponse = Math.min(0.92, (turnDegrees / 90) * 0.75);
  return Math.min(0.95, Math.max(timeResponse, turnResponse));
}

export function createHeadingCalibrationState(
  expectedMapHeadingDegrees: number,
): HeadingCalibrationState {
  return {
    expectedMapHeadingDegrees: normalizeDegrees(expectedMapHeadingDegrees),
    samples: [],
    firstSampleAtMs: null,
    lastSampleAtMs: null,
    calibratedDeviceHeadingDegrees: null,
  };
}

export function processHeadingSample(
  state: HeadingCalibrationState,
  deviceHeadingDegrees: number,
  nowMs: number,
) {
  const eventClockReset =
    state.lastSampleAtMs !== null && nowMs < state.lastSampleAtMs - 1_000;
  if (
    !Number.isFinite(deviceHeadingDegrees) ||
    !Number.isFinite(nowMs) ||
    (state.lastSampleAtMs !== null &&
      nowMs <= state.lastSampleAtMs &&
      !eventClockReset)
  ) {
    return {
      state,
      accepted: false,
      calibrated: state.calibratedDeviceHeadingDegrees !== null,
      mapHeadingDegrees: null,
    };
  }

  const deviceHeading = normalizeDegrees(deviceHeadingDegrees);
  if (state.calibratedDeviceHeadingDegrees !== null) {
    return {
      state: { ...state, lastSampleAtMs: nowMs },
      accepted: true,
      calibrated: true,
      mapHeadingDegrees: normalizeDegrees(
        state.expectedMapHeadingDegrees +
          shortestHeadingDeltaDegrees(
            state.calibratedDeviceHeadingDegrees,
            deviceHeading,
          ),
      ),
    };
  }

  const sampleGapIsContinuous =
    state.lastSampleAtMs === null ||
    (!eventClockReset &&
      nowMs > state.lastSampleAtMs &&
      nowMs - state.lastSampleAtMs <= HEADING_SAMPLE_MAX_GAP_MS);
  const currentMean = circularMeanDegrees(state.samples);
  const sampleIsStable =
    currentMean === null ||
    Math.abs(shortestHeadingDeltaDegrees(currentMean, deviceHeading)) <=
      HEADING_STABILITY_DEGREES;
  const samples =
    sampleGapIsContinuous && sampleIsStable
      ? [...state.samples, deviceHeading]
      : [deviceHeading];
  const firstSampleAtMs =
    samples.length === 1 || state.firstSampleAtMs === null
      ? nowMs
      : state.firstSampleAtMs;
  const mean = circularMeanDegrees(samples);
  const calibrationReady =
    mean !== null &&
    samples.length >= HEADING_CALIBRATION_SAMPLES &&
    nowMs - firstSampleAtMs >= HEADING_CALIBRATION_DURATION_MS;
  const nextState: HeadingCalibrationState = {
    ...state,
    samples,
    firstSampleAtMs,
    lastSampleAtMs: nowMs,
    calibratedDeviceHeadingDegrees: calibrationReady ? mean : null,
  };

  return {
    state: nextState,
    accepted: true,
    calibrated: calibrationReady,
    mapHeadingDegrees: calibrationReady
      ? nextState.expectedMapHeadingDegrees
      : null,
  };
}
