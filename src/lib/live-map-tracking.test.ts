import { describe, expect, it } from "vitest";

import {
  createArrivalTrackerState,
  destinationDistanceMeters,
  updateArrivalTracker,
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
