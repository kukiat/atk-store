"use server";

import { revalidatePath } from "next/cache";

import { requireCurrentUser } from "@/lib/auth";
import { adminUserService } from "@/services/admin-user.service";
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

export async function sendMockPickedCountAction(formData: FormData) {
  const user = await requireCurrentUser();
  await adminUserService.getActor(user);

  const sessionId = readRequiredText(formData, "sessionId");
  const shelfId = readRequiredText(formData, "shelfId");
  const pickedCount = readRequiredInteger(formData, "pickedCount");

  await iotSessionService.applyPickedCount({
    sessionId,
    shelfId,
    pickedCount,
    rawPayload: {
      source: "admin-iot-poc",
      sessionId,
      shelfId,
      pickedCount,
    },
  });

  revalidatePath("/admin/inventory/iot-poc");
  revalidatePath("/admin/inventory/orders");
}

export async function sendMockDoorClosedAction(formData: FormData) {
  const user = await requireCurrentUser();
  await adminUserService.getActor(user);

  const sessionId = readRequiredText(formData, "sessionId");
  const shelfId = readRequiredText(formData, "shelfId");

  await iotSessionService.closeDoor({
    sessionId,
    shelfId,
    rawPayload: {
      source: "admin-iot-poc",
      type: "door_closed",
      sessionId,
      shelfId,
    },
  });

  revalidatePath("/admin/inventory/iot-poc");
  revalidatePath("/admin/inventory/orders");
}
