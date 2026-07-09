"use server";

import { randomUUID } from "node:crypto";

import mqtt from "mqtt";
import { revalidatePath } from "next/cache";

import { requireCurrentUser } from "@/lib/auth";
import { adminUserService } from "@/services/admin-user.service";
import { iotEventProcessorService } from "@/services/iot-event-processor.service";
import {
  normalizeLoadcellMessage,
  type IotNormalizedLoadcellEvent,
} from "@/services/iot-loadcell-contract";
import { iotSessionService } from "@/services/iot-session.service";

function readRequiredText(formData: FormData, key: string): string {
  const value = formData.get(key);
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${key} is required`);
  }

  return value.trim();
}

function readRequiredInteger(formData: FormData, key: string): number {
  const raw = readRequiredText(formData, key);
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${key} must be a non-negative integer`);
  }

  return value;
}

function getPocEventTransport() {
  return (
    process.env.IOT_POC_EVENT_TRANSPORT?.split("#")[0]?.trim().toLowerCase() ??
    "direct"
  );
}

function branchCode() {
  return process.env.BRANCH_CODE?.trim() || "main";
}

function buildTopic(input: {
  sessionId: string;
  inventoryId: string;
  kind: "event" | "status";
}) {
  return `${input.sessionId}/loadcell/${branchCode()}/${input.inventoryId}/${input.kind}`;
}

async function publishMqttEvent(input: {
  topic: string;
  payload: Record<string, unknown>;
}) {
  const brokerUrl = process.env.MQTT_BROKER_URL?.trim();
  if (!brokerUrl) throw new Error("MQTT_BROKER_URL is required");

  const client = await mqtt.connectAsync(brokerUrl, {
    clientId: `${process.env.MQTT_CLIENT_ID?.trim() || "atk-store-app"}-poc-${randomUUID()}`,
    username: process.env.MQTT_USERNAME?.trim() || undefined,
    password: process.env.MQTT_PASSWORD?.trim() || undefined,
    clean: true,
  });

  try {
    await client.publishAsync(input.topic, JSON.stringify(input.payload), {
      qos: 1,
    });
  } finally {
    await client.endAsync();
  }
}

async function sendIotPocEvent(event: IotNormalizedLoadcellEvent) {
  if (getPocEventTransport() === "mqtt") {
    await publishMqttEvent({
      topic: buildTopic({
        sessionId: event.sessionId,
        inventoryId: event.inventoryId,
        kind: event.type === "picked_count" ? "event" : "status",
      }),
      payload: event.rawPayload,
    });
    return;
  }

  await iotEventProcessorService.process(event);
}

async function buildPickedEvent(formData: FormData) {
  const sessionId = readRequiredText(formData, "sessionId");
  const pickedQty = readRequiredInteger(formData, "pickedCount");
  const currentQty = readRequiredInteger(formData, "currentQty");
  const session = await iotSessionService.getSession(sessionId);
  if (!session) throw new Error("IOT session not found");

  const payload = {
    deviceId: "mock-device",
    branch: session.branchCode,
    event: "item_picked",
    seq: Date.now(),
    sku: session.inventoryId,
    itemName: session.inventoryName,
    currentQty,
    pickedQty,
    timestamp: new Date().toISOString(),
  };

  return normalizeLoadcellMessage(
    buildTopic({
      sessionId: session.sessionId,
      inventoryId: session.inventoryId,
      kind: "event",
    }),
    payload,
  );
}

async function buildDoorClosedEvent(formData: FormData) {
  const sessionId = readRequiredText(formData, "sessionId");
  const session = await iotSessionService.getSession(sessionId);
  if (!session) throw new Error("IOT session not found");

  const payload = {
    deviceId: "mock-device",
    branch: session.branchCode,
    seq: Date.now(),
    online: true,
    status: "shelf_closed",
    timestamp: new Date().toISOString(),
  };

  return normalizeLoadcellMessage(
    buildTopic({
      sessionId: session.sessionId,
      inventoryId: session.inventoryId,
      kind: "status",
    }),
    payload,
  );
}

export async function sendMockPickedCountAction(formData: FormData) {
  const user = await requireCurrentUser();
  await adminUserService.getActor(user);

  await sendIotPocEvent(await buildPickedEvent(formData));

  revalidatePath("/admin/inventory/iot-poc");
  revalidatePath("/admin/inventory/orders");
}

export async function sendMockFinalCountAction(formData: FormData) {
  return sendMockPickedCountAction(formData);
}

export async function sendMockDoorClosedAction(formData: FormData) {
  const user = await requireCurrentUser();
  await adminUserService.getActor(user);

  await sendIotPocEvent(await buildDoorClosedEvent(formData));

  revalidatePath("/admin/inventory/iot-poc");
  revalidatePath("/admin/inventory/orders");
}
