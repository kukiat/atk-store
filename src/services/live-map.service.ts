import "server-only";

import crypto from "node:crypto";

import { and, asc, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import {
  inventories,
  inventoryNavigationLocations,
  navigationAnchors,
  navigationFloors,
  navigationPaths,
  navigationRestrictedAreas,
} from "@/db/schema";
import { generateQrDataUrl } from "@/lib/qr-image";
import type { AdminActor } from "@/services/admin-user.service";

export type MapPoint = { x: number; z: number };

export type LiveMapData = {
  floors: Array<{ id: string; code: string; name: string }>;
  floor: {
    id: string;
    code: string;
    name: string;
    widthMeters: number;
    lengthMeters: number;
    boundary: MapPoint[];
  } | null;
  anchors: Array<{
    id: string;
    publicToken: string;
    code: string;
    name: string;
    x: number;
    z: number;
    heightMeters: number;
    widthMeters: number;
    signHeightMeters: number;
    yawDegrees: number;
    startX: number;
    startZ: number;
    qrUrl: string;
    qrImageDataUrl: string;
  }>;
  paths: Array<{ id: string; name: string; points: MapPoint[] }>;
  restrictedAreas: Array<{ id: string; name: string; polygon: MapPoint[] }>;
  locations: Array<{
    id: string;
    inventoryId: string;
    inventoryName: string;
    label: string;
    x: number;
    z: number;
  }>;
  inventories: Array<{ id: string; name: string }>;
};

export type CustomerLiveMapData = {
  floor: {
    id: string;
    name: string;
    widthMeters: number;
    lengthMeters: number;
    boundary: MapPoint[];
  };
  anchor: {
    code: string;
    name: string;
    start: MapPoint;
  };
  paths: Array<{ id: string; name: string; points: MapPoint[] }>;
  restrictedAreas: Array<{ id: string; name: string; polygon: MapPoint[] }>;
  destinations: Array<{
    id: string;
    inventoryId: string;
    inventoryName: string;
    label: string;
    x: number;
    z: number;
  }>;
};

function requireNavigationPermission(actor: AdminActor) {
  if (!actor.permissions.canAccessAdmin) {
    throw new Error("Admin permission is required");
  }
}

function readText(formData: FormData, key: string): string {
  const value = formData.get(key);
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${key} is required`);
  }
  return value.trim();
}

function readNumber(formData: FormData, key: string): number {
  const value = Number(readText(formData, key));
  if (!Number.isFinite(value)) throw new Error(`${key} must be a number`);
  return value;
}

function readPositiveNumber(formData: FormData, key: string): number {
  const value = readNumber(formData, key);
  if (value <= 0) throw new Error(`${key} must be greater than zero`);
  return value;
}

function readPoints(
  formData: FormData,
  key: string,
  minimum: number,
): MapPoint[] {
  const raw = readText(formData, key);
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error(`${key} must be valid JSON`);
  }

  if (!Array.isArray(value) || value.length < minimum) {
    throw new Error(`${key} must contain at least ${minimum} points`);
  }

  return value.map((point) => {
    if (
      !point ||
      typeof point !== "object" ||
      !Number.isFinite((point as MapPoint).x) ||
      !Number.isFinite((point as MapPoint).z)
    ) {
      throw new Error(`${key} contains an invalid point`);
    }
    return { x: (point as MapPoint).x, z: (point as MapPoint).z };
  });
}

function asPoints(value: unknown): MapPoint[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((point) => {
    if (
      point &&
      typeof point === "object" &&
      Number.isFinite((point as MapPoint).x) &&
      Number.isFinite((point as MapPoint).z)
    ) {
      return [{ x: (point as MapPoint).x, z: (point as MapPoint).z }];
    }
    return [];
  });
}

class LiveMapService {
  async getData(actor: AdminActor): Promise<LiveMapData> {
    requireNavigationPermission(actor);

    const [floors, inventoryRows] = await Promise.all([
      db
        .select({
          id: navigationFloors.id,
          code: navigationFloors.code,
          name: navigationFloors.name,
          widthMeters: navigationFloors.widthMeters,
          lengthMeters: navigationFloors.lengthMeters,
          boundary: navigationFloors.boundary,
          isActive: navigationFloors.isActive,
        })
        .from(navigationFloors)
        .where(isNull(navigationFloors.deletedAt))
        .orderBy(asc(navigationFloors.code)),
      db
        .select({ id: inventories.id, name: inventories.name })
        .from(inventories)
        .where(
          and(isNull(inventories.deletedAt), eq(inventories.isActive, true)),
        )
        .orderBy(asc(inventories.name)),
    ]);

    const selectedFloor = floors.find((floor) => floor.isActive) ?? floors[0];
    if (!selectedFloor) {
      return {
        floors: [],
        floor: null,
        anchors: [],
        paths: [],
        restrictedAreas: [],
        locations: [],
        inventories: inventoryRows,
      };
    }

    const [anchorRows, paths, restrictedAreas, locations] = await Promise.all([
      db
        .select({
          id: navigationAnchors.id,
          publicToken: navigationAnchors.publicToken,
          code: navigationAnchors.code,
          name: navigationAnchors.name,
          x: navigationAnchors.x,
          z: navigationAnchors.z,
          heightMeters: navigationAnchors.heightMeters,
          widthMeters: navigationAnchors.widthMeters,
          signHeightMeters: navigationAnchors.signHeightMeters,
          yawDegrees: navigationAnchors.yawDegrees,
          startX: navigationAnchors.startX,
          startZ: navigationAnchors.startZ,
        })
        .from(navigationAnchors)
        .where(
          and(
            eq(navigationAnchors.floorId, selectedFloor.id),
            isNull(navigationAnchors.deletedAt),
            eq(navigationAnchors.isActive, true),
          ),
        )
        .orderBy(asc(navigationAnchors.code)),
      db
        .select({
          id: navigationPaths.id,
          name: navigationPaths.name,
          points: navigationPaths.points,
        })
        .from(navigationPaths)
        .where(
          and(
            eq(navigationPaths.floorId, selectedFloor.id),
            isNull(navigationPaths.deletedAt),
            eq(navigationPaths.isActive, true),
          ),
        )
        .orderBy(asc(navigationPaths.name)),
      db
        .select({
          id: navigationRestrictedAreas.id,
          name: navigationRestrictedAreas.name,
          polygon: navigationRestrictedAreas.polygon,
        })
        .from(navigationRestrictedAreas)
        .where(
          and(
            eq(navigationRestrictedAreas.floorId, selectedFloor.id),
            isNull(navigationRestrictedAreas.deletedAt),
          ),
        )
        .orderBy(asc(navigationRestrictedAreas.name)),
      db
        .select({
          id: inventoryNavigationLocations.id,
          inventoryId: inventoryNavigationLocations.inventoryId,
          inventoryName: inventories.name,
          label: inventoryNavigationLocations.label,
          x: inventoryNavigationLocations.x,
          z: inventoryNavigationLocations.z,
        })
        .from(inventoryNavigationLocations)
        .innerJoin(
          inventories,
          eq(inventoryNavigationLocations.inventoryId, inventories.id),
        )
        .where(
          and(
            eq(inventoryNavigationLocations.floorId, selectedFloor.id),
            isNull(inventoryNavigationLocations.deletedAt),
            eq(inventoryNavigationLocations.isActive, true),
            isNull(inventories.deletedAt),
          ),
        )
        .orderBy(asc(inventories.name)),
    ]);

    const authUrl = (process.env.AUTH_URL ?? "http://localhost:3000").replace(
      /\/+$/,
      "",
    );
    const anchors = await Promise.all(
      anchorRows.map(async (anchor) => {
        const qrUrl = `${authUrl}/live-map/start/${anchor.publicToken}`;
        return {
          ...anchor,
          qrUrl,
          qrImageDataUrl: await generateQrDataUrl(qrUrl),
        };
      }),
    );

    return {
      floors: floors.map(({ id, code, name }) => ({ id, code, name })),
      floor: {
        id: selectedFloor.id,
        code: selectedFloor.code,
        name: selectedFloor.name,
        widthMeters: selectedFloor.widthMeters,
        lengthMeters: selectedFloor.lengthMeters,
        boundary: asPoints(selectedFloor.boundary),
      },
      anchors,
      paths: paths.map((path) => ({ ...path, points: asPoints(path.points) })),
      restrictedAreas: restrictedAreas.map((area) => ({
        ...area,
        polygon: asPoints(area.polygon),
      })),
      locations,
      inventories: inventoryRows,
    };
  }

  async createFloor(actor: AdminActor, formData: FormData): Promise<void> {
    requireNavigationPermission(actor);
    await db.insert(navigationFloors).values({
      code: readText(formData, "code").toUpperCase(),
      name: readText(formData, "name"),
      widthMeters: readPositiveNumber(formData, "widthMeters"),
      lengthMeters: readPositiveNumber(formData, "lengthMeters"),
      boundary: [],
      updatedAt: new Date(),
    });
  }

  async updateFloor(actor: AdminActor, formData: FormData): Promise<void> {
    requireNavigationPermission(actor);
    await db
      .update(navigationFloors)
      .set({
        name: readText(formData, "name"),
        widthMeters: readPositiveNumber(formData, "widthMeters"),
        lengthMeters: readPositiveNumber(formData, "lengthMeters"),
        updatedAt: new Date(),
      })
      .where(eq(navigationFloors.id, readText(formData, "floorId")));
  }

  async saveBoundary(actor: AdminActor, formData: FormData): Promise<void> {
    requireNavigationPermission(actor);
    await db
      .update(navigationFloors)
      .set({
        boundary: readPoints(formData, "points", 3),
        updatedAt: new Date(),
      })
      .where(eq(navigationFloors.id, readText(formData, "floorId")));
  }

  async createAnchor(actor: AdminActor, formData: FormData): Promise<void> {
    requireNavigationPermission(actor);
    await db.insert(navigationAnchors).values({
      floorId: readText(formData, "floorId"),
      publicToken: crypto.randomBytes(32).toString("base64url"),
      code: readText(formData, "code").toUpperCase(),
      name: readText(formData, "name"),
      x: readNumber(formData, "x"),
      z: readNumber(formData, "z"),
      heightMeters: readPositiveNumber(formData, "heightMeters"),
      widthMeters: readPositiveNumber(formData, "widthMeters"),
      signHeightMeters: readPositiveNumber(formData, "signHeightMeters"),
      yawDegrees: readNumber(formData, "yawDegrees"),
      startX: readNumber(formData, "startX"),
      startZ: readNumber(formData, "startZ"),
      updatedAt: new Date(),
    });
  }

  async updateAnchor(actor: AdminActor, formData: FormData): Promise<void> {
    requireNavigationPermission(actor);
    await db
      .update(navigationAnchors)
      .set({
        code: readText(formData, "code").toUpperCase(),
        name: readText(formData, "name"),
        x: readNumber(formData, "x"),
        z: readNumber(formData, "z"),
        heightMeters: readPositiveNumber(formData, "heightMeters"),
        widthMeters: readPositiveNumber(formData, "widthMeters"),
        signHeightMeters: readPositiveNumber(formData, "signHeightMeters"),
        yawDegrees: readNumber(formData, "yawDegrees"),
        startX: readNumber(formData, "startX"),
        startZ: readNumber(formData, "startZ"),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(navigationAnchors.id, readText(formData, "id")),
          isNull(navigationAnchors.deletedAt),
        ),
      );
  }

  async createPath(actor: AdminActor, formData: FormData): Promise<void> {
    requireNavigationPermission(actor);
    await db.insert(navigationPaths).values({
      floorId: readText(formData, "floorId"),
      name: readText(formData, "name"),
      points: readPoints(formData, "points", 2),
      updatedAt: new Date(),
    });
  }

  async updatePath(actor: AdminActor, formData: FormData): Promise<void> {
    requireNavigationPermission(actor);
    await db
      .update(navigationPaths)
      .set({
        name: readText(formData, "name"),
        points: readPoints(formData, "points", 2),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(navigationPaths.id, readText(formData, "id")),
          isNull(navigationPaths.deletedAt),
        ),
      );
  }

  async createRestrictedArea(
    actor: AdminActor,
    formData: FormData,
  ): Promise<void> {
    requireNavigationPermission(actor);
    await db.insert(navigationRestrictedAreas).values({
      floorId: readText(formData, "floorId"),
      name: readText(formData, "name"),
      polygon: readPoints(formData, "polygon", 3),
      updatedAt: new Date(),
    });
  }

  async updateRestrictedArea(
    actor: AdminActor,
    formData: FormData,
  ): Promise<void> {
    requireNavigationPermission(actor);
    await db
      .update(navigationRestrictedAreas)
      .set({
        name: readText(formData, "name"),
        polygon: readPoints(formData, "polygon", 3),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(navigationRestrictedAreas.id, readText(formData, "id")),
          isNull(navigationRestrictedAreas.deletedAt),
        ),
      );
  }

  async createLocation(actor: AdminActor, formData: FormData): Promise<void> {
    requireNavigationPermission(actor);
    await db.insert(inventoryNavigationLocations).values({
      floorId: readText(formData, "floorId"),
      inventoryId: readText(formData, "inventoryId"),
      label: readText(formData, "label"),
      x: readNumber(formData, "x"),
      z: readNumber(formData, "z"),
      updatedAt: new Date(),
    });
  }

  async updateLocation(actor: AdminActor, formData: FormData): Promise<void> {
    requireNavigationPermission(actor);
    await db
      .update(inventoryNavigationLocations)
      .set({
        inventoryId: readText(formData, "inventoryId"),
        label: readText(formData, "label"),
        x: readNumber(formData, "x"),
        z: readNumber(formData, "z"),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(inventoryNavigationLocations.id, readText(formData, "id")),
          isNull(inventoryNavigationLocations.deletedAt),
        ),
      );
  }

  async deleteFeature(
    actor: AdminActor,
    type: "boundary" | "anchor" | "path" | "restrictedArea" | "location",
    id: string,
  ): Promise<void> {
    requireNavigationPermission(actor);
    const updatedAt = new Date();
    if (type === "boundary") {
      await db
        .update(navigationFloors)
        .set({ boundary: [], updatedAt })
        .where(
          and(eq(navigationFloors.id, id), isNull(navigationFloors.deletedAt)),
        );
      return;
    }
    if (type === "anchor") {
      await db
        .update(navigationAnchors)
        .set({ deletedAt: updatedAt, updatedAt })
        .where(eq(navigationAnchors.id, id));
      return;
    }
    if (type === "path") {
      await db
        .update(navigationPaths)
        .set({ deletedAt: updatedAt, updatedAt })
        .where(eq(navigationPaths.id, id));
      return;
    }
    if (type === "restrictedArea") {
      await db
        .update(navigationRestrictedAreas)
        .set({ deletedAt: updatedAt, updatedAt })
        .where(eq(navigationRestrictedAreas.id, id));
      return;
    }
    await db
      .update(inventoryNavigationLocations)
      .set({ deletedAt: updatedAt, updatedAt })
      .where(eq(inventoryNavigationLocations.id, id));
  }

  async getAnchorStartByToken(token: string) {
    const [anchor] = await db
      .select({
        id: navigationAnchors.id,
        code: navigationAnchors.code,
        name: navigationAnchors.name,
        startX: navigationAnchors.startX,
        startZ: navigationAnchors.startZ,
        floorName: navigationFloors.name,
      })
      .from(navigationAnchors)
      .innerJoin(
        navigationFloors,
        eq(navigationAnchors.floorId, navigationFloors.id),
      )
      .where(
        and(
          eq(navigationAnchors.publicToken, token),
          eq(navigationAnchors.isActive, true),
          isNull(navigationAnchors.deletedAt),
          eq(navigationFloors.isActive, true),
          isNull(navigationFloors.deletedAt),
        ),
      )
      .limit(1);
    return anchor ?? null;
  }

  async getCustomerMapByToken(
    token: string,
  ): Promise<CustomerLiveMapData | null> {
    const [anchor] = await db
      .select({
        code: navigationAnchors.code,
        name: navigationAnchors.name,
        startX: navigationAnchors.startX,
        startZ: navigationAnchors.startZ,
        floorId: navigationFloors.id,
        floorName: navigationFloors.name,
        widthMeters: navigationFloors.widthMeters,
        lengthMeters: navigationFloors.lengthMeters,
        boundary: navigationFloors.boundary,
      })
      .from(navigationAnchors)
      .innerJoin(
        navigationFloors,
        eq(navigationAnchors.floorId, navigationFloors.id),
      )
      .where(
        and(
          eq(navigationAnchors.publicToken, token),
          eq(navigationAnchors.isActive, true),
          isNull(navigationAnchors.deletedAt),
          eq(navigationFloors.isActive, true),
          isNull(navigationFloors.deletedAt),
        ),
      )
      .limit(1);
    if (!anchor) return null;

    const [pathRows, restrictedRows, destinationRows] = await Promise.all([
      db
        .select({
          id: navigationPaths.id,
          name: navigationPaths.name,
          points: navigationPaths.points,
        })
        .from(navigationPaths)
        .where(
          and(
            eq(navigationPaths.floorId, anchor.floorId),
            eq(navigationPaths.isActive, true),
            isNull(navigationPaths.deletedAt),
          ),
        )
        .orderBy(asc(navigationPaths.name)),
      db
        .select({
          id: navigationRestrictedAreas.id,
          name: navigationRestrictedAreas.name,
          polygon: navigationRestrictedAreas.polygon,
        })
        .from(navigationRestrictedAreas)
        .where(
          and(
            eq(navigationRestrictedAreas.floorId, anchor.floorId),
            isNull(navigationRestrictedAreas.deletedAt),
          ),
        )
        .orderBy(asc(navigationRestrictedAreas.name)),
      db
        .select({
          id: inventoryNavigationLocations.id,
          inventoryId: inventoryNavigationLocations.inventoryId,
          inventoryName: inventories.name,
          label: inventoryNavigationLocations.label,
          x: inventoryNavigationLocations.x,
          z: inventoryNavigationLocations.z,
        })
        .from(inventoryNavigationLocations)
        .innerJoin(
          inventories,
          eq(inventoryNavigationLocations.inventoryId, inventories.id),
        )
        .where(
          and(
            eq(inventoryNavigationLocations.floorId, anchor.floorId),
            eq(inventoryNavigationLocations.isActive, true),
            isNull(inventoryNavigationLocations.deletedAt),
            eq(inventories.isActive, true),
            isNull(inventories.deletedAt),
          ),
        )
        .orderBy(asc(inventories.name)),
    ]);

    return {
      floor: {
        id: anchor.floorId,
        name: anchor.floorName,
        widthMeters: anchor.widthMeters,
        lengthMeters: anchor.lengthMeters,
        boundary: asPoints(anchor.boundary),
      },
      anchor: {
        code: anchor.code,
        name: anchor.name,
        start: { x: anchor.startX, z: anchor.startZ },
      },
      paths: pathRows.map((path) => ({
        ...path,
        points: asPoints(path.points),
      })),
      restrictedAreas: restrictedRows.map((area) => ({
        ...area,
        polygon: asPoints(area.polygon),
      })),
      destinations: destinationRows,
    };
  }
}

export const liveMapService = new LiveMapService();
