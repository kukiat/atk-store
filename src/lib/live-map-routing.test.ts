import { describe, expect, it } from "vitest";

import {
  calculateWalkRoute,
  mapBearingDegrees,
  nearestWalkPathPoint,
} from "@/lib/live-map-routing";

describe("calculateWalkRoute", () => {
  it("follows an L-shaped walk path", () => {
    const route = calculateWalkRoute(
      [
        {
          points: [
            { x: 1, z: 4 },
            { x: 1, z: 2 },
            { x: 4, z: 2 },
          ],
        },
      ],
      { x: 1, z: 4 },
      { x: 4, z: 2 },
    );

    expect(route?.distanceMeters).toBeCloseTo(5);
    expect(route?.points).toEqual([
      { x: 1, z: 4 },
      { x: 1, z: 2 },
      { x: 4, z: 2 },
    ]);
  });

  it("connects paths that cross between their authored points", () => {
    const route = calculateWalkRoute(
      [
        {
          points: [
            { x: 0, z: 2 },
            { x: 4, z: 2 },
          ],
        },
        {
          points: [
            { x: 2, z: 0 },
            { x: 2, z: 4 },
          ],
        },
      ],
      { x: 0, z: 2 },
      { x: 2, z: 4 },
    );

    expect(route?.distanceMeters).toBeCloseTo(4);
    expect(route?.points).toEqual([
      { x: 0, z: 2 },
      { x: 2, z: 2 },
      { x: 2, z: 4 },
    ]);
  });

  it("adds short connectors when start and target are beside the path", () => {
    const route = calculateWalkRoute(
      [
        {
          points: [
            { x: 0, z: 0 },
            { x: 4, z: 0 },
          ],
        },
      ],
      { x: 0, z: 1 },
      { x: 4, z: 1 },
    );

    expect(route?.distanceMeters).toBeCloseTo(6);
    expect(route?.points).toEqual([
      { x: 0, z: 1 },
      { x: 0, z: 0 },
      { x: 4, z: 0 },
      { x: 4, z: 1 },
    ]);
  });

  it("returns null when no walk path exists", () => {
    expect(calculateWalkRoute([], { x: 0, z: 0 }, { x: 1, z: 1 })).toBeNull();
  });
});

describe("live position helpers", () => {
  it("projects an estimated position onto the nearest walk path", () => {
    expect(
      nearestWalkPathPoint(
        [
          {
            points: [
              { x: 0, z: 2 },
              { x: 5, z: 2 },
            ],
          },
        ],
        { x: 3, z: 3 },
      ),
    ).toEqual({
      point: { x: 3, z: 2 },
      distanceMeters: 1,
    });
  });

  it("uses map-up as 0 degrees and map-right as 90 degrees", () => {
    expect(mapBearingDegrees({ x: 2, z: 2 }, { x: 2, z: 1 })).toBeCloseTo(0);
    expect(mapBearingDegrees({ x: 2, z: 2 }, { x: 3, z: 2 })).toBeCloseTo(90);
    expect(mapBearingDegrees({ x: 2, z: 2 }, { x: 2, z: 3 })).toBeCloseTo(180);
  });
});
