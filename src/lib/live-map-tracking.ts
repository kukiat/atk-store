export type TrackingPoint = {
  x: number;
  z: number;
};

export type ArrivalTrackerState = {
  arrived: boolean;
  candidateSinceMs: number | null;
  lastSampleAtMs: number | null;
};

export type RouteProgressState = {
  progressMeters: number;
  totalDistanceMeters: number;
  lateralMeters: number;
  crossTrackMeters: number;
  residual: TrackingPoint;
  matchedPosition: TrackingPoint;
  estimatedPosition: TrackingPoint;
  remainingDistanceMeters: number;
  routeBearingDegrees: number;
};

export type OffRouteTrackerState = {
  offRoute: boolean;
  enterSamples: number;
  exitSamples: number;
};

export const ARRIVAL_ENTRY_METERS = 0.45;
export const ARRIVAL_EXIT_METERS = 0.9;
export const ARRIVAL_CONFIRMATION_MS = 1_200;
export const PATH_SNAP_METERS = 0.55;
export const OFF_ROUTE_ENTER_METERS = 1.1;
export const OFF_ROUTE_EXIT_METERS = 0.65;
const MAX_CONFIRMATION_SAMPLE_GAP_MS = 500;
const OFF_ROUTE_ENTER_SAMPLES = 3;
const OFF_ROUTE_EXIT_SAMPLES = 2;
const ROUTE_LOOK_AHEAD_METERS = 0.8;
const MAX_RESIDUAL_METERS = 2.5;
const RESIDUAL_RETENTION_PER_STEP = 0.9;
const EPSILON = 1e-7;

type RouteSegment = {
  start: TrackingPoint;
  end: TrackingPoint;
  startDistanceMeters: number;
  lengthMeters: number;
  tangent: TrackingPoint;
};

function normalizeDegrees(value: number) {
  return ((value % 360) + 360) % 360;
}

function routeGeometry(points: TrackingPoint[]) {
  const routePoints: TrackingPoint[] = [];
  for (const point of points) {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.z)) continue;
    const previous = routePoints.at(-1);
    if (
      !previous ||
      Math.hypot(point.x - previous.x, point.z - previous.z) > EPSILON
    ) {
      routePoints.push(point);
    }
  }
  const segments: RouteSegment[] = [];
  let totalDistanceMeters = 0;
  for (let index = 0; index < routePoints.length - 1; index += 1) {
    const start = routePoints[index]!;
    const end = routePoints[index + 1]!;
    const dx = end.x - start.x;
    const dz = end.z - start.z;
    const lengthMeters = Math.hypot(dx, dz);
    if (lengthMeters <= EPSILON) continue;
    segments.push({
      start,
      end,
      startDistanceMeters: totalDistanceMeters,
      lengthMeters,
      tangent: { x: dx / lengthMeters, z: dz / lengthMeters },
    });
    totalDistanceMeters += lengthMeters;
  }
  return { routePoints, segments, totalDistanceMeters };
}

function matchedPointAtProgress(
  geometry: ReturnType<typeof routeGeometry>,
  progressMeters: number,
) {
  const fallback = geometry.routePoints[0] ?? { x: 0, z: 0 };
  if (geometry.segments.length === 0) return fallback;
  const distanceMeters = Math.min(
    geometry.totalDistanceMeters,
    Math.max(0, progressMeters),
  );
  const segment =
    geometry.segments.find(
      (candidate) =>
        distanceMeters <=
        candidate.startDistanceMeters + candidate.lengthMeters + EPSILON,
    ) ?? geometry.segments.at(-1)!;
  const alongSegment = Math.min(
    segment.lengthMeters,
    Math.max(0, distanceMeters - segment.startDistanceMeters),
  );
  return {
    x: segment.start.x + segment.tangent.x * alongSegment,
    z: segment.start.z + segment.tangent.z * alongSegment,
  };
}

function routeTangentAtProgress(
  geometry: ReturnType<typeof routeGeometry>,
  progressMeters: number,
) {
  if (geometry.segments.length === 0) return { x: 0, z: -1 };
  const current = matchedPointAtProgress(geometry, progressMeters);
  const ahead = matchedPointAtProgress(
    geometry,
    progressMeters + ROUTE_LOOK_AHEAD_METERS,
  );
  const aheadDx = ahead.x - current.x;
  const aheadDz = ahead.z - current.z;
  const aheadLength = Math.hypot(aheadDx, aheadDz);
  if (aheadLength > EPSILON) {
    return { x: aheadDx / aheadLength, z: aheadDz / aheadLength };
  }

  const behind = matchedPointAtProgress(
    geometry,
    progressMeters - ROUTE_LOOK_AHEAD_METERS,
  );
  const behindDx = current.x - behind.x;
  const behindDz = current.z - behind.z;
  const behindLength = Math.hypot(behindDx, behindDz);
  if (behindLength > EPSILON) {
    return { x: behindDx / behindLength, z: behindDz / behindLength };
  }
  return geometry.segments.at(-1)!.tangent;
}

function bearingFromTangent(tangent: TrackingPoint) {
  return normalizeDegrees((Math.atan2(tangent.x, -tangent.z) * 180) / Math.PI);
}

function boundedVector(vector: TrackingPoint, maxMagnitude: number) {
  const magnitude = Math.hypot(vector.x, vector.z);
  if (magnitude <= maxMagnitude || magnitude <= EPSILON) return vector;
  const scale = maxMagnitude / magnitude;
  return { x: vector.x * scale, z: vector.z * scale };
}

function routeProgressState(
  geometry: ReturnType<typeof routeGeometry>,
  progressMeters: number,
  residual: TrackingPoint,
): RouteProgressState {
  const matchedPosition = matchedPointAtProgress(geometry, progressMeters);
  const tangent = routeTangentAtProgress(geometry, progressMeters);
  const boundedResidual = boundedVector(residual, MAX_RESIDUAL_METERS);
  const lateralMeters =
    tangent.x * boundedResidual.z - tangent.z * boundedResidual.x;
  const crossTrackMeters = Math.abs(lateralMeters);
  return {
    progressMeters,
    totalDistanceMeters: geometry.totalDistanceMeters,
    lateralMeters,
    crossTrackMeters,
    residual: boundedResidual,
    matchedPosition,
    estimatedPosition: {
      x: matchedPosition.x + boundedResidual.x,
      z: matchedPosition.z + boundedResidual.z,
    },
    remainingDistanceMeters: Math.hypot(
      Math.abs(geometry.totalDistanceMeters - progressMeters),
      crossTrackMeters,
    ),
    routeBearingDegrees: bearingFromTangent(tangent),
  };
}

export function createRouteProgressState(
  routePoints: TrackingPoint[],
  progressMeters = 0,
) {
  const geometry = routeGeometry(routePoints);
  const safeProgress = Number.isFinite(progressMeters) ? progressMeters : 0;
  return routeProgressState(geometry, safeProgress, { x: 0, z: 0 });
}

export function updateRouteProgress(
  routePoints: TrackingPoint[],
  state: RouteProgressState,
  stepMeters: number,
  mapHeadingDegrees: number,
  confidence = 1,
) {
  if (
    !Number.isFinite(stepMeters) ||
    stepMeters <= 0 ||
    !Number.isFinite(mapHeadingDegrees) ||
    !Number.isFinite(confidence) ||
    confidence <= 0
  ) {
    return state;
  }

  const geometry = routeGeometry(routePoints);
  if (geometry.segments.length === 0) return state;
  const effectiveStepMeters = stepMeters * Math.min(1, Math.max(0, confidence));
  const radians = (normalizeDegrees(mapHeadingDegrees) * Math.PI) / 180;
  const stepVector = {
    x: Math.sin(radians) * effectiveStepMeters,
    z: -Math.cos(radians) * effectiveStepMeters,
  };
  const tangent = routeTangentAtProgress(geometry, state.progressMeters);
  const progressDelta = Math.min(
    effectiveStepMeters,
    Math.max(
      -effectiveStepMeters,
      stepVector.x * tangent.x + stepVector.z * tangent.z,
    ),
  );
  const nextProgressMeters = state.progressMeters + progressDelta;
  const previousMatchedPosition = matchedPointAtProgress(
    geometry,
    state.progressMeters,
  );
  const nextMatchedPosition = matchedPointAtProgress(
    geometry,
    nextProgressMeters,
  );
  const residual = {
    x:
      state.residual.x * RESIDUAL_RETENTION_PER_STEP +
      stepVector.x -
      (nextMatchedPosition.x - previousMatchedPosition.x),
    z:
      state.residual.z * RESIDUAL_RETENTION_PER_STEP +
      stepVector.z -
      (nextMatchedPosition.z - previousMatchedPosition.z),
  };
  return routeProgressState(geometry, nextProgressMeters, residual);
}

export function createOffRouteTrackerState(
  offRoute = false,
): OffRouteTrackerState {
  return { offRoute, enterSamples: 0, exitSamples: 0 };
}

export function updateOffRouteTracker(
  state: OffRouteTrackerState,
  crossTrackMeters: number,
): OffRouteTrackerState {
  if (!Number.isFinite(crossTrackMeters) || crossTrackMeters < 0) return state;
  if (!state.offRoute) {
    const enterSamples =
      crossTrackMeters > OFF_ROUTE_ENTER_METERS ? state.enterSamples + 1 : 0;
    return {
      offRoute: enterSamples >= OFF_ROUTE_ENTER_SAMPLES,
      enterSamples: enterSamples >= OFF_ROUTE_ENTER_SAMPLES ? 0 : enterSamples,
      exitSamples: 0,
    };
  }

  const exitSamples =
    crossTrackMeters < OFF_ROUTE_EXIT_METERS ? state.exitSamples + 1 : 0;
  return {
    offRoute: exitSamples < OFF_ROUTE_EXIT_SAMPLES,
    enterSamples: 0,
    exitSamples: exitSamples >= OFF_ROUTE_EXIT_SAMPLES ? 0 : exitSamples,
  };
}

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
