import { describe, expect, it } from "vitest";

import { validateLiveMap } from "@/lib/live-map-validation";

describe("validateLiveMap", () => {
  it("accepts a complete connected map", () => {
    expect(
      validateLiveMap({
        boundary: [
          { x: 0, z: 0 },
          { x: 5, z: 0 },
          { x: 5, z: 5 },
          { x: 0, z: 5 },
        ],
        paths: [
          {
            id: "path-1",
            name: "Main route",
            points: [
              { x: 1, z: 4 },
              { x: 1, z: 1 },
              { x: 4, z: 1 },
            ],
          },
        ],
        anchors: [
          {
            id: "anchor-1",
            code: "ENT1",
            startX: 1,
            startZ: 4,
          },
        ],
        locations: [
          {
            id: "location-1",
            inventoryName: "Product",
            x: 4,
            z: 1,
          },
        ],
      }),
    ).toEqual([]);
  });

  it("reports missing required map features", () => {
    const issues = validateLiveMap({
      boundary: [],
      paths: [],
      anchors: [],
      locations: [],
    });

    expect(issues.map((issue) => issue.code)).toEqual([
      "boundary-missing",
      "path-missing",
      "anchor-missing",
      "location-missing",
    ]);
  });

  it("warns when a destination is far from the walk path", () => {
    const issues = validateLiveMap({
      boundary: [
        { x: 0, z: 0 },
        { x: 5, z: 0 },
        { x: 5, z: 5 },
      ],
      paths: [
        {
          id: "path-1",
          name: "Main route",
          points: [
            { x: 0, z: 0 },
            { x: 5, z: 0 },
          ],
        },
      ],
      anchors: [
        {
          id: "anchor-1",
          code: "ENT1",
          startX: 0,
          startZ: 0,
        },
      ],
      locations: [
        {
          id: "location-1",
          inventoryName: "Product",
          x: 5,
          z: 2,
        },
      ],
    });

    expect(issues).toEqual([
      expect.objectContaining({
        severity: "warning",
        code: "location-away-from-path:location-1",
      }),
    ]);
  });
});
