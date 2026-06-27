"use server";

import { revalidatePath } from "next/cache";

import { requireCurrentUser } from "@/lib/auth";
import { adminUserService } from "@/services/admin-user.service";

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
