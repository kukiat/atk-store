import type { IotLoadcellTopic } from "@/services/iot-loadcell-contract";
import {
  normalizeLoadcellMessage,
  parseLoadcellPayload,
  parseLoadcellTopic,
} from "@/services/iot-loadcell-contract";
import {
  IOT_MQTT_MAX_PAYLOAD_BYTES,
  type IotMqttMessageLogStatus,
} from "@/services/iot-mqtt-message-log.contract";

export { IOT_MQTT_MAX_PAYLOAD_BYTES };

type MessageLog = {
  recordReceived(input: {
    topic: string;
    payloadRaw: string;
    payloadJson: Record<string, unknown> | null;
    payloadSizeBytes: number;
    parsedTopic?: IotLoadcellTopic;
  }): Promise<string>;
  updateOutcome(input: {
    id: string;
    status: Exclude<IotMqttMessageLogStatus, "received">;
    reasonCode?: string | null;
    errorMessage?: string | null;
    parsedTopic?: IotLoadcellTopic;
  }): Promise<void>;
};

type EventProcessor = {
  process(event: ReturnType<typeof normalizeLoadcellMessage>): Promise<unknown>;
};

export type IotMqttHandlerLog = (
  action: string,
  data: Record<string, unknown>,
) => void;

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown MQTT error";
}

function reasonCode(error: unknown) {
  const message = errorMessage(error);
  const knownCodes: Record<string, string> = {
    "MQTT payload exceeds 65536 bytes": "payload_too_large",
    "Loadcell MQTT payload must be valid JSON": "invalid_json",
    "Loadcell MQTT payload must be a JSON object": "invalid_payload_shape",
    "Invalid loadcell MQTT topic": "invalid_topic",
    "Loadcell topic branch does not match BRANCH_CODE": "branch_mismatch",
    "Loadcell payload branch does not match BRANCH_CODE":
      "payload_branch_mismatch",
    "Loadcell payload sku does not match topic inventory id": "sku_mismatch",
    "sessionSummary.takenTotal must be a non-negative integer":
      "invalid_session_taken_total",
    "Unsupported loadcell status": "unsupported_status",
    "IOT session not found": "unknown_session",
    "Inventory is not part of this IOT session": "inventory_mismatch",
  };
  return knownCodes[message] ?? "processing_error";
}

function isRejected(error: unknown) {
  return reasonCode(error) !== "processing_error";
}

async function bestEffortOutcome(
  messageLog: MessageLog,
  logId: string | null,
  input: Omit<Parameters<MessageLog["updateOutcome"]>[0], "id">,
  log: IotMqttHandlerLog,
) {
  if (!logId) return;
  try {
    await messageLog.updateOutcome({ id: logId, ...input });
  } catch (error) {
    log("mqtt_audit_log_failed", {
      phase: "update_outcome",
      logId,
      error: errorMessage(error),
    });
  }
}

export async function handleIotMqttMessage(
  topic: string,
  payload: Buffer,
  dependencies: {
    messageLog: MessageLog;
    eventProcessor: EventProcessor;
    log: IotMqttHandlerLog;
  },
) {
  const payloadSizeBytes = payload.byteLength;
  const storedPayload = payload.subarray(0, IOT_MQTT_MAX_PAYLOAD_BYTES);
  const payloadRaw = storedPayload.toString("utf8");
  let parsedTopic: IotLoadcellTopic | undefined;
  let payloadJson: Record<string, unknown> | null = null;
  let validationError: unknown = null;

  try {
    if (payloadSizeBytes > IOT_MQTT_MAX_PAYLOAD_BYTES) {
      throw new Error(
        `MQTT payload exceeds ${IOT_MQTT_MAX_PAYLOAD_BYTES} bytes`,
      );
    }
    parsedTopic = parseLoadcellTopic(topic);
    try {
      payloadJson = parseLoadcellPayload(payload);
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error("Loadcell MQTT payload must be valid JSON");
      }
      throw error;
    }
  } catch (error) {
    validationError = error;
  }

  let logId: string | null = null;
  try {
    logId = await dependencies.messageLog.recordReceived({
      topic,
      payloadRaw,
      payloadJson,
      payloadSizeBytes,
      parsedTopic,
    });
  } catch (error) {
    dependencies.log("mqtt_audit_log_failed", {
      phase: "record_received",
      topic,
      error: errorMessage(error),
    });
  }

  if (validationError || !payloadJson) {
    const error = validationError ?? new Error("Invalid MQTT payload");
    await bestEffortOutcome(
      dependencies.messageLog,
      logId,
      {
        status: "rejected",
        reasonCode: reasonCode(error),
        errorMessage: errorMessage(error),
        parsedTopic,
      },
      dependencies.log,
    );
    throw error;
  }

  try {
    const event = normalizeLoadcellMessage(topic, payloadJson);
    const result = await dependencies.eventProcessor.process(event);
    await bestEffortOutcome(
      dependencies.messageLog,
      logId,
      {
        status: "processed",
        parsedTopic,
      },
      dependencies.log,
    );
    return { event, result, payload: payloadJson };
  } catch (error) {
    await bestEffortOutcome(
      dependencies.messageLog,
      logId,
      {
        status: isRejected(error) ? "rejected" : "failed",
        reasonCode: reasonCode(error),
        errorMessage: errorMessage(error),
        parsedTopic,
      },
      dependencies.log,
    );
    throw error;
  }
}
