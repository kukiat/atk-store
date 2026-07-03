"use client";

import { ArrowLeft, ShoppingCart, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { QuantityStepper } from "@/components/quantity-stepper";
import { Button, buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { formatBaht } from "@/lib/format";
import { useHydrated } from "@/lib/use-hydrated";
import { selectTotalPrice, useCartStore } from "@/store/cart";

export default function CartPage() {
  const hydrated = useHydrated();
  const items = useCartStore((state) => state.items);
  const setQty = useCartStore((state) => state.setQty);
  const removeItem = useCartStore((state) => state.removeItem);
  const clear = useCartStore((state) => state.clear);
  const total = useCartStore(selectTotalPrice);
  const [status, setStatus] = useState<
    "idle" | "submitting" | "waiting" | "success" | "error"
  >("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId || status !== "waiting") return;

    const intervalId = window.setInterval(async () => {
      const response = await fetch(`/api/iot/sessions/${sessionId}`, {
        cache: "no-store",
      });

      if (!response.ok) return;

      const body = (await response.json()) as {
        session?: {
          status: "pending" | "matched" | "short" | "over" | "expired";
          message: string;
        };
      };
      if (!body.session) return;

      setMessage(body.session.message);

      if (body.session.status === "matched") {
        setStatus("success");
        setSessionId(null);
        clear();
        window.clearInterval(intervalId);
      }
    }, 2000);

    return () => window.clearInterval(intervalId);
  }, [clear, sessionId, status]);

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
          <ul className="divide-border divide-y">
            {items.map((item) => (
              <li key={item.inventoryId} className="flex flex-col gap-2 py-4">
                <div className="flex items-start justify-between gap-3">
                  <span className="font-medium">{item.name}</span>
                  <button
                    type="button"
                    onClick={() => removeItem(item.inventoryId)}
                    className="text-muted-foreground hover:text-destructive shrink-0"
                    aria-label="ลบสินค้า"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <QuantityStepper
                    value={item.quantity}
                    onChange={(qty) => setQty(item.inventoryId, qty)}
                  />
                  <span className="font-semibold">
                    {formatBaht(item.price * item.quantity)}
                  </span>
                </div>
              </li>
            ))}
          </ul>

          <Separator className="my-4" />

          <div className="flex items-center justify-between text-lg font-semibold">
            <span>ยอดรวม</span>
            <span>{formatBaht(total)}</span>
          </div>

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
            disabled={status === "submitting" || status === "waiting"}
            onClick={submitToIot}
          >
            {status === "submitting" && "กำลังเปิดตู้..."}
            {status === "waiting" && "กำลังรอผลจากตู้..."}
            {(status === "idle" ||
              status === "success" ||
              status === "error") &&
              "Submit เพื่อเปิดตู้"}
          </Button>
        </>
      )}
    </main>
  );
}
