import mqtt from "mqtt";

import {
  loadcellSubscribeTopics,
  normalizeLoadcellMessage,
  parseLoadcellPayload,
} from "@/services/iot-loadcell-contract";
import { iotEventProcessorService } from "@/services/iot-event-processor.service";

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
    | "event_process_failed",
  data: {
    brokerUrl?: string;
    topic?: string;
    topics?: string[];
    payload?: unknown;
    result?: unknown;
    error?: string;
    granted?: unknown;
  },
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
  let parsedPayload: Record<string, unknown> | null = null;

  try {
    parsedPayload = parseLoadcellPayload(payload);
    logEvent("mqtt_received", {
      topic: receivedTopic,
      payload: parsedPayload,
    });

    const event = normalizeLoadcellMessage(receivedTopic, parsedPayload);
    const result = await iotEventProcessorService.process(event);
    logEvent("event_processed", {
      topic: receivedTopic,
      payload: parsedPayload,
      result,
    });
  } catch (error) {
    logEvent("event_process_failed", {
      topic: receivedTopic,
      payload: parsedPayload ?? payload.toString("utf8"),
      error: error instanceof Error ? error.message : "Unknown MQTT error",
    });
  }
});

client.on("error", (error) => {
  console.error("MQTT worker error", error);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    console.log(`Received ${signal}; closing MQTT worker`);
    client.end(false, () => process.exit(0));
  });
}
