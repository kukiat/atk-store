export type TrackingPoint = {
  x: number;
  z: number;
};

export type ArrivalTrackerState = {
  arrived: boolean;
  candidateSinceMs: number | null;
  lastSampleAtMs: number | null;
};

export const ARRIVAL_ENTRY_METERS = 0.45;
export const ARRIVAL_EXIT_METERS = 0.9;
export const ARRIVAL_CONFIRMATION_MS = 1_200;
export const PATH_SNAP_METERS = 0.55;
const MAX_CONFIRMATION_SAMPLE_GAP_MS = 500;

export function destinationDistanceMeters(
  position: TrackingPoint,
  destination: TrackingPoint,
) {
  return Math.hypot(destination.x - position.x, destination.z - position.z);
}

export function createArrivalTrackerState(
  arrived = false,
): ArrivalTrackerState {
  return {
    arrived,
    candidateSinceMs: null,
    lastSampleAtMs: null,
  };
}

export function updateArrivalTracker(
  state: ArrivalTrackerState,
  distanceMeters: number,
  nowMs: number,
): ArrivalTrackerState {
  if (
    !Number.isFinite(distanceMeters) ||
    distanceMeters < 0 ||
    !Number.isFinite(nowMs)
  ) {
    return state.arrived ? state : createArrivalTrackerState();
  }

  if (state.arrived) {
    if (distanceMeters > ARRIVAL_EXIT_METERS) {
      return createArrivalTrackerState();
    }
    return {
      arrived: true,
      candidateSinceMs: null,
      lastSampleAtMs: nowMs,
    };
  }

  if (distanceMeters > ARRIVAL_ENTRY_METERS) {
    return {
      arrived: false,
      candidateSinceMs: null,
      lastSampleAtMs: nowMs,
    };
  }

  const callbacksAreContinuous =
    state.candidateSinceMs !== null &&
    state.lastSampleAtMs !== null &&
    nowMs >= state.lastSampleAtMs &&
    nowMs - state.lastSampleAtMs <= MAX_CONFIRMATION_SAMPLE_GAP_MS;
  const candidateSinceMs =
    callbacksAreContinuous && state.candidateSinceMs !== null
      ? state.candidateSinceMs
      : nowMs;
  if (nowMs - candidateSinceMs < ARRIVAL_CONFIRMATION_MS) {
    return {
      arrived: false,
      candidateSinceMs,
      lastSampleAtMs: nowMs,
    };
  }

  return createArrivalTrackerState(true);
}
