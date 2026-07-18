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
import { clientAttendanceIntegrationService } from "@/services/client-attendance-integration.service";
import { faceRecognitionService } from "@/services/face-recognition.service";
import { publishCheckoutStatus } from "@/services/order-events.service";
import { orderService } from "@/services/order.service";

type RecognizeFrameInput = {
  imageBytes: Uint8Array;
  imageContentType: string;
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

type VisitStateResult = {
  visit: ClientVisit | null;
  transitioned: boolean;
};

type ManualOverrideInput = {
  targetUserId: number;
  actorUserId: number;
  direction: Extract<AttendanceDirection, "entry" | "exit">;
  metadata?: Record<string, unknown>;
};

export type ClientAttendanceRecognitionResult = {
  event: ClientAttendanceEvent;
  visit: ClientVisit | null;
  user: RecognizedUser | null;
  checkout:
    | {
        status: "paid";
        orderId: string;
        totalPrice: number;
      }
    | {
        status: "failed";
        message: string;
      }
    | null;
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
): Promise<VisitStateResult> {
  if (!user) return { visit: null, transitioned: false };

  const now = new Date();

  if (event.direction === "entry") {
    const existingOpenVisit = await getOpenVisit(user.id);
    if (existingOpenVisit) {
      return { visit: existingOpenVisit, transitioned: false };
    }

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

      return { visit: visit ?? null, transitioned: Boolean(visit) };
    } catch (error) {
      if (isUniqueViolation(error)) {
        return { visit: await getOpenVisit(user.id), transitioned: false };
      }
      throw error;
    }
  }

  if (event.direction === "exit") {
    const existingOpenVisit = await getOpenVisit(user.id);
    if (!existingOpenVisit) return { visit: null, transitioned: false };

    const [visit] = await db
      .update(clientVisits)
      .set({
        status: "exited",
        exitedAt: event.workerCapturedAt ?? event.createdAt,
        exitEventId: event.id,
        updatedAt: now,
      })
      .where(
        and(
          eq(clientVisits.id, existingOpenVisit.id),
          eq(clientVisits.status, "inside"),
        ),
      )
      .returning();

    return { visit: visit ?? null, transitioned: Boolean(visit) };
  }

  return { visit: await getOpenVisit(user.id), transitioned: false };
}

function isTransitionDirection(
  direction: AttendanceDirection,
): direction is Extract<AttendanceDirection, "entry" | "exit"> {
  return direction === "entry" || direction === "exit";
}

function logIntegrationError(
  stage: "pass" | "fail",
  userId: number,
  direction: Extract<AttendanceDirection, "entry" | "exit">,
  error: unknown,
) {
  console.error("Client attendance integration failed", {
    stage,
    userId,
    direction,
    error: error instanceof Error ? error.message : String(error),
  });
}

async function createCheckoutForExit(
  user: RecognizedUser | null,
  event: ClientAttendanceEvent,
  visit: ClientVisit | null,
): Promise<ClientAttendanceRecognitionResult["checkout"]> {
  if (!user || event.direction !== "exit" || visit?.status !== "exited") {
    return null;
  }

  try {
    const order = await orderService.createPaidWalletOrderFromCart(visit.id);
    return {
      status: "paid",
      orderId: order.id,
      totalPrice: order.totalPrice,
    };
  } catch (error) {
    await publishCheckoutStatus(user.id);
    return {
      status: "failed",
      message: error instanceof Error ? error.message : "Checkout failed",
    };
  }
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

    let visitState: VisitStateResult;
    try {
      visitState = await applyVisitState(event, user);
    } catch (error) {
      if (user && isTransitionDirection(event.direction)) {
        try {
          await clientAttendanceIntegrationService.publishStampFailure({
            userId: user.id,
            direction: event.direction,
          });
        } catch (integrationError) {
          logIntegrationError(
            "fail",
            user.id,
            event.direction,
            integrationError,
          );
        }
      }
      throw error;
    }

    if (user && isTransitionDirection(event.direction)) {
      try {
        await clientAttendanceIntegrationService.publishTransition({
          transitioned: visitState.transitioned,
          eventId: event.id,
          userId: user.id,
          direction: event.direction,
          imageBytes: input.imageBytes,
          imageContentType: input.imageContentType,
        });
      } catch (error) {
        logIntegrationError("pass", user.id, event.direction, error);
      }
    }

    const visit = visitState.visit;
    const checkout = await createCheckoutForExit(user, event, visit);

    return { event, visit, user, checkout };
  }

  async manualOverride(
    input: ManualOverrideInput,
  ): Promise<ClientAttendanceRecognitionResult> {
    const user = await getActiveUserById(input.targetUserId);
    if (!user) {
      throw new Error("Active user is required for attendance override");
    }

    const now = new Date();
    const imageSha256 = createHash("sha256")
      .update(
        [
          "backoffice-manual",
          input.targetUserId,
          input.direction,
          input.actorUserId,
          now.toISOString(),
        ].join(":"),
      )
      .digest("hex");

    const [event] = await db
      .insert(clientAttendanceEvents)
      .values({
        cameraId: "backoffice-manual",
        direction: input.direction,
        decision: "recognized",
        matchedUserId: user.id,
        imageSha256,
        workerCapturedAt: now,
        metadata: {
          source: "backoffice_manual_override",
          actorUserId: input.actorUserId,
          ...input.metadata,
        },
      })
      .returning();

    if (!event) {
      throw new Error("Failed to create client attendance event");
    }

    const { visit } = await applyVisitState(event, user);
    const checkout = await createCheckoutForExit(user, event, visit);

    return { event, visit, user, checkout };
  }
}

export const clientAttendanceService = new ClientAttendanceService();
