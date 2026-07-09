import "server-only";

import { and, asc, eq, ilike, isNull, or } from "drizzle-orm";

import { db } from "@/db";
import { inventories } from "@/db/schema";

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

export type IotInventoryCatalogItem = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  amount: number;
  image_url: string | null;
};

export type ListIotInventoriesInput = {
  limit?: number | null;
  offset?: number | null;
  search?: string | null;
};

function normalizeLimit(value: number | null | undefined) {
  if (!Number.isInteger(value) || !value || value <= 0) return DEFAULT_LIMIT;
  return Math.min(value, MAX_LIMIT);
}

function normalizeOffset(value: number | null | undefined) {
  if (!Number.isInteger(value) || value === undefined || value === null) {
    return 0;
  }
  return Math.max(value, 0);
}

class IotInventoryCatalogService {
  async listInventories(
    input: ListIotInventoriesInput = {},
  ): Promise<IotInventoryCatalogItem[]> {
    const limit = normalizeLimit(input.limit);
    const offset = normalizeOffset(input.offset);
    const search = input.search?.trim();
    const conditions = [
      eq(inventories.isActive, true),
      isNull(inventories.deletedAt),
    ];

    if (search) {
      const pattern = `%${search}%`;
      const searchCondition = or(
        ilike(inventories.name, pattern),
        ilike(inventories.description, pattern),
      );
      if (searchCondition) conditions.push(searchCondition);
    }

    return db
      .select({
        id: inventories.id,
        name: inventories.name,
        description: inventories.description,
        price: inventories.price,
        amount: inventories.amount,
        image_url: inventories.imageUrl,
      })
      .from(inventories)
      .where(and(...conditions))
      .orderBy(asc(inventories.name))
      .limit(limit)
      .offset(offset);
  }
}

export const iotInventoryCatalogService = new IotInventoryCatalogService();
