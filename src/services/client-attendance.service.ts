import "server-only";

import { createHash } from "node:crypto";

import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  type AttendanceDirection,
  type ClientAttendanceEvent,
  type ClientVisit,
  clientAttendanceEvents,
  clientVisits,
  users,
} from "@/db/schema";
import { faceRecognitionService } from "@/services/face-recognition.service";

type RecognizeFrameInput = {
  imageBytes: Uint8Array;
  cameraId: string;
  direction: AttendanceDirection;
  workerCapturedAt: Date | null;
  metadata?: Record<string, unknown>;
};

type RecognizedUser = {
  id: number;
  email: string;
  name: string | null;
  avatarUrl: string | null;
};

export type ClientAttendanceRecognitionResult = {
  event: ClientAttendanceEvent;
  visit: ClientVisit | null;
  user: RecognizedUser | null;
};

async function getActiveUserById(
  userId: number,
): Promise<RecognizedUser | null> {
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      avatarUrl: users.avatarUrl,
      accountStatus: users.accountStatus,
      disabledUntil: users.disabledUntil,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user || user.accountStatus !== "active") return null;
  if (user.disabledUntil && user.disabledUntil > new Date()) return null;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
  };
}

async function getOpenVisit(userId: number): Promise<ClientVisit | null> {
  const [visit] = await db
    .select()
    .from(clientVisits)
    .where(
      and(eq(clientVisits.userId, userId), eq(clientVisits.status, "inside")),
    )
    .orderBy(desc(clientVisits.createdAt))
    .limit(1);

  return visit ?? null;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  );
}

async function applyVisitState(
  event: ClientAttendanceEvent,
  user: RecognizedUser | null,
): Promise<ClientVisit | null> {
  if (!user) return null;

  const now = new Date();

  if (event.direction === "entry") {
    const existingOpenVisit = await getOpenVisit(user.id);
    if (existingOpenVisit) return existingOpenVisit;

    try {
      const [visit] = await db
        .insert(clientVisits)
        .values({
          userId: user.id,
          status: "inside",
          enteredAt: event.workerCapturedAt ?? event.createdAt,
          entryEventId: event.id,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      return visit ?? null;
    } catch (error) {
      if (isUniqueViolation(error)) return getOpenVisit(user.id);
      throw error;
    }
  }

  if (event.direction === "exit") {
    const existingOpenVisit = await getOpenVisit(user.id);
    if (!existingOpenVisit) return null;

    const [visit] = await db
      .update(clientVisits)
      .set({
        status: "exited",
        exitedAt: event.workerCapturedAt ?? event.createdAt,
        exitEventId: event.id,
        updatedAt: now,
      })
      .where(eq(clientVisits.id, existingOpenVisit.id))
      .returning();

    return visit ?? null;
  }

  return getOpenVisit(user.id);
}

class ClientAttendanceService {
  async recognizeFrame(
    input: RecognizeFrameInput,
  ): Promise<ClientAttendanceRecognitionResult> {
    const imageSha256 = createHash("sha256")
      .update(input.imageBytes)
      .digest("hex");
    const match = await faceRecognitionService.searchBestFaceFromBytes(
      input.imageBytes,
    );

    let user: RecognizedUser | null = null;
    if (match) {
      const profile = await faceRecognitionService.getProfileByFaceId(
        match.faceId,
      );
      if (profile) user = await getActiveUserById(profile.userId);
    }

    const [event] = await db
      .insert(clientAttendanceEvents)
      .values({
        cameraId: input.cameraId,
        direction: input.direction,
        decision: user ? "recognized" : match ? "ignored" : "unknown",
        matchedUserId: user?.id ?? null,
        matchedFaceId: match?.faceId ?? null,
        similarity: match?.similarity ?? null,
        imageSha256,
        workerCapturedAt: input.workerCapturedAt,
        metadata: input.metadata,
      })
      .returning();

    if (!event) {
      throw new Error("Failed to create client attendance event");
    }

    const visit = await applyVisitState(event, user);

    return { event, visit, user };
  }
}

export const clientAttendanceService = new ClientAttendanceService();
