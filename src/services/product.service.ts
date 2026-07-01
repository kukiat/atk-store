import "server-only";

import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import { inventories } from "@/db/schema";
import type { Inventory } from "@/types";

class ProductService {
  async getProductById(id: string): Promise<Inventory | null> {
    const product = await db.query.inventories.findFirst({
      where: and(eq(inventories.id, id), isNull(inventories.deletedAt)),
    });

    return product ?? null;
  }

  isInStock(product: Inventory): boolean {
    return product.isActive && product.amount > 0;
  }
}

export const productService = new ProductService();
