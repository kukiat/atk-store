import type { Product, Shelf } from "@/db/schema";

export type { Product, Shelf };

/** A shelf together with the products placed on it, ordered by position. */
export type ShelfWithProducts = Shelf & {
  products: Product[];
};

/** A single line in the client-side cart. */
export type CartItem = {
  productId: number;
  sku: string;
  name: string;
  priceCents: number;
  imageUrl: string | null;
  quantity: number;
};
