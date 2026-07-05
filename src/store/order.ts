"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { CartItem, Inventory } from "@/types";

type OrderState = {
  items: CartItem[];
  addItem: (inventory: Inventory, quantity?: number) => void;
  removeItem: (inventoryId: string) => void;
  setQty: (inventoryId: string, quantity: number) => void;
  clear: () => void;
};

export const useOrderStore = create<OrderState>()(
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
                shelfId: inventory.shelfId,
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
    { name: "atk-order" },
  ),
);

export const selectOrderTotalCount = (state: OrderState): number =>
  state.items.reduce((sum, item) => sum + item.quantity, 0);

export const selectOrderTotalPrice = (state: OrderState): number =>
  state.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
