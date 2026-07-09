import "server-only";

import { and, asc, eq, inArray, isNull } from "drizzle-orm";

import { db } from "@/db";
import { inventories } from "@/db/schema";

class InventoryService {
  async getActiveInventory(inventoryId: string) {
    const [inventory] = await db
      .select()
      .from(inventories)
      .where(
        and(
          eq(inventories.id, inventoryId.trim()),
          eq(inventories.isActive, true),
          isNull(inventories.deletedAt),
        ),
      )
      .limit(1);

    return inventory ?? null;
  }

  async listActiveInventoriesByIds(inventoryIds: string[]) {
    const ids = inventoryIds.map((id) => id.trim()).filter(Boolean);
    if (ids.length === 0) return [];

    return db
      .select()
      .from(inventories)
      .where(
        and(
          inArray(inventories.id, ids),
          eq(inventories.isActive, true),
          isNull(inventories.deletedAt),
        ),
      )
      .orderBy(asc(inventories.name));
  }
}

export const inventoryService = new InventoryService();
