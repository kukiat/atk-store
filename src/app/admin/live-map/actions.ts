"use server";

import { revalidatePath } from "next/cache";

import { requireCurrentUser } from "@/lib/auth";
import { adminUserService } from "@/services/admin-user.service";
import { liveMapService } from "@/services/live-map.service";

async function requireAdminActor() {
  const user = await requireCurrentUser();
  return adminUserService.getActor(user);
}

function revalidateLiveMap() {
  revalidatePath("/admin/live-map");
}

export async function createNavigationFloorAction(formData: FormData) {
  await liveMapService.createFloor(await requireAdminActor(), formData);
  revalidateLiveMap();
}

export async function updateNavigationFloorAction(formData: FormData) {
  await liveMapService.updateFloor(await requireAdminActor(), formData);
  revalidateLiveMap();
}

export async function saveNavigationBoundaryAction(formData: FormData) {
  await liveMapService.saveBoundary(await requireAdminActor(), formData);
  revalidateLiveMap();
}

export async function createNavigationAnchorAction(formData: FormData) {
  await liveMapService.createAnchor(await requireAdminActor(), formData);
  revalidateLiveMap();
}

export async function updateNavigationAnchorAction(formData: FormData) {
  await liveMapService.updateAnchor(await requireAdminActor(), formData);
  revalidateLiveMap();
}

export async function createNavigationPathAction(formData: FormData) {
  await liveMapService.createPath(await requireAdminActor(), formData);
  revalidateLiveMap();
}

export async function updateNavigationPathAction(formData: FormData) {
  await liveMapService.updatePath(await requireAdminActor(), formData);
  revalidateLiveMap();
}

export async function createNavigationRestrictedAreaAction(formData: FormData) {
  await liveMapService.createRestrictedArea(
    await requireAdminActor(),
    formData,
  );
  revalidateLiveMap();
}

export async function updateNavigationRestrictedAreaAction(formData: FormData) {
  await liveMapService.updateRestrictedArea(
    await requireAdminActor(),
    formData,
  );
  revalidateLiveMap();
}

export async function createInventoryNavigationLocationAction(
  formData: FormData,
) {
  await liveMapService.createLocation(await requireAdminActor(), formData);
  revalidateLiveMap();
}

export async function updateInventoryNavigationLocationAction(
  formData: FormData,
) {
  await liveMapService.updateLocation(await requireAdminActor(), formData);
  revalidateLiveMap();
}

export async function deleteNavigationFeatureAction(formData: FormData) {
  const type = formData.get("type");
  const id = formData.get("id");
  if (
    (type !== "boundary" &&
      type !== "anchor" &&
      type !== "path" &&
      type !== "restrictedArea" &&
      type !== "location") ||
    typeof id !== "string" ||
    !id
  ) {
    throw new Error("Invalid navigation feature");
  }
  await liveMapService.deleteFeature(await requireAdminActor(), type, id);
  revalidateLiveMap();
}
