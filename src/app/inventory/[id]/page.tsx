import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import { inventoryService } from "@/services/inventory.service";
import { storeAccessService } from "@/services/store-access.service";
import { InventoryOpenSession } from "./inventory-open-session";

export default async function InventoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ payload?: string | string[] }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");
  const scanEligibility = await storeAccessService.getScanEligibility(user.id);
  if (!scanEligibility.canScan) redirect("/scan");

  const { id } = await params;
  const payloadParam = (await searchParams).payload;
  const encodedPayload = Array.isArray(payloadParam)
    ? payloadParam[0]
    : payloadParam;
  const backHref = encodedPayload
    ? `/scan/inventories?${new URLSearchParams({ payload: encodedPayload }).toString()}`
    : "/scan";
  const inventory = await inventoryService.getActiveInventory(id);

  if (!inventory) notFound();

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 pt-6 pb-28">
      <header className="mb-6 grid gap-3">
        <Link
          href={backHref}
          className={buttonVariants({
            variant: "ghost",
            size: "sm",
            className: "w-fit -ml-2",
          })}
        >
          <ArrowLeft className="size-4" />
          กลับ
        </Link>
        <div>
          <p className="text-muted-foreground text-sm">สินค้า {inventory.id}</p>
          <h1 className="text-xl font-bold">{inventory.name}</h1>
        </div>
      </header>

      <InventoryOpenSession inventory={inventory} />
    </main>
  );
}
