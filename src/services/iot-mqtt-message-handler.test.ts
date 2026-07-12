import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  handleIotMqttMessage,
  IOT_MQTT_MAX_PAYLOAD_BYTES,
} from "./iot-mqtt-message-handler";

const topic =
  "6823f6db-3e42-4a15-8f67-e68f9c942601/loadcell/main/1cf3f14a-d07b-437a-9750-a3b698f9a730/event";

function createDependencies() {
  return {
    messageLog: {
      recordReceived: vi.fn().mockResolvedValue("log-id"),
      updateOutcome: vi.fn().mockResolvedValue(undefined),
    },
    eventProcessor: {
      process: vi.fn().mockResolvedValue({ status: "processed" }),
    },
    log: vi.fn(),
  };
}

describe("handleIotMqttMessage", () => {
  beforeEach(() => {
    process.env.BRANCH_CODE = "main";
  });

  it("processes a spec-compliant cumulative picked event and audits it", async () => {
    const dependencies = createDependencies();
    const payload = Buffer.from(
      JSON.stringify({
        event: "item_picked",
        branch: "main",
        sku: "1cf3f14a-d07b-437a-9750-a3b698f9a730",
        pickedQty: 3,
        currentQty: 97,
        seq: 1044,
      }),
    );

    const result = await handleIotMqttMessage(topic, payload, dependencies);

    expect(result.event).toMatchObject({
      type: "picked_count",
      pickedCount: 3,
      currentQty: 97,
      seq: 1044,
    });
    expect(dependencies.eventProcessor.process).toHaveBeenCalledOnce();
    expect(dependencies.messageLog.updateOutcome).toHaveBeenCalledWith(
      expect.objectContaining({ id: "log-id", status: "processed" }),
    );
  });

  it("stores malformed JSON as a rejected raw message", async () => {
    const dependencies = createDependencies();

    await expect(
      handleIotMqttMessage(topic, Buffer.from("{not-json"), dependencies),
    ).rejects.toThrow("Loadcell MQTT payload must be valid JSON");

    expect(dependencies.eventProcessor.process).not.toHaveBeenCalled();
    expect(dependencies.messageLog.recordReceived).toHaveBeenCalledWith(
      expect.objectContaining({ payloadJson: null, payloadRaw: "{not-json" }),
    );
    expect(dependencies.messageLog.updateOutcome).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "rejected",
        reasonCode: "invalid_json",
      }),
    );
  });

  it("rejects and truncates payloads larger than 64 KiB", async () => {
    const dependencies = createDependencies();
    const payload = Buffer.alloc(IOT_MQTT_MAX_PAYLOAD_BYTES + 1, "a");

    await expect(
      handleIotMqttMessage(topic, payload, dependencies),
    ).rejects.toThrow("MQTT payload exceeds 65536 bytes");

    const received = dependencies.messageLog.recordReceived.mock.calls[0][0];
    expect(Buffer.byteLength(received.payloadRaw)).toBe(
      IOT_MQTT_MAX_PAYLOAD_BYTES,
    );
    expect(received.payloadSizeBytes).toBe(IOT_MQTT_MAX_PAYLOAD_BYTES + 1);
  });

  it("rejects a mismatched payload sku without processing the session", async () => {
    const dependencies = createDependencies();
    const payload = Buffer.from(
      JSON.stringify({ sku: "another-product", pickedQty: 1 }),
    );

    await expect(
      handleIotMqttMessage(topic, payload, dependencies),
    ).rejects.toThrow("Loadcell payload sku does not match topic inventory id");
    expect(dependencies.eventProcessor.process).not.toHaveBeenCalled();
    expect(dependencies.messageLog.updateOutcome).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "rejected",
        reasonCode: "sku_mismatch",
      }),
    );
  });

  it("continues business processing when the audit insert fails", async () => {
    const dependencies = createDependencies();
    dependencies.messageLog.recordReceived.mockRejectedValue(
      new Error("database unavailable"),
    );
    const payload = Buffer.from(JSON.stringify({ pickedQty: 2 }));

    await expect(
      handleIotMqttMessage(topic, payload, dependencies),
    ).resolves.toMatchObject({ event: { pickedCount: 2 } });
    expect(dependencies.eventProcessor.process).toHaveBeenCalledOnce();
    expect(dependencies.log).toHaveBeenCalledWith(
      "mqtt_audit_log_failed",
      expect.objectContaining({ phase: "record_received" }),
    );
  });

  it("continues after processing when the audit outcome update fails", async () => {
    const dependencies = createDependencies();
    dependencies.messageLog.updateOutcome.mockRejectedValue(
      new Error("database unavailable"),
    );

    await expect(
      handleIotMqttMessage(
        topic,
        Buffer.from(JSON.stringify({ pickedQty: 2 })),
        dependencies,
      ),
    ).resolves.toMatchObject({ event: { pickedCount: 2 } });
    expect(dependencies.log).toHaveBeenCalledWith(
      "mqtt_audit_log_failed",
      expect.objectContaining({ phase: "update_outcome", logId: "log-id" }),
    );
  });
});
