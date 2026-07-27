import "server-only";

import { and, eq, isNotNull, sql } from "drizzle-orm";

import { clientAttendanceEvents, clientVisits } from "@/db/schema";
import { db } from "@/db";
import {
  getInsideWorkerStoreId,
  insideWorkerClientService,
} from "@/services/inside-worker-client.service";
import { animationClientService } from "@/services/animation-client.service";

const DELIVERED_METADATA_KEY = "insideHandoffDeliveredAt";
const READY_METADATA_KEY = "insideHandoffReadyAt";
const ANIMATION_PENDING_METADATA_KEY = "insideHandoffAnimationPendingAt";
const IMAGE_URL_METADATA_KEY = "insideHandoffImageUrl";
const NEXT_ATTEMPT_METADATA_KEY = "insideHandoffNextAttemptAt";

export type InsideWorkerOutboxEvent = {
  id: number;
  userId: number;
  cameraId: string;
  occurredAt: Date;
  metadata: Record<string, unknown> | null;
};

type OutboxDependencies = {
  getEvent: (eventId: number) => Promise<InsideWorkerOutboxEvent | null>;
  listPendingEventIds: (limit: number) => Promise<number[]>;
  markDelivered: (eventId: number, deliveredAt: string) => Promise<void>;
  markAnimationPending: (
    eventId: number,
    imageUrl: string,
    pendingAt: string,
  ) => Promise<void>;
  markReady: (eventId: number, readyAt: string) => Promise<void>;
  markFailed: (
    eventId: number,
    failedAt: string,
    errorMessage: string,
  ) => Promise<void>;
  getMap: typeof insideWorkerClientService.getMap;
  publishHandoff: typeof insideWorkerClientService.publishHandoff;
  updateAnimation: (
    userId: number,
    imageUrl: string,
    idempotencyKey: string,
  ) => Promise<void>;
  getStoreId: () => string;
  now: () => Date;
};

export class InsideWorkerOutboxService {
  constructor(private readonly dependencies: OutboxDependencies) {}

  async enqueueEvent(eventId: number, imageUrl: string): Promise<boolean> {
    await this.dependencies.markAnimationPending(
      eventId,
      imageUrl,
      this.dependencies.now().toISOString(),
    );
    return this.resumeEvent(eventId);
  }

  async resumeEvent(eventId: number): Promise<boolean> {
    const event = await this.dependencies.getEvent(eventId);
    if (!event || event.metadata?.[DELIVERED_METADATA_KEY]) return false;
    if (!event.metadata?.[READY_METADATA_KEY]) {
      const imageUrl = event.metadata?.[IMAGE_URL_METADATA_KEY];
      if (
        !event.metadata?.[ANIMATION_PENDING_METADATA_KEY] ||
        typeof imageUrl !== "string" ||
        !imageUrl
      ) {
        return false;
      }
      await this.dependencies.updateAnimation(
        event.userId,
        imageUrl,
        `entry-${event.id}`,
      );
      await this.dependencies.markReady(
        event.id,
        this.dependencies.now().toISOString(),
      );
    }
    return this.deliverEvent(eventId);
  }

  async deliverEvent(eventId: number): Promise<boolean> {
    const event = await this.dependencies.getEvent(eventId);
    if (
      !event ||
      !event.metadata?.[READY_METADATA_KEY] ||
      event.metadata[DELIVERED_METADATA_KEY]
    ) {
      return false;
    }

    const storeId = this.dependencies.getStoreId();
    const map = await this.dependencies.getMap(storeId);
    await this.dependencies.publishHandoff({
      handoffId: `entry-${event.id}`,
      userId: event.userId,
      storeId,
      sourceCameraId: event.cameraId,
      occurredAt: event.occurredAt.toISOString(),
      start: map.entry.start,
      startRadius: map.entry.radius,
      ttlMs: map.entry.ttlMs,
    });
    await this.dependencies.markDelivered(
      event.id,
      this.dependencies.now().toISOString(),
    );
    return true;
  }

  async drain(limit = 50): Promise<{ delivered: number; failed: number }> {
    const eventIds = await this.dependencies.listPendingEventIds(limit);
    let delivered = 0;
    let failed = 0;
    for (const eventId of eventIds) {
      try {
        if (await this.resumeEvent(eventId)) delivered += 1;
      } catch (error) {
        failed += 1;
        await this.dependencies.markFailed(
          eventId,
          this.dependencies.now().toISOString(),
          error instanceof Error ? error.message : String(error),
        );
        console.error("[inside-worker-outbox] delivery failed", {
          eventId,
          error,
        });
      }
    }
    return { delivered, failed };
  }
}

export const insideWorkerOutboxService = new InsideWorkerOutboxService({
  getEvent: async (eventId) => {
    const [row] = await db
      .select({
        id: clientAttendanceEvents.id,
        userId: clientAttendanceEvents.matchedUserId,
        cameraId: clientAttendanceEvents.cameraId,
        occurredAt: sql<Date>`coalesce(
          ${clientAttendanceEvents.workerCapturedAt},
          ${clientAttendanceEvents.createdAt}
        )`,
        metadata: clientAttendanceEvents.metadata,
      })
      .from(clientAttendanceEvents)
      .innerJoin(
        clientVisits,
        eq(clientVisits.entryEventId, clientAttendanceEvents.id),
      )
      .where(
        and(
          eq(clientAttendanceEvents.id, eventId),
          eq(clientVisits.status, "inside"),
          eq(clientAttendanceEvents.direction, "entry"),
          eq(clientVisits.status, "inside"),
          eq(clientAttendanceEvents.decision, "recognized"),
          isNotNull(clientAttendanceEvents.matchedUserId),
        ),
      )
      .limit(1);
    if (!row || row.userId === null) return null;
    return { ...row, userId: row.userId };
  },
  listPendingEventIds: async (limit) => {
    const rows = await db
      .select({ eventId: clientAttendanceEvents.id })
      .from(clientAttendanceEvents)
      .innerJoin(
        clientVisits,
        eq(clientVisits.entryEventId, clientAttendanceEvents.id),
      )
      .where(
        and(
          eq(clientAttendanceEvents.direction, "entry"),
          eq(clientAttendanceEvents.decision, "recognized"),
          isNotNull(clientAttendanceEvents.matchedUserId),
          sql`coalesce(
            ${clientAttendanceEvents.metadata}->>${ANIMATION_PENDING_METADATA_KEY},
            ${clientAttendanceEvents.metadata}->>${READY_METADATA_KEY},
            ''
          ) <> ''`,
          sql`coalesce(
            ${clientAttendanceEvents.metadata}->>${DELIVERED_METADATA_KEY},
            ''
          ) = ''`,
          sql`case
            when coalesce(
              ${clientAttendanceEvents.metadata}->>${NEXT_ATTEMPT_METADATA_KEY},
              ''
            ) ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T'
            then (
              ${clientAttendanceEvents.metadata}->>${NEXT_ATTEMPT_METADATA_KEY}
            )::timestamptz
            else '1970-01-01T00:00:00.000Z'::timestamptz
          end <= now()`,
        ),
      )
      .orderBy(clientAttendanceEvents.id)
      .limit(limit);
    return rows.map((row) => row.eventId);
  },
  markDelivered: async (eventId, deliveredAt) => {
    await db
      .update(clientAttendanceEvents)
      .set({
        metadata: sql`coalesce(
          ${clientAttendanceEvents.metadata},
          '{}'::jsonb
        ) || jsonb_build_object(
          ${DELIVERED_METADATA_KEY},
          ${deliveredAt}
        )`,
      })
      .where(eq(clientAttendanceEvents.id, eventId));
  },
  markAnimationPending: async (eventId, imageUrl, pendingAt) => {
    await db
      .update(clientAttendanceEvents)
      .set({
        metadata: sql`coalesce(
          ${clientAttendanceEvents.metadata},
          '{}'::jsonb
        ) || jsonb_build_object(
          ${ANIMATION_PENDING_METADATA_KEY}, ${pendingAt},
          ${IMAGE_URL_METADATA_KEY}, ${imageUrl}
        )`,
      })
      .where(eq(clientAttendanceEvents.id, eventId));
  },
  markReady: async (eventId, readyAt) => {
    await db
      .update(clientAttendanceEvents)
      .set({
        metadata: sql`coalesce(
          ${clientAttendanceEvents.metadata},
          '{}'::jsonb
        ) || jsonb_build_object(${READY_METADATA_KEY}, ${readyAt})`,
      })
      .where(eq(clientAttendanceEvents.id, eventId));
  },
  markFailed: async (eventId, failedAt, errorMessage) => {
    await db
      .update(clientAttendanceEvents)
      .set({
        metadata: sql`coalesce(
          ${clientAttendanceEvents.metadata},
          '{}'::jsonb
        ) || jsonb_build_object(
          'insideHandoffLastFailedAt', ${failedAt},
          'insideHandoffLastError', ${errorMessage},
          'insideHandoffAttempts',
          case
            when coalesce(
              ${clientAttendanceEvents.metadata}->>'insideHandoffAttempts',
              ''
            ) ~ '^[0-9]+$'
            then (
              ${clientAttendanceEvents.metadata}->>'insideHandoffAttempts'
            )::int
            else 0
          end + 1,
          ${NEXT_ATTEMPT_METADATA_KEY},
          (${failedAt}::timestamptz + interval '30 seconds')::text
        )`,
      })
      .where(eq(clientAttendanceEvents.id, eventId));
  },
  getMap: (storeId) => insideWorkerClientService.getMap(storeId),
  publishHandoff: (input) => insideWorkerClientService.publishHandoff(input),
  updateAnimation: (userId, imageUrl, idempotencyKey) =>
    animationClientService.updateUserStatus({
      userId,
      direction: "entry",
      result: "pass",
      imageURL: imageUrl,
      idempotencyKey,
    }),
  getStoreId: getInsideWorkerStoreId,
  now: () => new Date(),
});
