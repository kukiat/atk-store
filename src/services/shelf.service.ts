import "server-only";

import { and, asc, eq, isNull, inArray } from "drizzle-orm";

import { db } from "@/db";
import { inventories, shelfs } from "@/db/schema";
import type { ShelfWithInventories } from "@/types";

class ShelfService {
  async getShelfWithInventories(
    shelfId: string,
  ): Promise<ShelfWithInventories | null> {
    const normalizedId = shelfId.trim();
    if (!normalizedId) return null;

    const shelf = await db.query.shelfs.findFirst({
      where: and(eq(shelfs.id, normalizedId), isNull(shelfs.deletedAt)),
    });
    if (!shelf) return null;

    const rows = await db
      .select()
      .from(inventories)
      .where(
        and(
          eq(inventories.shelfId, shelf.id),
          eq(inventories.isActive, true),
          isNull(inventories.deletedAt),
        ),
      )
      .orderBy(asc(inventories.name));

    return { ...shelf, inventories: rows };
  }

  async listShelvesByIds(
    shelfIds: string[],
  ): Promise<(typeof shelfs.$inferSelect)[]> {
    const ids = shelfIds.map((id) => id.trim()).filter(Boolean);
    if (ids.length === 0) return [];

    return db
      .select()
      .from(shelfs)
      .where(and(inArray(shelfs.id, ids), isNull(shelfs.deletedAt)))
      .orderBy(asc(shelfs.name));
  }
}

export const shelfService = new ShelfService();
