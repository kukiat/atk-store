"use client";

import { ArrowLeft, ShoppingCart, Trash2 } from "lucide-react";
import Link from "next/link";

import { QuantityStepper } from "@/components/quantity-stepper";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { formatPrice } from "@/lib/format";
import { useHydrated } from "@/lib/use-hydrated";
import { selectTotalCents, useCartStore } from "@/store/cart";

export default function CartPage() {
  const hydrated = useHydrated();
  const items = useCartStore((state) => state.items);
  const setQty = useCartStore((state) => state.setQty);
  const removeItem = useCartStore((state) => state.removeItem);
  const total = useCartStore(selectTotalCents);

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 pt-6 pb-8">
      <header className="mb-6 flex items-center gap-3">
        <Button
          render={<Link href="/" aria-label="ย้อนกลับ" />}
          variant="ghost"
          size="icon"
        >
          <ArrowLeft className="size-5" />
        </Button>
        <h1 className="text-xl font-bold">ตะกร้าสินค้า</h1>
      </header>

      {!hydrated ? null : items.length === 0 ? (
        <div className="text-muted-foreground flex flex-col items-center gap-3 py-16 text-center">
          <ShoppingCart className="size-10" />
          <p>ยังไม่มีสินค้าในตะกร้า</p>
        </div>
      ) : (
        <>
          <ul className="divide-border divide-y">
            {items.map((item) => (
              <li key={item.productId} className="flex flex-col gap-2 py-4">
                <div className="flex items-start justify-between gap-3">
                  <span className="font-medium">{item.name}</span>
                  <button
                    type="button"
                    onClick={() => removeItem(item.productId)}
                    className="text-muted-foreground hover:text-destructive shrink-0"
                    aria-label="ลบสินค้า"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <QuantityStepper
                    value={item.quantity}
                    onChange={(qty) => setQty(item.productId, qty)}
                  />
                  <span className="font-semibold">
                    {formatPrice(item.priceCents * item.quantity)}
                  </span>
                </div>
              </li>
            ))}
          </ul>

          <Separator className="my-4" />

          <div className="flex items-center justify-between text-lg font-semibold">
            <span>ยอดรวม</span>
            <span>{formatPrice(total)}</span>
          </div>

          {/* TODO(payment): wire up real checkout / payment provider (PromptPay, card). */}
          {/* TODO(order): convert this client cart into an order row in Postgres. */}
          <Button className="mt-6 w-full" size="lg" disabled>
            ชำระเงิน (เร็ว ๆ นี้)
          </Button>
        </>
      )}
    </main>
  );
}
