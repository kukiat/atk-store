import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/services/inside-worker-client.service", () => ({
  getInsideWorkerStoreId: () => "atk-default",
  insideWorkerClientService: {
    getMap: vi.fn(),
    publishHandoff: vi.fn(),
  },
}));

import {
  InsideWorkerOutboxService,
  type InsideWorkerOutboxEvent,
} from "./inside-worker-outbox.service";

function event(): InsideWorkerOutboxEvent {
  return {
    id: 101,
    userId: 42,
    cameraId: "front-door",
    occurredAt: new Date("2026-07-18T07:00:00.000Z"),
    metadata: { insideHandoffReadyAt: "2026-07-18T07:00:00.500Z" },
  };
}

describe("InsideWorkerOutboxService", () => {
  it("marks the durable attendance event after idempotent delivery", async () => {
    const markDelivered = vi.fn().mockResolvedValue(undefined);
    const publishHandoff = vi.fn().mockResolvedValue(undefined);
    const service = new InsideWorkerOutboxService({
      getEvent: vi.fn().mockResolvedValue(event()),
      listPendingEventIds: vi.fn().mockResolvedValue([101]),
      markDelivered,
      markAnimationPending: vi.fn().mockResolvedValue(undefined),
      markReady: vi.fn().mockResolvedValue(undefined),
      markFailed: vi.fn().mockResolvedValue(undefined),
      getMap: vi.fn().mockResolvedValue({
        entry: {
          start: { x: 3.4, y: 0, z: 13 },
          radius: 2.2,
          ttlMs: 20_000,
        },
      }),
      publishHandoff,
      updateAnimation: vi.fn().mockResolvedValue(undefined),
      getStoreId: () => "atk-default",
      now: () => new Date("2026-07-18T07:00:01.000Z"),
    });

    await expect(service.deliverEvent(101)).resolves.toBe(true);
    expect(publishHandoff).toHaveBeenCalledWith({
      handoffId: "entry-101",
      userId: 42,
      storeId: "atk-default",
      sourceCameraId: "front-door",
      occurredAt: "2026-07-18T07:00:00.000Z",
      start: { x: 3.4, y: 0, z: 13 },
      startRadius: 2.2,
      ttlMs: 20_000,
    });
    expect(markDelivered).toHaveBeenCalledWith(
      101,
      "2026-07-18T07:00:01.000Z",
    );
  });

  it("keeps failed events pending so a later drain retries them", async () => {
    const pending = [101];
    const publishHandoff = vi
      .fn()
      .mockRejectedValueOnce(new Error("dashboard unavailable"))
      .mockResolvedValueOnce(undefined);
    const markDelivered = vi.fn().mockResolvedValue(undefined);
    const service = new InsideWorkerOutboxService({
      getEvent: vi.fn().mockResolvedValue(event()),
      listPendingEventIds: vi.fn().mockImplementation(async () => [...pending]),
      markDelivered,
      markAnimationPending: vi.fn().mockResolvedValue(undefined),
      markReady: vi.fn().mockResolvedValue(undefined),
      markFailed: vi.fn().mockResolvedValue(undefined),
      getMap: vi.fn().mockResolvedValue({
        entry: {
          start: { x: 3.4, y: 0, z: 13 },
          radius: 2.2,
          ttlMs: 20_000,
        },
      }),
      publishHandoff,
      updateAnimation: vi.fn().mockResolvedValue(undefined),
      getStoreId: () => "atk-default",
      now: () => new Date(),
    });

    await expect(service.drain()).resolves.toEqual({ delivered: 0, failed: 1 });
    await expect(service.drain()).resolves.toEqual({ delivered: 1, failed: 0 });
    expect(publishHandoff).toHaveBeenCalledTimes(2);
    expect(markDelivered).toHaveBeenCalledOnce();
  });

  it("replays a crash-pending animation before making the handoff ready", async () => {
    const pendingEvent = event();
    pendingEvent.metadata = {
      insideHandoffAnimationPendingAt: "2026-07-18T07:00:00.500Z",
      insideHandoffImageUrl: "https://storage.example/frame.jpg",
    };
    const markReady = vi.fn().mockImplementation(async () => {
      pendingEvent.metadata = {
        ...pendingEvent.metadata,
        insideHandoffReadyAt: "2026-07-18T07:00:01.000Z",
      };
    });
    const updateAnimation = vi.fn().mockResolvedValue(undefined);
    const service = new InsideWorkerOutboxService({
      getEvent: vi.fn().mockImplementation(async () => pendingEvent),
      listPendingEventIds: vi.fn().mockResolvedValue([101]),
      markDelivered: vi.fn().mockResolvedValue(undefined),
      markAnimationPending: vi.fn().mockResolvedValue(undefined),
      markReady,
      markFailed: vi.fn().mockResolvedValue(undefined),
      getMap: vi.fn().mockResolvedValue({
        entry: {
          start: { x: 3.4, y: 0, z: 13 },
          radius: 2.2,
          ttlMs: 20_000,
        },
      }),
      publishHandoff: vi.fn().mockResolvedValue(undefined),
      updateAnimation,
      getStoreId: () => "atk-default",
      now: () => new Date("2026-07-18T07:00:01.000Z"),
    });

    await expect(service.resumeEvent(101)).resolves.toBe(true);
    expect(updateAnimation).toHaveBeenCalledWith(
      42,
      "https://storage.example/frame.jpg",
      "entry-101",
    );
    expect(markReady).toHaveBeenCalledOnce();
  });
});
