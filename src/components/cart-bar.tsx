"use client";

import { ShoppingCart } from "lucide-react";
import Link from "next/link";

import { formatBaht } from "@/lib/format";
import { useHydrated } from "@/lib/use-hydrated";
import { selectTotalCount, selectTotalPrice, useCartStore } from "@/store/cart";

/**
 * Floating bar pinned to the bottom of the viewport that summarises the cart
 * and links to /cart. Hidden until mounted (avoids hydration mismatch from the
 * persisted localStorage state) and when the cart is empty.
 */
export function CartBar() {
  const hydrated = useHydrated();
  const count = useCartStore(selectTotalCount);
  const total = useCartStore(selectTotalPrice);

  if (!hydrated || count === 0) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-4">
      <Link
        href="/cart"
        className="bg-primary text-primary-foreground mx-auto flex max-w-md items-center justify-between rounded-full px-5 py-3 shadow-lg transition-opacity hover:opacity-90"
      >
        <span className="flex items-center gap-2 font-medium">
          <span className="relative">
            <ShoppingCart className="size-5" />
            <span className="bg-background text-foreground absolute -top-2 -right-2 flex size-4 items-center justify-center rounded-full text-[10px] font-bold">
              {count}
            </span>
          </span>
          ดูตะกร้า
        </span>
        <span className="font-semibold">{formatBaht(total)}</span>
      </Link>
    </div>
  );
}
