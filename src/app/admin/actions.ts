"use server";

import { revalidatePath } from "next/cache";

import { requireCurrentUser } from "@/lib/auth";
import { adminInventoryService } from "@/services/admin-inventory.service";
import { adminUserService } from "@/services/admin-user.service";
import { clientAttendanceService } from "@/services/client-attendance.service";

async function requireAdminActor() {
  const user = await requireCurrentUser();
  return adminUserService.getActor(user);
}

function readUserId(formData: FormData): number {
  const raw = formData.get("userId");
  const userId = typeof raw === "string" ? Number(raw) : NaN;
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new Error("Invalid user id");
  }
  return userId;
}

function readManualAttendanceDirection(formData: FormData): "entry" | "exit" {
  const raw = formData.get("direction");
  if (raw === "entry" || raw === "exit") return raw;
  throw new Error("Invalid attendance direction");
}

export async function grantAdminRoleAction(formData: FormData) {
  const actor = await requireAdminActor();
  const email = formData.get("email");
  if (typeof email !== "string") throw new Error("Email is required");

  await adminUserService.grantAdminByEmail(actor, email);
  revalidatePath("/admin/users");
}

export async function blockUserAction(formData: FormData) {
  const actor = await requireAdminActor();
  const userId = readUserId(formData);

  await adminUserService.updateUserStatus({
    actor,
    targetUserId: userId,
    status: "blocked",
    reason: adminUserService.readReason(formData),
  });
  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}`);
}

export async function disableUserAction(formData: FormData) {
  const actor = await requireAdminActor();
  const userId = readUserId(formData);

  await adminUserService.updateUserStatus({
    actor,
    targetUserId: userId,
    status: "disabled",
    reason: adminUserService.readReason(formData),
    disabledUntil: adminUserService.parseDisableUntil(
      formData.get("disabledUntil"),
    ),
  });
  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}`);
}

export async function unblockUserAction(formData: FormData) {
  const actor = await requireAdminActor();
  const userId = readUserId(formData);

  await adminUserService.updateUserStatus({
    actor,
    targetUserId: userId,
    status: "active",
  });
  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}`);
}

export async function resetFaceEnrollmentAction(formData: FormData) {
  const actor = await requireAdminActor();
  const userId = readUserId(formData);

  await adminUserService.resetFaceEnrollment(actor, userId);
  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}`);
}

export async function revokeAdminRoleAction(formData: FormData) {
  const actor = await requireAdminActor();
  const userId = readUserId(formData);

  await adminUserService.revokeAdminRole(actor, userId);
  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}`);
}

export async function setManualAttendanceStatusAction(formData: FormData) {
  const actor = await requireAdminActor();
  const userId = readUserId(formData);
  const direction = readManualAttendanceDirection(formData);
  const target = (await adminUserService.listUsers(actor)).find(
    (item) => item.user.id === userId,
  );

  if (!target) {
    throw new Error("Cannot override attendance for this user");
  }

  const result = await clientAttendanceService.manualOverride({
    actorUserId: actor.user.id,
    targetUserId: userId,
    direction,
    metadata: {
      adminPage: "/admin/attendance",
    },
  });

  await adminUserService.writeAudit({
    actorUserId: actor.user.id,
    targetUserId: userId,
    action: `client_attendance.manual_${direction}`,
    metadata: {
      eventId: result.event.id,
      visitId: result.visit?.id ?? null,
      checkoutStatus: result.checkout?.status ?? null,
      cameraId: result.event.cameraId,
    },
  });

  revalidatePath("/admin/attendance");
  revalidatePath(`/admin/users/${userId}`);
}

async function revalidateInventoryAdmin() {
  revalidatePath("/admin/inventory", "layout");
}

export async function saveUnitAction(formData: FormData) {
  const actor = await requireAdminActor();
  await adminInventoryService.saveUnit(actor, formData);
  await revalidateInventoryAdmin();
}

export async function deleteUnitAction(formData: FormData) {
  const actor = await requireAdminActor();
  await adminInventoryService.deleteUnit(actor, formData);
  await revalidateInventoryAdmin();
}

export async function saveInventoryAction(formData: FormData) {
  const actor = await requireAdminActor();
  await adminInventoryService.saveInventory(actor, formData);
  await revalidateInventoryAdmin();
}

export async function deleteInventoryAction(formData: FormData) {
  const actor = await requireAdminActor();
  await adminInventoryService.deleteInventory(actor, formData);
  await revalidateInventoryAdmin();
}

export async function importInventoriesAction(formData: FormData) {
  const actor = await requireAdminActor();
  await adminInventoryService.importInventories(actor, formData);
  await revalidateInventoryAdmin();
}

export async function createQrCodeAction(formData: FormData) {
  const actor = await requireAdminActor();
  await adminInventoryService.createQrCode(actor, formData);
  await revalidateInventoryAdmin();
}

export async function deleteQrCodeAction(formData: FormData) {
  const actor = await requireAdminActor();
  await adminInventoryService.deleteQrCode(actor, formData);
  await revalidateInventoryAdmin();
}
