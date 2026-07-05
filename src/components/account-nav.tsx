"use client";

import { Menu } from "@base-ui/react/menu";
import {
  Home,
  BriefcaseBusiness,
  ChevronDown,
  LogOut,
  ReceiptText,
  ScanLine,
  ShieldCheck,
  ShoppingCart,
  UserRound,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ThemeToggle } from "@/components/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { formatBaht, formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useHydrated } from "@/lib/use-hydrated";
import { selectTotalCount, selectTotalPrice, useCartStore } from "@/store/cart";
import type { CartItem } from "@/types";

type AccountNavProps = {
  user: {
    name: string | null;
    email: string;
    avatarUrl: string | null;
  };
  canAccessAdmin: boolean;
  walletBalanceMinor: number;
};

type ActiveVisitCheckoutStatus = {
  order: {
    status: "pending" | "paid" | "failed" | "cancelled";
    paymentStatus: "pending" | "paid" | "failed" | "cancelled";
    receiptNo: string | null;
  } | null;
  walletBalanceAvailableMinor?: number;
};

type ActiveCartResponse = {
  visit: { id: number; status: "inside" | "exited" | "unknown_exit" } | null;
  cart: { items: CartItem[] } | null;
};

export function AccountNav({
  user,
  canAccessAdmin,
  walletBalanceMinor,
}: AccountNavProps) {
  const displayName = user.name ?? user.email;
  const router = useRouter();
  const pathname = usePathname();
  const isAdminPage = pathname.startsWith("/admin");
  const hydrated = useHydrated();
  const cartCount = useCartStore(selectTotalCount);
  const cartTotal = useCartStore(selectTotalPrice);
  const clearCart = useCartStore((state) => state.clear);
  const setCartItems = useCartStore((state) => state.setItems);
  const [liveWalletBalanceMinor, setLiveWalletBalanceMinor] = useState<
    number | null
  >(null);
  const displayedWalletBalanceMinor =
    liveWalletBalanceMinor ?? walletBalanceMinor;
  const showCartBadge = hydrated && cartCount > 0;

  useEffect(() => {
    const events = new EventSource("/api/orders/active-visit-events");

    function handleCheckoutStatus(event: MessageEvent<string>) {
      const body = JSON.parse(event.data) as ActiveVisitCheckoutStatus;
      if (typeof body.walletBalanceAvailableMinor === "number") {
        setLiveWalletBalanceMinor(body.walletBalanceAvailableMinor);
      }

      if (
        body.order?.status === "paid" &&
        body.order.paymentStatus === "paid" &&
        hydrated &&
        cartCount > 0
      ) {
        clearCart();
        const params = new URLSearchParams({ checkout: "paid" });
        if (body.order.receiptNo) params.set("receipt", body.order.receiptNo);
        router.replace(`/?${params.toString()}`);
      }
    }

    function handleCartUpdated(event: MessageEvent<string>) {
      if (isAdminPage) return;

      const body = JSON.parse(event.data) as ActiveCartResponse;
      if (!body.visit) return;

      setCartItems(body.cart?.items ?? []);
    }

    events.addEventListener(
      "checkout-status",
      handleCheckoutStatus as EventListener,
    );
    events.addEventListener("cart-updated", handleCartUpdated as EventListener);

    return () => events.close();
  }, [cartCount, clearCart, hydrated, isAdminPage, router, setCartItems]);

  return (
    <header className="bg-background/95 sticky top-0 z-50 border-b">
      <div
        className={cn(
          "mx-auto flex w-full max-w-6xl gap-3 px-4 py-3 sm:px-6 lg:px-8",
          isAdminPage
            ? "flex-col md:flex-row md:items-center md:justify-between"
            : "items-center justify-between",
        )}
      >
        {isAdminPage ? (
          <div className="grid min-w-0 gap-3 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
            <Link
              href="/"
              className={cn(buttonVariants({ variant: "outline" }), "w-fit")}
            >
              <Home className="size-4" />
              Home
            </Link>
            <div className="min-w-0 space-y-1">
              <div className="text-muted-foreground flex items-center gap-2 text-sm">
                <ShieldCheck className="size-4" />
                <span>Back office</span>
              </div>
              <h1 className="truncate text-xl font-bold sm:text-2xl">
                User management
              </h1>
            </div>
          </div>
        ) : (
          <Link href="/" className={buttonVariants({ variant: "outline" })}>
            <Home className="size-4" />
            Home
          </Link>
        )}

        <div
          className={cn(
            "items-center gap-2",
            isAdminPage ? "flex justify-end" : "flex justify-end",
          )}
        >
          <ThemeToggle />

          <Menu.Root modal={false}>
            <Menu.Trigger
              className="border-border bg-card text-card-foreground focus-visible:border-ring focus-visible:ring-ring/50 relative flex h-11 w-full min-w-0 max-w-[calc(100vw-5.5rem)] items-center gap-2 rounded-lg border px-2 pr-3 text-left shadow-sm outline-none transition-colors hover:bg-muted focus-visible:ring-3 md:w-[320px]"
              aria-label="เปิดเมนูโปรไฟล์"
            >
              <Avatar avatarUrl={user.avatarUrl} />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                {displayName}
              </span>
              <span className="text-muted-foreground flex shrink-0 items-center gap-1 text-xs font-medium tabular-nums">
                <WalletCards className="size-3.5" />
                {formatPrice(displayedWalletBalanceMinor)}
              </span>
              {showCartBadge ? (
                <span
                  aria-label={`${cartCount} items in cart`}
                  className="bg-primary text-primary-foreground absolute -top-2 -right-2 flex min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold tabular-nums"
                >
                  {cartCount}
                </span>
              ) : null}
              <ChevronDown className="text-muted-foreground size-4 shrink-0" />
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner sideOffset={8} align="end">
                <Menu.Popup className="border-border bg-popover text-popover-foreground z-50 grid w-[min(18rem,calc(100vw-2rem))] gap-1 rounded-lg border p-1 text-sm shadow-lg outline-none">
                  <div className="px-2 py-2">
                    <p className="truncate font-medium">{displayName}</p>
                    <p className="text-muted-foreground truncate text-xs">
                      {user.email}
                    </p>
                  </div>
                  <Separator />
                  <Menu.LinkItem
                    render={<Link href="/" />}
                    closeOnClick
                    className="data-[highlighted]:bg-muted flex items-center gap-2 rounded-md px-2 py-2 outline-none"
                  >
                    <ScanLine className="size-4" />
                    Store home
                  </Menu.LinkItem>
                  <Menu.LinkItem
                    render={<Link href="/wallet" />}
                    closeOnClick
                    className="data-[highlighted]:bg-muted flex items-center justify-between gap-3 rounded-md px-2 py-2 outline-none"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <WalletCards className="size-4" />
                      <span>Wallet</span>
                    </span>
                    <span className="text-muted-foreground text-xs tabular-nums">
                      {formatPrice(displayedWalletBalanceMinor)}
                    </span>
                  </Menu.LinkItem>
                  <Menu.LinkItem
                    render={
                      <Link
                        href="/cart"
                        onClick={(event) => {
                          const returnTo = `${window.location.pathname}${window.location.search}`;
                          if (returnTo === "/cart") return;

                          event.preventDefault();
                          router.push(
                            `/cart?${new URLSearchParams({
                              returnTo,
                            }).toString()}`,
                          );
                        }}
                      />
                    }
                    closeOnClick
                    className="data-[highlighted]:bg-muted flex items-center justify-between gap-3 rounded-md px-2 py-2 outline-none"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <ShoppingCart className="size-4" />
                      <span>Cart</span>
                    </span>
                    {showCartBadge ? (
                      <span className="text-muted-foreground text-xs tabular-nums">
                        {cartCount} · {formatBaht(cartTotal)}
                      </span>
                    ) : null}
                  </Menu.LinkItem>
                  <Menu.LinkItem
                    render={<Link href="/receipts" />}
                    closeOnClick
                    className="data-[highlighted]:bg-muted flex items-center gap-2 rounded-md px-2 py-2 outline-none"
                  >
                    <ReceiptText className="size-4" />
                    History
                  </Menu.LinkItem>
                  {canAccessAdmin ? (
                    <Menu.LinkItem
                      render={<Link href="/admin/users" />}
                      closeOnClick
                      className="data-[highlighted]:bg-muted flex items-center gap-2 rounded-md px-2 py-2 outline-none"
                    >
                      <BriefcaseBusiness className="size-4" />
                      Back office
                    </Menu.LinkItem>
                  ) : null}
                  <Separator />
                  <form action="/api/auth/signout" method="post">
                    <Menu.Item
                      nativeButton
                      render={<button type="submit" />}
                      className="text-destructive data-[highlighted]:bg-destructive/10 flex w-full items-center gap-2 rounded-md px-2 py-2 text-left outline-none"
                    >
                      <LogOut className="size-4" />
                      Sign out
                    </Menu.Item>
                  </form>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </div>
      </div>
    </header>
  );
}

function Avatar({ avatarUrl }: { avatarUrl: string | null }) {
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt=""
        className="bg-muted size-8 shrink-0 rounded-full object-cover"
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className="bg-primary/10 text-primary flex size-8 shrink-0 items-center justify-center rounded-full"
    >
      <UserRound className="size-4" />
    </span>
  );
}
