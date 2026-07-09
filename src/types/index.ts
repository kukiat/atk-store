import type { Inventory } from "@/db/schema";

export type { Inventory };

/** A single line in the client-side cart. */
export type CartItem = {
  inventoryId: string;
  name: string;
  price: number;
  weightPerPiece: number;
  unitId: string;
  imageUrl: string | null;
  quantity: number;
};

export type IotTransaction = {
  inventoryId: string;
  channelId: string;
};
