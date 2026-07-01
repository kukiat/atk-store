import "server-only";

import { requireCurrentUser } from "@/lib/auth";
import { adminInventoryService } from "@/services/admin-inventory.service";
import { adminUserService } from "@/services/admin-user.service";

export async function getInventoryAdminData() {
  const user = await requireCurrentUser();
  const actor = await adminUserService.getActor(user);
  return adminInventoryService.getDashboardData(actor);
}
