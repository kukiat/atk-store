import { describe, expect, it } from "vitest";

import {
  createArrivalTrackerState,
  createOffRouteTrackerState,
  createRouteProgressState,
  destinationDistanceMeters,
  updateArrivalTracker,
  updateOffRouteTracker,
  updateRouteProgress,
} from "@/lib/live-map-tracking";

describe("destinationDistanceMeters", () => {
  it("keeps lateral error that path projection would otherwise discard", () => {
    const rawDistance = destinationDistanceMeters(
      { x: 4.3, z: 0.6 },
      { x: 5, z: 0 },
    );
    let state = updateArrivalTracker(
      createArrivalTrackerState(),
      rawDistance,
      1_000,
    );
    state = updateArrivalTracker(state, rawDistance, 3_000);

    expect(rawDistance).toBeCloseTo(0.92, 2);
    expect(state.arrived).toBe(false);
  });
});

describe("updateArrivalTracker", () => {
  it("requires the raw position to remain inside the entry radius", () => {
    let state = createArrivalTrackerState();

    state = updateArrivalTracker(state, 0.4, 1_000);
    expect(state.arrived).toBe(false);

    state = updateArrivalTracker(state, 0.4, 1_400);
    state = updateArrivalTracker(state, 0.4, 1_800);
    state = updateArrivalTracker(state, 0.4, 2_199);
    expect(state.arrived).toBe(false);

    state = updateArrivalTracker(state, 0.4, 2_200);
    expect(state.arrived).toBe(true);
  });

  it("restarts confirmation after sensor callbacks pause", () => {
    let state = createArrivalTrackerState();

    state = updateArrivalTracker(state, 0.4, 1_000);
    state = updateArrivalTracker(state, 0.4, 1_400);
    state = updateArrivalTracker(state, 0.4, 2_001);
    state = updateArrivalTracker(state, 0.4, 2_401);
    state = updateArrivalTracker(state, 0.4, 2_801);
    expect(state.arrived).toBe(false);

    state = updateArrivalTracker(state, 0.4, 3_201);
    expect(state.arrived).toBe(true);
  });

  it("cancels confirmation when the position leaves the entry radius", () => {
    let state = updateArrivalTracker(createArrivalTrackerState(), 0.4, 1_000);
    state = updateArrivalTracker(state, 0.6, 1_500);
    state = updateArrivalTracker(state, 0.4, 2_000);
    state = updateArrivalTracker(state, 0.4, 2_400);
    state = updateArrivalTracker(state, 0.4, 2_700);

    expect(state.arrived).toBe(false);
  });

  it("uses a wider exit radius to avoid arrival flicker", () => {
    let state = createArrivalTrackerState(true);

    state = updateArrivalTracker(state, 0.7, 2_000);
    expect(state.arrived).toBe(true);

    state = updateArrivalTracker(state, 0.91, 2_100);
    expect(state.arrived).toBe(false);
  });

  it("does not confirm arrival from invalid distance data", () => {
    const candidate = updateArrivalTracker(
      createArrivalTrackerState(),
      0.4,
      1_000,
    );

    expect(updateArrivalTracker(candidate, Number.NaN, 3_000)).toEqual(
      createArrivalTrackerState(),
    );
  });
});

describe("route-relative progress", () => {
  const route = [
    { x: 0, z: 0 },
    { x: 5, z: 0 },
  ];

  it("reduces distance while walking forward and increases it walking backward", () => {
    const initial = createRouteProgressState(route);
    const forward = updateRouteProgress(route, initial, 0.7, 90);
    const backward = updateRouteProgress(route, forward, 0.7, 270);

    expect(initial.remainingDistanceMeters).toBeCloseTo(5);
    expect(forward.remainingDistanceMeters).toBeCloseTo(4.3);
    expect(backward.remainingDistanceMeters).toBeCloseTo(5);
  });

  it("keeps sideways movement as lateral error instead of route teleportation", () => {
    const result = updateRouteProgress(
      route,
      createRouteProgressState(route),
      0.7,
      180,
    );

    expect(result.progressMeters).toBeCloseTo(0);
    expect(Math.abs(result.lateralMeters)).toBeCloseTo(0.7);
    expect(result.remainingDistanceMeters).toBeGreaterThan(5);
    expect(result.matchedPosition.x).toBeCloseTo(0);
    expect(result.matchedPosition.z).toBeCloseTo(0);
  });

  it("allows walking past the destination to clear arrival distance", () => {
    const atDestination = createRouteProgressState(route, 5);
    const pastDestination = updateRouteProgress(route, atDestination, 0.7, 90);

    expect(atDestination.remainingDistanceMeters).toBeCloseTo(0);
    expect(pastDestination.progressMeters).toBeCloseTo(5.7);
    expect(pastDestination.remainingDistanceMeters).toBeCloseTo(0.7);
    expect(pastDestination.estimatedPosition.x).toBeCloseTo(5.7);
    expect(pastDestination.residual.x).toBeCloseTo(0);
  });

  it("points back toward the destination after walking past the route end", () => {
    const pastDestination = createRouteProgressState(route, 5.7);
    const returning = updateRouteProgress(route, pastDestination, 0.4, 270);

    expect(pastDestination.routeBearingDegrees).toBeCloseTo(90);
    expect(pastDestination.navigationBearingDegrees).toBeCloseTo(270);
    expect(returning.remainingDistanceMeters).toBeLessThan(
      pastDestination.remainingDistanceMeters,
    );
  });

  it("keeps the first segment bearing before the route start", () => {
    const multiSegmentRoute = [
      { x: 0, z: 0 },
      { x: 2, z: 0 },
      { x: 2, z: -2 },
    ];
    const beforeStart = createRouteProgressState(multiSegmentRoute, -1);
    const approachingStart = updateRouteProgress(
      multiSegmentRoute,
      beforeStart,
      0.4,
      90,
    );

    expect(beforeStart.routeBearingDegrees).toBeCloseTo(90);
    expect(beforeStart.navigationBearingDegrees).toBeCloseTo(90);
    expect(approachingStart.remainingDistanceMeters).toBeLessThan(
      beforeStart.remainingDistanceMeters,
    );
    expect(approachingStart.estimatedPosition.x).toBeCloseTo(-0.6);
    expect(approachingStart.residual.x).toBeCloseTo(0);
  });

  it("uses the next segment bearing after reaching a corner", () => {
    const cornerRoute = [
      { x: 0, z: 0 },
      { x: 2, z: 0 },
      { x: 2, z: -2 },
    ];
    const atCorner = createRouteProgressState(cornerRoute, 2);
    const afterTurn = updateRouteProgress(cornerRoute, atCorner, 0.7, 0);

    expect(afterTurn.progressMeters).toBeCloseTo(2.7);
    expect(afterTurn.matchedPosition.x).toBeCloseTo(2);
    expect(afterTurn.matchedPosition.z).toBeCloseTo(-0.7);
  });

  it("increases distance when walking opposite either leg of the production L route", () => {
    const productionRoute = [
      { x: 0.99, z: 3.6 },
      { x: 0.99, z: 0.99 },
      { x: 3.65, z: 0.99 },
    ];
    const atStart = createRouteProgressState(productionRoute);
    const awayFromFirstLeg = updateRouteProgress(
      productionRoute,
      atStart,
      0.7,
      180,
    );
    const atCorner = createRouteProgressState(productionRoute, 2.61);
    const awayFromSecondLeg = updateRouteProgress(
      productionRoute,
      atCorner,
      0.7,
      270,
    );

    expect(atStart.navigationBearingDegrees).toBeCloseTo(0);
    expect(awayFromFirstLeg.remainingDistanceMeters).toBeGreaterThan(
      atStart.remainingDistanceMeters,
    );
    expect(atCorner.navigationBearingDegrees).toBeCloseTo(90);
    expect(awayFromSecondLeg.remainingDistanceMeters).toBeGreaterThan(
      atCorner.remainingDistanceMeters,
    );
  });

  it("continues progressing when the customer starts turning before a corner", () => {
    const cornerRoute = [
      { x: 0, z: 0 },
      { x: 2, z: 0 },
      { x: 2, z: -2 },
    ];
    const beforeCorner = createRouteProgressState(cornerRoute, 1.7);
    const earlyTurn = updateRouteProgress(cornerRoute, beforeCorner, 0.7, 0);

    expect(earlyTurn.progressMeters).toBeGreaterThan(
      beforeCorner.progressMeters,
    );
    expect(
      earlyTurn.progressMeters - beforeCorner.progressMeters,
    ).toBeLessThanOrEqual(0.7);
  });

  it("crosses short adjacent segments without moving farther than one step", () => {
    const shortSegments = [
      { x: 0, z: 0 },
      { x: 1, z: 0 },
      { x: 1, z: -0.2 },
      { x: 2, z: -0.2 },
    ];
    const beforeShortSegment = createRouteProgressState(shortSegments, 0.9);
    const result = updateRouteProgress(
      shortSegments,
      beforeShortSegment,
      0.7,
      60,
    );
    const delta = result.progressMeters - beforeShortSegment.progressMeters;

    expect(delta).toBeGreaterThan(0);
    expect(delta).toBeLessThanOrEqual(0.7);
    expect(result.matchedPosition.x).toBeGreaterThanOrEqual(0);
    expect(result.matchedPosition.x).toBeLessThanOrEqual(2);
  });

  it("reduces a 2D lateral residual when walking back toward the route", () => {
    const offPath = updateRouteProgress(
      route,
      createRouteProgressState(route),
      0.7,
      180,
    );
    const recovered = updateRouteProgress(route, offPath, 0.7, 0);

    expect(offPath.crossTrackMeters).toBeCloseTo(0.7);
    expect(recovered.crossTrackMeters).toBeLessThan(offPath.crossTrackMeters);
    expect(recovered.crossTrackMeters).toBeLessThan(0.1);
  });

  it("guides an off-route customer diagonally back toward the route", () => {
    const offPath = updateRouteProgress(
      route,
      createRouteProgressState(route),
      0.7,
      180,
    );
    const followingGuidance = updateRouteProgress(
      route,
      offPath,
      0.4,
      offPath.navigationBearingDegrees,
    );

    expect(offPath.routeBearingDegrees).toBeCloseTo(90);
    expect(offPath.navigationBearingDegrees).toBeGreaterThan(0);
    expect(offPath.navigationBearingDegrees).toBeLessThan(90);
    expect(followingGuidance.remainingDistanceMeters).toBeLessThan(
      offPath.remainingDistanceMeters,
    );
  });

  it("fails safely for empty, one-point, and duplicate-only routes", () => {
    const empty = createRouteProgressState([]);
    const onePoint = createRouteProgressState([{ x: 2, z: 3 }]);
    const duplicateOnly = createRouteProgressState([
      { x: 2, z: 3 },
      { x: 2, z: 3 },
    ]);
    const invalidPrefix = createRouteProgressState([
      { x: Number.NaN, z: Number.NaN },
      { x: 2, z: 3 },
      { x: 3, z: 3 },
    ]);

    expect(empty.totalDistanceMeters).toBe(0);
    expect(empty.remainingDistanceMeters).toBe(0);
    expect(onePoint.matchedPosition).toEqual({ x: 2, z: 3 });
    expect(duplicateOnly.totalDistanceMeters).toBe(0);
    expect(invalidPrefix.totalDistanceMeters).toBeCloseTo(1);
    expect(updateRouteProgress([], empty, 0.7, 90)).toEqual(empty);
  });

  it("bounds progress contribution by confidence-weighted step length", () => {
    const result = updateRouteProgress(
      route,
      createRouteProgressState(route),
      0.7,
      90,
      0.6,
    );

    expect(result.progressMeters).toBeCloseTo(0.42);
  });

  it("credits only the forward component of an approximate heading", () => {
    const result = updateRouteProgress(
      route,
      createRouteProgressState(route),
      0.7,
      45,
    );

    expect(result.progressMeters).toBeGreaterThan(0);
    expect(result.progressMeters).toBeLessThan(0.7);
    expect(result.progressMeters).toBeCloseTo(0.7 * Math.SQRT1_2);
  });

  it("confirms at the route end and clears after enough reverse progress", () => {
    let progress = createRouteProgressState(route, 5);
    let arrival = createArrivalTrackerState();
    for (const nowMs of [1_000, 1_400, 1_800, 2_200]) {
      arrival = updateArrivalTracker(
        arrival,
        progress.remainingDistanceMeters,
        nowMs,
      );
    }
    expect(arrival.arrived).toBe(true);

    progress = updateRouteProgress(route, progress, 0.7, 270);
    arrival = updateArrivalTracker(
      arrival,
      progress.remainingDistanceMeters,
      2_500,
    );
    expect(arrival.arrived).toBe(true);

    progress = updateRouteProgress(route, progress, 0.4, 270);
    arrival = updateArrivalTracker(
      arrival,
      progress.remainingDistanceMeters,
      2_900,
    );
    expect(arrival.arrived).toBe(false);
  });
});

describe("off-route hysteresis", () => {
  it("requires sustained evidence to enter and consecutive recovery samples to clear", () => {
    let state = createOffRouteTrackerState();

    state = updateOffRouteTracker(state, 1.2);
    state = updateOffRouteTracker(state, 1.2);
    expect(state.offRoute).toBe(false);

    state = updateOffRouteTracker(state, 1.2);
    expect(state.offRoute).toBe(true);

    state = updateOffRouteTracker(state, 0.6);
    expect(state.offRoute).toBe(true);

    state = updateOffRouteTracker(state, 0.6);
    expect(state.offRoute).toBe(false);
  });

  it("resets partial evidence when the estimate returns to the neutral band", () => {
    let state = updateOffRouteTracker(createOffRouteTrackerState(), 1.2);
    state = updateOffRouteTracker(state, 0.8);
    state = updateOffRouteTracker(state, 1.2);

    expect(state.offRoute).toBe(false);
    expect(state.enterSamples).toBe(1);
  });
});
