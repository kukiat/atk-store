"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const tabs = [
  { href: "/admin/inventory", label: "Overview", exact: true },
  { href: "/admin/inventory/groups", label: "Groups & Units", exact: false },
  { href: "/admin/inventory/shelfs", label: "Shelves", exact: false },
  { href: "/admin/inventory/items", label: "Inventories", exact: false },
  { href: "/admin/inventory/qr", label: "QR Codes", exact: false },
  { href: "/admin/inventory/orders", label: "Orders & Alerts", exact: false },
] as const;

export function InventorySubnav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-2 overflow-x-auto rounded-lg border bg-card p-2 text-sm">
      {tabs.map((tab) => {
        const active = tab.exact
          ? pathname === tab.href
          : pathname === tab.href || pathname.startsWith(`${tab.href}/`);

        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-md px-3 py-2 font-medium hover:bg-muted",
              active &&
                "bg-primary text-primary-foreground hover:bg-primary/90",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
