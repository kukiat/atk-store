import type { Inventory, Shelf } from "@/db/schema";

export type { Inventory, Shelf };

/** A shelf together with active inventory items. */
export type ShelfWithInventories = Shelf & {
  inventories: Inventory[];
};

/** A single line in the client-side cart. */
export type CartItem = {
  inventoryId: string;
  shelfId: string;
  name: string;
  price: number;
  weightPerPiece: number;
  unitId: string;
  imageUrl: string | null;
  quantity: number;
};

export type IotTransaction = {
  shelfId: string;
  amount: number;
  weightPerPiece: number;
};
