"use client";

import { ArrowLeft, CheckCircle2, Clock3, ShoppingCart } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { formatBaht } from "@/lib/format";
import { useHydrated } from "@/lib/use-hydrated";
import { selectTotalPrice, useCartStore } from "@/store/cart";
import type { CartItem } from "@/types";

type ActiveVisitCheckoutStatus = {
  visit: {
    id: number;
    status: "inside" | "exited" | "unknown_exit";
    enteredAt: string;
    exitedAt: string | null;
  } | null;
  order: {
    id: string;
    status: "pending" | "paid" | "failed" | "cancelled";
    paymentStatus: "pending" | "paid" | "failed" | "cancelled";
    totalPrice: number;
    createdAt: string;
  } | null;
};

export default function CartPage() {
  const router = useRouter();
  const hydrated = useHydrated();
  const items = useCartStore((state) => state.items);
  const clear = useCartStore((state) => state.clear);
  const total = useCartStore(selectTotalPrice);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"info" | "warning">("info");

  useEffect(() => {
    if (!hydrated || items.length === 0) return;

    const events = new EventSource("/api/orders/active-visit-events");

    function handleCheckoutStatus(event: MessageEvent<string>) {
      const body = JSON.parse(event.data) as ActiveVisitCheckoutStatus;

      if (
        body.order?.status === "paid" &&
        body.order.paymentStatus === "paid"
      ) {
        clear();
        events.close();
        router.replace("/?checkout=paid");
        return;
      }

      if (body.visit?.status === "exited") {
        setMessageTone("warning");
        setMessage(
          body.order
            ? "ออกจากร้านแล้ว แต่สถานะชำระเงินยังไม่สำเร็จ กรุณาติดต่อพนักงาน"
            : "ออกจากร้านแล้ว แต่ยังไม่พบคำสั่งซื้อ กรุณาติดต่อพนักงาน",
        );
      }
    }

    function handleCheckoutError(event: MessageEvent<string>) {
      const body = JSON.parse(event.data) as { message?: string };
      setMessageTone("warning");
      setMessage(body.message ?? "ไม่สามารถอ่านสถานะชำระเงินได้");
    }

    events.addEventListener(
      "checkout-status",
      handleCheckoutStatus as EventListener,
    );
    events.addEventListener(
      "checkout-error",
      handleCheckoutError as EventListener,
    );

    return () => events.close();
  }, [clear, hydrated, items.length, router]);

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 pt-6 pb-8">
      <header className="mb-6 flex items-center gap-3">
        <Link
          href="/"
          aria-label="ย้อนกลับ"
          className={buttonVariants({ variant: "ghost", size: "icon" })}
        >
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="text-xl font-bold">ตะกร้าสินค้า</h1>
      </header>

      {!hydrated ? null : items.length === 0 ? (
        <div className="text-muted-foreground flex flex-col items-center gap-3 py-16 text-center">
          <ShoppingCart className="size-10" />
          <p>ยังไม่มีสินค้าในตะกร้า</p>
        </div>
      ) : (
        <>
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
            <p>สินค้าในตะกร้ายืนยันกับ IOT แล้ว รอ checkout ตอนออกจากร้าน</p>
          </div>

          <ul className="divide-border divide-y">
            {items.map((item) => (
              <VerifiedCartItem key={item.inventoryId} item={item} />
            ))}
          </ul>

          <Separator className="my-4" />

          <div className="flex items-center justify-between text-lg font-semibold">
            <span>ยอดรวม</span>
            <span>{formatBaht(total)}</span>
          </div>

          <div className="mt-4 flex items-start gap-2 rounded-lg border border-dashed bg-muted/40 p-3 text-sm text-muted-foreground">
            <Clock3 className="mt-0.5 size-4 shrink-0" />
            <p>
              เมื่อกล้องขาออกยืนยันตัวตน ระบบจะตัด wallet และสร้าง order
              อัตโนมัติ
            </p>
          </div>

          {message && (
            <p
              className={
                messageTone === "warning"
                  ? "text-destructive mt-4 text-sm"
                  : "text-muted-foreground mt-4 text-sm"
              }
            >
              {message}
            </p>
          )}
        </>
      )}
    </main>
  );
}

function VerifiedCartItem({ item }: { item: CartItem }) {
  return (
    <li className="grid gap-2 py-3">
      <div className="flex items-start justify-between gap-3">
        <span className="font-medium">{item.name}</span>
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="size-3" />
          Verified
        </span>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground tabular-nums">
          {item.quantity} ชิ้น x {formatBaht(item.price)}
        </span>
        <span className="font-semibold">
          {formatBaht(item.price * item.quantity)}
        </span>
      </div>
    </li>
  );
}
