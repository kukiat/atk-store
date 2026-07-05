"use client";

import { ArrowLeft, Clock3, PackageCheck, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { QuantityStepper } from "@/components/quantity-stepper";
import { Button, buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { formatBaht } from "@/lib/format";
import { useHydrated } from "@/lib/use-hydrated";
import { useCartStore } from "@/store/cart";
import { selectOrderTotalPrice, useOrderStore } from "@/store/order";
import type { CartItem } from "@/types";

type IotSessionStatus = "pending" | "matched" | "short" | "over" | "expired";

export default function OrderPage() {
  const router = useRouter();
  const hydrated = useHydrated();
  const items = useOrderStore((state) => state.items);
  const setQty = useOrderStore((state) => state.setQty);
  const removeItem = useOrderStore((state) => state.removeItem);
  const clearOrder = useOrderStore((state) => state.clear);
  const addCartItems = useCartStore((state) => state.addItems);
  const total = useOrderStore(selectOrderTotalPrice);
  const [status, setStatus] = useState<
    "idle" | "submitting" | "waiting" | "error"
  >("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const locked = status === "submitting" || status === "waiting";

  useEffect(() => {
    if (!sessionId || status !== "waiting") return;

    const intervalId = window.setInterval(async () => {
      const response = await fetch(`/api/iot/sessions/${sessionId}`, {
        cache: "no-store",
      });

      if (!response.ok) return;

      const body = (await response.json()) as {
        session?: {
          status: IotSessionStatus;
          message: string;
        };
      };
      if (!body.session) return;

      setMessage(body.session.message);

      if (body.session.status === "matched") {
        window.clearInterval(intervalId);
        addCartItems(items);
        clearOrder();
        router.replace("/cart?verified=1");
        return;
      }

      if (
        body.session.status === "short" ||
        body.session.status === "over" ||
        body.session.status === "expired"
      ) {
        window.clearInterval(intervalId);
        setSessionId(null);
        setStatus("error");
      }
    }, 2000);

    return () => window.clearInterval(intervalId);
  }, [addCartItems, clearOrder, items, router, sessionId, status]);

  async function submitToIot() {
    setStatus("submitting");
    setMessage(null);

    const response = await fetch("/api/iot/watch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });
    const body = (await response.json()) as {
      error?: string;
      message?: string;
      sessionId?: string;
    };

    if (!response.ok) {
      setStatus("error");
      setMessage(body.error ?? "ไม่สามารถส่งข้อมูลไปยัง IOT mock ได้");
      return;
    }

    setStatus("waiting");
    setSessionId(body.sessionId ?? null);
    setMessage(body.message ?? "เปิดตู้แล้ว กำลังรอผลจาก IOT mock");
  }

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 pt-6 pb-8">
      <header className="mb-6 flex items-center gap-3">
        <Link
          href="/"
          onClick={(event) => {
            const returnTo = new URLSearchParams(window.location.search).get(
              "returnTo",
            );
            const isSafeInternalPath =
              returnTo &&
              returnTo.startsWith("/") &&
              !returnTo.startsWith("//") &&
              !returnTo.startsWith("/order");
            if (!isSafeInternalPath) return;

            event.preventDefault();
            router.push(returnTo);
          }}
          aria-label="ย้อนกลับ"
          className={buttonVariants({ variant: "ghost", size: "icon" })}
        >
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="text-xl font-bold">รายการหยิบสินค้า</h1>
      </header>

      {!hydrated ? null : items.length === 0 ? (
        <div className="text-muted-foreground flex flex-col items-center gap-3 py-16 text-center">
          <PackageCheck className="size-10" />
          <p>ยังไม่มีรายการรอเปิดตู้</p>
        </div>
      ) : (
        <>
          <ul className="divide-border divide-y">
            {items.map((item) => (
              <OrderItemRow
                key={item.inventoryId}
                item={item}
                disabled={locked}
                onDelete={() => removeItem(item.inventoryId)}
                onQuantityChange={(qty) => setQty(item.inventoryId, qty)}
              />
            ))}
          </ul>

          <Separator className="my-4" />

          <div className="flex items-center justify-between text-lg font-semibold">
            <span>ยอดรวม</span>
            <span>{formatBaht(total)}</span>
          </div>

          {status === "waiting" ? (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-dashed bg-muted/40 p-3 text-sm text-muted-foreground">
              <Clock3 className="mt-0.5 size-4 shrink-0" />
              <p>รอ IOT ยืนยันสินค้า แล้วระบบจะย้ายรายการนี้ไปตะกร้า</p>
            </div>
          ) : null}

          {message && (
            <p
              className={
                status === "error"
                  ? "text-destructive mt-4 text-sm"
                  : "text-muted-foreground mt-4 text-sm"
              }
            >
              {message}
            </p>
          )}

          <Button
            className="mt-6 w-full"
            size="lg"
            disabled={locked}
            onClick={submitToIot}
          >
            {status === "submitting" && "กำลังเปิดตู้..."}
            {status === "waiting" && "กำลังรอผลจากตู้..."}
            {(status === "idle" || status === "error") && "Submit เพื่อเปิดตู้"}
          </Button>
        </>
      )}
    </main>
  );
}

function OrderItemRow({
  item,
  disabled,
  onDelete,
  onQuantityChange,
}: {
  item: CartItem;
  disabled: boolean;
  onDelete: () => void;
  onQuantityChange: (quantity: number) => void;
}) {
  return (
    <li className="grid gap-2 py-3">
      <div className="flex items-start justify-between gap-3">
        <span className="font-medium">{item.name}</span>
        <button
          type="button"
          disabled={disabled}
          onClick={onDelete}
          aria-label={`ลบ ${item.name} ออกจากรายการหยิบ`}
          className="text-destructive disabled:text-muted-foreground"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
      <div className="flex items-center justify-between">
        <QuantityStepper
          value={item.quantity}
          onChange={onQuantityChange}
          disabled={disabled}
        />
        <span className="font-semibold">
          {formatBaht(item.price * item.quantity)}
        </span>
      </div>
    </li>
  );
}
