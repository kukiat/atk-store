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
};

const STANDARD_GRAVITY = 9.81;
const FILTER_ALPHA = 0.45;
const STEP_TRIGGER = 0.8;
const RAW_STEP_TRIGGER = 1.6;
const STEP_RELEASE = 0.5;
const MIN_STEP_INTERVAL_MS = 260;
const MAX_WALKING_ROTATION_RATE = 120;
const DEFAULT_STEP_METERS = 0.68;
const MIN_STEP_METERS = 0.56;
const MAX_STEP_METERS = 0.78;

export function normalizeDegrees(value: number) {
  return ((value % 360) + 360) % 360;
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
  if (
    Number.isFinite(rotationRateDegreesPerSecond) &&
    rotationRateDegreesPerSecond > MAX_WALKING_ROTATION_RATE
  ) {
    return {
      detected: false,
      stepMeters: 0,
      state: {
        filteredMagnitude: 0,
        armed: false,
        lastStepAtMs: state.lastStepAtMs,
      },
    };
  }

  const safeMagnitude =
    Number.isFinite(magnitude) && magnitude > 0 ? magnitude : 0;
  const filteredMagnitude =
    state.filteredMagnitude +
    (safeMagnitude - state.filteredMagnitude) * FILTER_ALPHA;
  const armed = state.armed || filteredMagnitude <= STEP_RELEASE;
  const crossedTrigger =
    armed &&
    (filteredMagnitude >= STEP_TRIGGER || safeMagnitude >= RAW_STEP_TRIGGER);
  const intervalMs =
    state.lastStepAtMs === null ? null : nowMs - state.lastStepAtMs;
  const detected =
    crossedTrigger &&
    (intervalMs === null || intervalMs >= MIN_STEP_INTERVAL_MS);

  return {
    detected,
    stepMeters: detected ? estimateStepMeters(intervalMs) : 0,
    state: {
      filteredMagnitude,
      armed: crossedTrigger ? false : armed,
      lastStepAtMs: detected ? nowMs : state.lastStepAtMs,
    },
  };
}

export function smoothHeadingDegrees(
  currentDegrees: number,
  targetDegrees: number,
  responsiveness = 0.8,
) {
  const factor = Math.min(1, Math.max(0, responsiveness));
  const shortestDelta =
    ((normalizeDegrees(targetDegrees - currentDegrees) + 180) % 360) - 180;
  return normalizeDegrees(currentDegrees + shortestDelta * factor);
}
