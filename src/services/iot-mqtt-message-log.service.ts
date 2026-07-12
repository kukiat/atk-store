import "server-only";

import { randomUUID } from "node:crypto";

import { eq, lt } from "drizzle-orm";

import { db } from "@/db";
import { iotMqttMessageLogs } from "@/db/schema";
import {
  IOT_MQTT_MAX_PAYLOAD_BYTES,
  type IotMqttMessageLogStatus,
} from "@/services/iot-mqtt-message-log.contract";

export { IOT_MQTT_MAX_PAYLOAD_BYTES };
export const IOT_MQTT_LOG_RETENTION_DAYS = 30;

type ParsedTopicFields = {
  sessionId?: string | null;
  inventoryId?: string | null;
  branchCode?: string | null;
  messageKind?: string | null;
};

class IotMqttMessageLogService {
  async recordReceived(input: {
    topic: string;
    payloadRaw: string;
    payloadJson: Record<string, unknown> | null;
    payloadSizeBytes: number;
    parsedTopic?: ParsedTopicFields;
  }): Promise<string> {
    const id = randomUUID();
    await db.insert(iotMqttMessageLogs).values({
      id,
      topic: input.topic,
      payloadRaw: input.payloadRaw,
      payloadJson: input.payloadJson,
      payloadSizeBytes: input.payloadSizeBytes,
      sessionId: input.parsedTopic?.sessionId,
      inventoryId: input.parsedTopic?.inventoryId,
      branchCode: input.parsedTopic?.branchCode,
      messageKind: input.parsedTopic?.messageKind,
      processingStatus: "received",
      receivedAt: new Date(),
    });
    return id;
  }

  async updateOutcome(input: {
    id: string;
    status: Exclude<IotMqttMessageLogStatus, "received">;
    reasonCode?: string | null;
    errorMessage?: string | null;
    parsedTopic?: ParsedTopicFields;
  }): Promise<void> {
    await db
      .update(iotMqttMessageLogs)
      .set({
        processingStatus: input.status,
        reasonCode: input.reasonCode,
        errorMessage: input.errorMessage,
        sessionId: input.parsedTopic?.sessionId,
        inventoryId: input.parsedTopic?.inventoryId,
        branchCode: input.parsedTopic?.branchCode,
        messageKind: input.parsedTopic?.messageKind,
        processedAt: new Date(),
      })
      .where(eq(iotMqttMessageLogs.id, input.id));
  }

  async purgeExpired(now = new Date()): Promise<number> {
    const cutoff = new Date(
      now.getTime() - IOT_MQTT_LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000,
    );
    const deleted = await db
      .delete(iotMqttMessageLogs)
      .where(lt(iotMqttMessageLogs.receivedAt, cutoff))
      .returning({ id: iotMqttMessageLogs.id });
    return deleted.length;
  }
}

export const iotMqttMessageLogService = new IotMqttMessageLogService();
