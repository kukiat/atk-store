"use client";

import { ShoppingCart } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { formatBaht } from "@/lib/format";
import { useHydrated } from "@/lib/use-hydrated";
import {
  selectOrderTotalCount,
  selectOrderTotalPrice,
  useOrderStore,
} from "@/store/order";

/**
 * Floating bar pinned to the bottom of the viewport that summarises the draft
 * order and links to /order. The verified cart is separate and only receives
 * items after IOT confirms the pick.
 */
export function CartBar() {
  const router = useRouter();
  const hydrated = useHydrated();
  const count = useOrderStore(selectOrderTotalCount);
  const total = useOrderStore(selectOrderTotalPrice);

  if (!hydrated || count === 0) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-4">
      <Link
        href="/order"
        onClick={(event) => {
          const returnTo = `${window.location.pathname}${window.location.search}`;
          if (returnTo === "/order") return;

          event.preventDefault();
          router.push(`/order?${new URLSearchParams({ returnTo }).toString()}`);
        }}
        className="bg-primary text-primary-foreground mx-auto flex max-w-md items-center justify-between rounded-full px-5 py-3 shadow-lg transition-opacity hover:opacity-90"
      >
        <span className="flex items-center gap-2 font-medium">
          <span className="relative">
            <ShoppingCart className="size-5" />
            <span className="bg-background text-foreground absolute -top-2 -right-2 flex size-4 items-center justify-center rounded-full text-[10px] font-bold">
              {count}
            </span>
          </span>
          ดูรายการหยิบ
        </span>
        <span className="font-semibold">{formatBaht(total)}</span>
      </Link>
    </div>
  );
}
