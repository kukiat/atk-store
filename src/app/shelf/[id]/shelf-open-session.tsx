"use client";

import { CheckCircle2, Clock3, DoorOpen, ShoppingCart } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { formatBaht } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useCartStore } from "@/store/cart";
import type { CartItem, Inventory, Shelf } from "@/types";

type SessionStatus = "open" | "updated" | "closed" | "expired";

type SessionShelf = {
  shelfId: string;
  channelId: string;
  pickedCount: number;
  status: "open" | "updated" | "closed";
  doorClosedAt: string | null;
};

type IotSessionResponse = {
  session?: {
    status: SessionStatus;
    message: string;
    items: CartItem[];
    shelves: SessionShelf[];
  };
};

type OpenShelfResponse = {
  error?: string;
  message?: string;
  sessionId?: string;
  channelId?: string;
  inventory?: CartItem;
};

export function ShelfOpenSession({
  shelf,
  product,
}: {
  shelf: Shelf;
  product: Inventory;
}) {
  const setItemQuantity = useCartStore((state) => state.setItemQuantity);
  const [status, setStatus] = useState<
    "opening" | "open" | "updated" | "closed" | "error"
  >("opening");
  const [message, setMessage] = useState("กำลังเปิดตู้...");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [channelId, setChannelId] = useState<string | null>(null);
  const [pickedCount, setPickedCount] = useState(0);
  const openedRef = useRef(false);
  const fallbackItem: CartItem = useMemo(
    () => ({
      inventoryId: product.id,
      shelfId: product.shelfId,
      name: product.name,
      price: product.price,
      weightPerPiece: product.weightPerPiece,
      unitId: product.unitId,
      imageUrl: product.imageUrl,
      quantity: 0,
    }),
    [
      product.id,
      product.imageUrl,
      product.name,
      product.price,
      product.shelfId,
      product.unitId,
      product.weightPerPiece,
    ],
  );

  useEffect(() => {
    if (openedRef.current) return;
    openedRef.current = true;

    async function openShelf() {
      const response = await fetch("/api/iot/watch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shelfId: shelf.id }),
      });
      const body = (await response.json()) as OpenShelfResponse;

      if (!response.ok) {
        setStatus("error");
        setMessage(body.error ?? "ไม่สามารถเปิดตู้ได้");
        return;
      }

      setStatus("open");
      setSessionId(body.sessionId ?? null);
      setChannelId(body.channelId ?? null);
      setMessage(body.message ?? "เปิดตู้แล้ว หยิบสินค้าได้เลย");
    }

    void openShelf();
  }, [shelf.id]);

  useEffect(() => {
    if (!sessionId) return;

    const events = new EventSource(`/api/iot/sessions/${sessionId}/events`);

    function handleSessionUpdated(event: MessageEvent<string>) {
      const body = JSON.parse(event.data) as IotSessionResponse;
      const session = body.session;
      if (!session) return;

      const shelfStatus = session.shelves[0];
      const cartItem = session.items.find(
        (item) => item.inventoryId === product.id,
      );
      const nextCount = shelfStatus?.pickedCount ?? cartItem?.quantity ?? 0;

      setPickedCount(nextCount);
      setMessage(session.message);
      setStatus(session.status === "expired" ? "error" : session.status);
      setItemQuantity(cartItem ?? fallbackItem, nextCount);

      if (session.status === "closed" || session.status === "expired") {
        events.close();
      }
    }

    function handleSessionError(event: MessageEvent<string>) {
      const body = JSON.parse(event.data) as { message?: string };
      setStatus("error");
      setMessage(body.message ?? "ไม่สามารถอ่านสถานะตู้ได้");
      events.close();
    }

    events.addEventListener(
      "iot-session-updated",
      handleSessionUpdated as EventListener,
    );
    events.addEventListener(
      "iot-session-error",
      handleSessionError as EventListener,
    );

    return () => events.close();
  }, [fallbackItem, product.id, sessionId, setItemQuantity]);

  const tone =
    status === "error"
      ? "border-destructive/50 bg-destructive/10 text-destructive"
      : status === "closed"
        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
        : "border-primary/30 bg-primary/10 text-primary";

  return (
    <section className="grid gap-4">
      <div className={cn("flex items-start gap-3 rounded-lg border p-3", tone)}>
        {status === "closed" ? (
          <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
        ) : status === "opening" ? (
          <Clock3 className="mt-0.5 size-5 shrink-0" />
        ) : (
          <DoorOpen className="mt-0.5 size-5 shrink-0" />
        )}
        <div className="min-w-0">
          <p className="font-medium">{message}</p>
          {channelId && (
            <p className="mt-1 truncate font-mono text-xs opacity-80">
              {channelId}
            </p>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <div className="aspect-[4/3] bg-muted">
          {product.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.imageUrl}
              alt={`${product.name} product image`}
              className="size-full object-cover"
            />
          ) : (
            <div className="grid size-full place-items-center text-sm text-muted-foreground">
              No image
            </div>
          )}
        </div>
        <div className="grid gap-3 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-base font-semibold">{product.name}</h2>
              <p className="text-muted-foreground text-sm">{shelf.name}</p>
            </div>
            <span className="font-semibold tabular-nums">
              {formatBaht(product.price)}
            </span>
          </div>

          <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2">
            <span className="text-sm font-medium">ในตะกร้า</span>
            <span className="text-lg font-bold tabular-nums">
              {pickedCount} ชิ้น
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Link
          href="/cart"
          className={cn(buttonVariants({ variant: "default" }), "w-full")}
        >
          <ShoppingCart className="size-4" />
          ตะกร้า
        </Link>
        <Button
          type="button"
          variant="outline"
          onClick={() => window.location.reload()}
          disabled={status === "opening"}
        >
          เปิดใหม่
        </Button>
      </div>
    </section>
  );
}
