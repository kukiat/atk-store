"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const links = [
  { href: "/admin/users", label: "Users" },
  {
    href: "/admin/inventory",
    label: "Inventory",
    exclude: ["/admin/inventory/iot-poc"],
  },
  { href: "/admin/inventory/iot-poc", label: "IOT PoC" },
  { href: "/admin/wallets", label: "Wallets" },
  { href: "/admin/attendance", label: "Demo Status" },
] as const;

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-2 rounded-lg border bg-card p-2 text-sm">
      {links.map((link) => {
        const excluded =
          "exclude" in link &&
          link.exclude.some(
            (href) => pathname === href || pathname.startsWith(`${href}/`),
          );
        const active =
          !excluded &&
          (pathname === link.href || pathname.startsWith(`${link.href}/`));

        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-2 font-medium hover:bg-muted",
              active &&
                "bg-primary text-primary-foreground hover:bg-primary/90",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
