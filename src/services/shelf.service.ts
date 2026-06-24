import "server-only";

import { asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { products, shelfProducts, shelves } from "@/db/schema";
import type { ShelfWithProducts } from "@/types";

/**
 * Business logic for shelves. Combines validation + data access in one layer.
 * Both Server Components and API routes call through here so logic stays in one place.
 */

/**
 * Load a shelf and the products placed on it, ordered by their shelf position.
 * Returns null when the shelf code does not exist.
 */
export async function getShelfWithProducts(
  shelfId: string,
): Promise<ShelfWithProducts | null> {
  const normalizedId = shelfId.trim().toUpperCase();
  if (!normalizedId) return null;

  const shelf = await db.query.shelves.findFirst({
    where: eq(shelves.id, normalizedId),
  });
  if (!shelf) return null;

  const rows = await db
    .select({ product: products })
    .from(shelfProducts)
    .innerJoin(products, eq(shelfProducts.productId, products.id))
    .where(eq(shelfProducts.shelfId, normalizedId))
    .orderBy(asc(shelfProducts.position));

  return { ...shelf, products: rows.map((row) => row.product) };
}
