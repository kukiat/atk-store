import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { products } from "@/db/schema";
import type { Product } from "@/types";

/**
 * Business logic for products. Add stock checks, pricing rules, etc. here.
 * Use the shared `productService` singleton.
 */
class ProductService {
  /** Load a single product by id. Returns null when it does not exist. */
  async getProductById(id: number): Promise<Product | null> {
    if (!Number.isInteger(id) || id <= 0) return null;

    const product = await db.query.products.findFirst({
      where: eq(products.id, id),
    });
    return product ?? null;
  }

  /** Whether a product can currently be added to the cart. */
  isInStock(product: Product): boolean {
    return product.stock > 0;
  }
}

export const productService = new ProductService();
