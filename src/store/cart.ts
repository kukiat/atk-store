"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { CartItem, Inventory } from "@/types";

type CartState = {
  items: CartItem[];
  addItem: (inventory: Inventory, quantity?: number) => void;
  addItems: (items: CartItem[]) => void;
  setItems: (items: CartItem[]) => void;
  setItemQuantity: (item: CartItem, quantity: number) => void;
  removeItem: (inventoryId: string) => void;
  setQty: (inventoryId: string, quantity: number) => void;
  clear: () => void;
};

function mergeCartItems(currentItems: CartItem[], nextItems: CartItem[]) {
  const byInventoryId = new Map(
    currentItems.map((item) => [item.inventoryId, item]),
  );

  for (const item of nextItems) {
    const existing = byInventoryId.get(item.inventoryId);
    byInventoryId.set(
      item.inventoryId,
      existing
        ? { ...existing, quantity: existing.quantity + item.quantity }
        : item,
    );
  }

  return Array.from(byInventoryId.values());
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],

      addItem: (inventory, quantity = 1) =>
        set((state) => {
          const existing = state.items.find(
            (item) => item.inventoryId === inventory.id,
          );
          if (existing) {
            return {
              items: state.items.map((item) =>
                item.inventoryId === inventory.id
                  ? { ...item, quantity: item.quantity + quantity }
                  : item,
              ),
            };
          }
          return {
            items: [
              ...state.items,
              {
                inventoryId: inventory.id,
                name: inventory.name,
                price: inventory.price,
                weightPerPiece: inventory.weightPerPiece,
                unitId: inventory.unitId,
                imageUrl: inventory.imageUrl,
                quantity,
              },
            ],
          };
        }),

      addItems: (items) =>
        set((state) => ({
          items: mergeCartItems(state.items, items),
        })),

      setItems: (items) => set({ items }),

      setItemQuantity: (item, quantity) =>
        set((state) => ({
          items:
            quantity <= 0
              ? state.items.filter(
                  (cartItem) => cartItem.inventoryId !== item.inventoryId,
                )
              : [
                  ...state.items.filter(
                    (cartItem) => cartItem.inventoryId !== item.inventoryId,
                  ),
                  { ...item, quantity },
                ],
        })),

      removeItem: (inventoryId) =>
        set((state) => ({
          items: state.items.filter((item) => item.inventoryId !== inventoryId),
        })),

      setQty: (inventoryId, quantity) =>
        set((state) => ({
          items:
            quantity <= 0
              ? state.items.filter((item) => item.inventoryId !== inventoryId)
              : state.items.map((item) =>
                  item.inventoryId === inventoryId
                    ? { ...item, quantity }
                    : item,
                ),
        })),

      clear: () => set({ items: [] }),
    }),
    { name: "atk-cart" },
  ),
);

/** Total number of units across all cart lines. */
export const selectTotalCount = (state: CartState): number =>
  state.items.reduce((sum, item) => sum + item.quantity, 0);

/** Total price of the cart in baht. */
export const selectTotalPrice = (state: CartState): number =>
  state.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
