import "server-only";

import {
  and,
  asc,
  eq,
  ilike,
  isNotNull,
  isNull,
  or,
  type SQL,
} from "drizzle-orm";

import { db } from "@/db";
import { inventories } from "@/db/schema";

export class LivemapInventoryNotFoundError extends Error {
  constructor() {
    super("Inventory not found");
    this.name = "LivemapInventoryNotFoundError";
  }
}

const selection = {
  id: inventories.id,
  name: inventories.name,
  description: inventories.description,
  imageUrl: inventories.imageUrl,
  anchorId: inventories.anchorId,
};

class LivemapAppService {
  async listInventories(input: {
    query?: string;
    anchored?: boolean;
  }) {
    const conditions: SQL[] = [
      eq(inventories.isActive, true),
      isNull(inventories.deletedAt),
    ];

    if (input.query) {
      const pattern = `%${input.query}%`;
      conditions.push(
        or(
          ilike(inventories.name, pattern),
          ilike(inventories.description, pattern),
        )!,
      );
    }
    if (input.anchored === true) conditions.push(isNotNull(inventories.anchorId));
    if (input.anchored === false) conditions.push(isNull(inventories.anchorId));

    return db
      .select(selection)
      .from(inventories)
      .where(and(...conditions))
      .orderBy(asc(inventories.name));
  }

  async mapAnchor(input: { anchorId: string; inventoryId: string }) {
    const [inventory] = await db
      .update(inventories)
      .set({ anchorId: input.anchorId, updatedAt: new Date() })
      .where(
        and(
          eq(inventories.id, input.inventoryId),
          eq(inventories.isActive, true),
          isNull(inventories.deletedAt),
        ),
      )
      .returning(selection);

    if (!inventory) throw new LivemapInventoryNotFoundError();
    return inventory;
  }

  async findByAnchor(anchorId: string) {
    return db
      .select(selection)
      .from(inventories)
      .where(
        and(
          eq(inventories.anchorId, anchorId),
          eq(inventories.isActive, true),
          isNull(inventories.deletedAt),
        ),
      )
      .orderBy(asc(inventories.name));
  }
}

export const livemapAppService = new LivemapAppService();
