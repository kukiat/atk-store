"use client";

import { ArrowLeft, ShoppingCart, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type PointerEvent } from "react";

import { QuantityStepper } from "@/components/quantity-stepper";
import { Button, buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { formatBaht } from "@/lib/format";
import { useHydrated } from "@/lib/use-hydrated";
import { selectTotalPrice, useCartStore } from "@/store/cart";
import type { CartItem } from "@/types";

const SWIPE_REVEAL_WIDTH = 88;
const SWIPE_DELETE_THRESHOLD = 144;

export default function CartPage() {
  const router = useRouter();
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
  const cartLocked = status === "submitting" || status === "waiting";

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
          onClick={(event) => {
            const returnTo = new URLSearchParams(window.location.search).get(
              "returnTo",
            );
            const isSafeInternalPath =
              returnTo &&
              returnTo.startsWith("/") &&
              !returnTo.startsWith("//") &&
              !returnTo.startsWith("/cart");
            if (!isSafeInternalPath) return;

            event.preventDefault();
            router.push(returnTo);
          }}
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
              <SwipeCartItem
                key={item.inventoryId}
                item={item}
                disabled={cartLocked}
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

function SwipeCartItem({
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
  const [offset, setOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const offsetRef = useRef(0);
  const gestureRef = useRef<{
    active: boolean;
    pointerId: number | null;
    startX: number;
    startY: number;
    startOffset: number;
    lock: "x" | "y" | null;
  }>({
    active: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    startOffset: 0,
    lock: null,
  });

  function setSwipeOffset(value: number) {
    offsetRef.current = value;
    setOffset(value);
  }

  function handleDelete() {
    setSwipeOffset(0);
    onDelete();
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (disabled) return;
    if (
      event.target instanceof Element &&
      event.target.closest("button,input")
    ) {
      return;
    }

    gestureRef.current = {
      active: true,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startOffset: offsetRef.current,
      lock: null,
    };
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const gesture = gestureRef.current;
    if (!gesture.active || gesture.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - gesture.startX;
    const deltaY = event.clientY - gesture.startY;

    if (!gesture.lock && Math.max(Math.abs(deltaX), Math.abs(deltaY)) > 8) {
      gesture.lock = Math.abs(deltaX) > Math.abs(deltaY) ? "x" : "y";
    }

    if (gesture.lock === "y") return;
    event.preventDefault();

    const nextOffset = Math.min(
      0,
      Math.max(
        -SWIPE_DELETE_THRESHOLD - 24,
        gesture.startOffset + Math.min(deltaX, 24),
      ),
    );
    setSwipeOffset(nextOffset);
  }

  function finishSwipe() {
    const currentOffset = offsetRef.current;
    gestureRef.current.active = false;
    gestureRef.current.pointerId = null;
    setIsDragging(false);

    if (currentOffset <= -SWIPE_DELETE_THRESHOLD) {
      handleDelete();
      return;
    }

    setSwipeOffset(
      currentOffset <= -SWIPE_REVEAL_WIDTH / 2 ? -SWIPE_REVEAL_WIDTH : 0,
    );
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    if (gestureRef.current.pointerId !== event.pointerId) return;
    finishSwipe();
  }

  function handlePointerCancel(event: PointerEvent<HTMLDivElement>) {
    if (gestureRef.current.pointerId !== event.pointerId) return;
    gestureRef.current.active = false;
    gestureRef.current.pointerId = null;
    setIsDragging(false);
    setSwipeOffset(0);
  }

  return (
    <li className="py-3">
      <div className="relative overflow-hidden rounded-lg bg-destructive">
        <button
          type="button"
          onClick={handleDelete}
          disabled={disabled}
          aria-label={`ลบ ${item.name} ออกจากตะกร้า`}
          className="text-destructive-foreground absolute inset-y-0 right-0 flex w-24 items-center justify-center gap-1.5 text-sm font-medium disabled:opacity-50"
        >
          <Trash2 className="size-4" />
          ลบ
        </button>

        <div
          className={
            isDragging
              ? "bg-background touch-pan-y px-1 py-1"
              : "bg-background touch-pan-y px-1 py-1 transition-transform duration-150 ease-out"
          }
          style={{ transform: `translate3d(${offset}px, 0, 0)` }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
        >
          <div className="grid gap-2 py-1">
            <div className="flex items-start justify-between gap-3">
              <span className="font-medium">{item.name}</span>
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
          </div>
        </div>
      </div>
    </li>
  );
}
