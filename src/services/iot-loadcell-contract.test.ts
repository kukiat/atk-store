import { beforeEach, describe, expect, it } from "vitest";

import {
  loadcellSubscribeTopics,
  normalizeLoadcellMessage,
  parseLoadcellTopic,
} from "./iot-loadcell-contract";

const sessionId = "6823f6db-3e42-4a15-8f67-e68f9c942601";
const inventoryId = "1cf3f14a-d07b-437a-9750-a3b698f9a730";

describe("IOT loadcell MQTT contract", () => {
  beforeEach(() => {
    process.env.BRANCH_CODE = "main";
  });

  it("subscribes to both branch-scoped QoS consumer topic shapes", () => {
    expect(loadcellSubscribeTopics()).toEqual([
      "+/loadcell/main/+/event",
      "+/loadcell/main/+/status",
    ]);
  });

  it("maps pickedQty as the cumulative cart quantity", () => {
    const event = normalizeLoadcellMessage(
      `${sessionId}/loadcell/main/${inventoryId}/event`,
      { pickedQty: 5, currentQty: 95, seq: 1044 },
    );
    expect(event).toMatchObject({
      type: "picked_count",
      sessionId,
      inventoryId,
      pickedCount: 5,
      currentQty: 95,
      seq: 1044,
    });
  });

  it("maps only shelf_closed status to door_closed", () => {
    expect(
      normalizeLoadcellMessage(
        `${sessionId}/loadcell/main/${inventoryId}/status`,
        { status: "shelf_closed" },
      ),
    ).toMatchObject({ type: "door_closed", sessionId, inventoryId });
    expect(() =>
      normalizeLoadcellMessage(
        `${sessionId}/loadcell/main/${inventoryId}/status`,
        { status: "heartbeat" },
      ),
    ).toThrow("Unsupported loadcell status");
  });

  it("rejects non-UUID topic identifiers before database processing", () => {
    expect(() =>
      parseLoadcellTopic(`not-a-uuid/loadcell/main/${inventoryId}/event`),
    ).toThrow("Invalid loadcell MQTT topic");
  });

  it("falls back to receive time for an invalid optional timestamp", () => {
    const before = Date.now();
    const event = normalizeLoadcellMessage(
      `${sessionId}/loadcell/main/${inventoryId}/event`,
      { pickedQty: 1, timestamp: "not-a-date" },
    );
    expect(Date.parse(event.occurredAt)).toBeGreaterThanOrEqual(before);
  });
});
