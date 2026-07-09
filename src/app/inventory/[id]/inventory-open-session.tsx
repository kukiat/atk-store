"use client";

import { CheckCircle2, Clock3, DoorOpen, ShoppingCart } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { formatBaht } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useCartStore } from "@/store/cart";
import type { CartItem, Inventory } from "@/types";

type SessionStatus = "open" | "updated" | "closed" | "expired";

type IotSessionResponse = {
  session?: {
    status: SessionStatus;
    message: string;
    items: CartItem[];
    pickedCount: number;
    currentQty: number | null;
    inStoreQty: number | null;
  };
};

type OpenInventoryResponse = {
  error?: string;
  message?: string;
  sessionId?: string;
  channelId?: string;
  inventory?: CartItem;
  currentQty?: number | null;
  inStoreQty?: number | null;
};

export function InventoryOpenSession({ inventory }: { inventory: Inventory }) {
  const setItemQuantity = useCartStore((state) => state.setItemQuantity);
  const [status, setStatus] = useState<
    "opening" | "open" | "updated" | "closed" | "error"
  >("opening");
  const [message, setMessage] = useState("กำลังเปิด session...");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [channelId, setChannelId] = useState<string | null>(null);
  const [cartInventory, setCartInventory] = useState<CartItem | null>(null);
  const [pickedCount, setPickedCount] = useState(0);
  const [currentQty, setCurrentQty] = useState<number | null>(null);
  const openedRef = useRef(false);
  const fallbackItem = useMemo(() => cartInventory, [cartInventory]);

  useEffect(() => {
    if (openedRef.current) return;
    openedRef.current = true;

    async function openInventory() {
      const response = await fetch("/api/iot/watch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inventoryId: inventory.id }),
      });
      const body = (await response.json()) as OpenInventoryResponse;

      if (!response.ok) {
        setStatus("error");
        setMessage(body.error ?? "ไม่สามารถเปิด session ได้");
        return;
      }

      setStatus("open");
      setSessionId(body.sessionId ?? null);
      setChannelId(body.channelId ?? null);
      setCartInventory(body.inventory ?? null);
      setCurrentQty(body.currentQty ?? body.inStoreQty ?? null);
      setMessage(body.message ?? "เปิด session แล้ว หยิบสินค้าได้เลย");
    }

    void openInventory();
  }, [inventory.id]);

  useEffect(() => {
    if (!sessionId) return;

    const events = new EventSource(`/api/iot/sessions/${sessionId}/events`);

    function handleSessionUpdated(event: MessageEvent<string>) {
      const body = JSON.parse(event.data) as IotSessionResponse;
      const session = body.session;
      if (!session) return;

      const cartItem =
        session.items[0] ??
        (fallbackItem
          ? { ...fallbackItem, quantity: session.pickedCount ?? 0 }
          : null);
      const nextCount = session.pickedCount ?? cartItem?.quantity ?? 0;

      setPickedCount(nextCount);
      setCurrentQty(session.currentQty ?? session.inStoreQty ?? null);
      setMessage(session.message);
      setStatus(session.status === "expired" ? "error" : session.status);
      if (cartItem) setItemQuantity(cartItem, nextCount);

      if (session.status === "closed" || session.status === "expired") {
        events.close();
      }
    }

    function handleSessionError(event: MessageEvent<string>) {
      const body = JSON.parse(event.data) as { message?: string };
      setStatus("error");
      setMessage(body.message ?? "ไม่สามารถอ่านสถานะ session ได้");
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
  }, [fallbackItem, sessionId, setItemQuantity]);

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
          {inventory.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={inventory.imageUrl}
              alt={`${inventory.name} inventory image`}
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
              <h2 className="text-base font-semibold">{inventory.name}</h2>
              {currentQty !== null && (
                <p className="text-muted-foreground text-sm">
                  คงเหลือในตู้ {currentQty} ชิ้น
                </p>
              )}
            </div>
            <span className="font-semibold tabular-nums">
              {formatBaht(inventory.price)}
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
