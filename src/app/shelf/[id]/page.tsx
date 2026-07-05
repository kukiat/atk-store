import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import { shelfService } from "@/services/shelf.service";
import { storeAccessService } from "@/services/store-access.service";
import { ShelfOpenSession } from "./shelf-open-session";

export default async function ShelfPage({
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
    ? `/scan/shelves?${new URLSearchParams({ payload: encodedPayload }).toString()}`
    : "/scan";
  const shelf = await shelfService.getShelfWithInventories(id);

  if (!shelf) notFound();
  const product = shelf.inventories.find(
    (inventory) => inventory.isActive && inventory.amount > 0,
  );

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
          <p className="text-muted-foreground text-sm">ชั้นวาง {shelf.id}</p>
          <h1 className="text-xl font-bold">{shelf.name}</h1>
          {shelf.sensorId && (
            <p className="text-muted-foreground text-sm">
              Sensor {shelf.sensorId}
            </p>
          )}
        </div>
      </header>

      {!product ? (
        <p className="text-muted-foreground py-12 text-center">
          ยังไม่มีสินค้าบนชั้นนี้
        </p>
      ) : (
        <ShelfOpenSession shelf={shelf} product={product} />
      )}
    </main>
  );
}
