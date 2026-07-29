import "server-only";

import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import {
  clientVisits,
  inventoryNavigationLocations,
  navigationAnchors,
  navigationSessions,
} from "@/db/schema";

export type NavigationMode = "map" | "ar";
export type NavigationStatus = "navigating" | "arrived" | "cancelled";

type StartNavigationInput = {
  anchorToken: string;
  destinationId: string;
  distanceMeters: number;
  mode: NavigationMode;
};

type UpdateNavigationInput = {
  x: number;
  z: number;
  mode: NavigationMode;
  status: NavigationStatus;
};

function finiteNumber(value: number, name: string) {
  if (!Number.isFinite(value)) throw new Error(`${name} must be a number`);
  return value;
}

function nonNegativeNumber(value: number, name: string) {
  const result = finiteNumber(value, name);
  if (result < 0) throw new Error(`${name} must not be negative`);
  return result;
}

class NavigationSessionService {
  async start(userId: number, input: StartNavigationInput) {
    const [visit] = await db
      .select({ id: clientVisits.id })
      .from(clientVisits)
      .where(
        and(eq(clientVisits.userId, userId), eq(clientVisits.status, "inside")),
      )
      .limit(1);
    if (!visit) throw new Error("An active store visit is required");

    const [context] = await db
      .select({
        anchorId: navigationAnchors.id,
        startX: navigationAnchors.startX,
        startZ: navigationAnchors.startZ,
      })
      .from(navigationAnchors)
      .innerJoin(
        inventoryNavigationLocations,
        and(
          eq(inventoryNavigationLocations.floorId, navigationAnchors.floorId),
          eq(inventoryNavigationLocations.id, input.destinationId),
          isNull(inventoryNavigationLocations.deletedAt),
          eq(inventoryNavigationLocations.isActive, true),
        ),
      )
      .where(
        and(
          eq(navigationAnchors.publicToken, input.anchorToken),
          isNull(navigationAnchors.deletedAt),
          eq(navigationAnchors.isActive, true),
        ),
      )
      .limit(1);
    if (!context) throw new Error("Invalid navigation destination");

    const [session] = await db
      .insert(navigationSessions)
      .values({
        userId,
        clientVisitId: visit.id,
        anchorId: context.anchorId,
        destinationId: input.destinationId,
        mode: input.mode,
        initialDistanceMeters: nonNegativeNumber(
          input.distanceMeters,
          "distanceMeters",
        ),
        lastX: context.startX,
        lastZ: context.startZ,
        updatedAt: new Date(),
      })
      .returning({
        id: navigationSessions.id,
        startedAt: navigationSessions.startedAt,
      });
    if (!session) throw new Error("Could not start navigation");
    return session;
  }

  async update(
    userId: number,
    sessionId: string,
    input: UpdateNavigationInput,
  ) {
    const [existing] = await db
      .select({
        id: navigationSessions.id,
        startedAt: navigationSessions.startedAt,
        status: navigationSessions.status,
      })
      .from(navigationSessions)
      .where(
        and(
          eq(navigationSessions.id, sessionId),
          eq(navigationSessions.userId, userId),
          isNull(navigationSessions.deletedAt),
        ),
      )
      .limit(1);
    if (!existing) throw new Error("Navigation session not found");
    if (existing.status !== "navigating") {
      return {
        id: existing.id,
        completedAt: undefined,
        durationSeconds: undefined,
      };
    }

    const now = new Date();
    const terminal = input.status === "arrived" || input.status === "cancelled";
    const completedAt = terminal ? now : undefined;
    const durationSeconds = completedAt
      ? Math.max(
          0,
          Math.round(
            (completedAt.getTime() - existing.startedAt.getTime()) / 1000,
          ),
        )
      : undefined;

    await db
      .update(navigationSessions)
      .set({
        lastX: finiteNumber(input.x, "x"),
        lastZ: finiteNumber(input.z, "z"),
        mode: input.mode,
        status: input.status,
        ...(completedAt ? { completedAt, durationSeconds } : {}),
        updatedAt: now,
      })
      .where(eq(navigationSessions.id, existing.id));

    return { id: existing.id, completedAt, durationSeconds };
  }
}

export const navigationSessionService = new NavigationSessionService();
