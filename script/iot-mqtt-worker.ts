import mqtt from "mqtt";

import { loadcellSubscribeTopics } from "@/services/iot-loadcell-contract";
import { iotEventProcessorService } from "@/services/iot-event-processor.service";
import { handleIotMqttMessage } from "@/services/iot-mqtt-message-handler";
import {
  IOT_MQTT_MAX_PAYLOAD_BYTES,
  iotMqttMessageLogService,
} from "@/services/iot-mqtt-message-log.service";

process.loadEnvFile();

const brokerUrl = process.env.MQTT_BROKER_URL?.trim();
const enabled = process.env.MQTT_ENABLED !== "false";
const branchCode = process.env.BRANCH_CODE?.trim() || "main";
const topics = loadcellSubscribeTopics(branchCode);

function logEvent(
  action:
    | "mqtt_worker_started"
    | "mqtt_connected"
    | "mqtt_subscribed"
    | "mqtt_received"
    | "event_processed"
    | "event_process_failed"
    | "mqtt_audit_log_failed"
    | "mqtt_connection_closed"
    | "mqtt_reconnecting"
    | "mqtt_offline",
  data: Record<string, unknown>,
) {
  console.log(JSON.stringify({ action, ...data }));
}

if (!enabled) {
  console.log("MQTT worker disabled by MQTT_ENABLED=false");
  process.exit(0);
}

if (!brokerUrl) {
  console.error("MQTT_BROKER_URL is required");
  process.exit(1);
}

logEvent("mqtt_worker_started", {
  brokerUrl,
  topics,
});

const client = mqtt.connect(brokerUrl, {
  clientId: process.env.MQTT_CLIENT_ID?.trim() || "atk-store-app",
  username: process.env.MQTT_USERNAME?.trim() || undefined,
  password: process.env.MQTT_PASSWORD?.trim() || undefined,
  clean: true,
  reconnectPeriod: 3000,
});

client.on("connect", () => {
  logEvent("mqtt_connected", { brokerUrl, topics });
  client.subscribe(topics, { qos: 1 }, (error, granted) => {
    if (error) {
      console.error("Failed to subscribe MQTT topics", error);
      return;
    }
    logEvent("mqtt_subscribed", { topics, granted });
  });
});

client.on("message", async (receivedTopic, payload) => {
  try {
    logEvent("mqtt_received", { topic: receivedTopic });
    const { payload: parsedPayload, result } = await handleIotMqttMessage(
      receivedTopic,
      payload,
      {
        messageLog: iotMqttMessageLogService,
        eventProcessor: iotEventProcessorService,
        log: (action, data) =>
          logEvent(action as "mqtt_audit_log_failed", data),
      },
    );
    logEvent("event_processed", {
      topic: receivedTopic,
      payload: parsedPayload,
      result,
    });
  } catch (error) {
    logEvent("event_process_failed", {
      topic: receivedTopic,
      payload: payload.subarray(0, IOT_MQTT_MAX_PAYLOAD_BYTES).toString("utf8"),
      error: error instanceof Error ? error.message : "Unknown MQTT error",
    });
  }
});

client.on("error", (error) => {
  console.error("MQTT worker error", error);
});

client.on("reconnect", () => logEvent("mqtt_reconnecting", { brokerUrl }));
client.on("offline", () => logEvent("mqtt_offline", { brokerUrl }));
client.on("close", () => logEvent("mqtt_connection_closed", { brokerUrl }));

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    console.log(`Received ${signal}; closing MQTT worker`);
    client.end(false, () => process.exit(0));
  });
}
