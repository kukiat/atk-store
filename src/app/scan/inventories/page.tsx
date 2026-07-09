import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { decodeInventoryQrPayload } from "@/lib/qr-payload";
import { inventoryService } from "@/services/inventory.service";
import { storeAccessService } from "@/services/store-access.service";

export default async function ScanInventoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ payload?: string | string[] }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");
  const scanEligibility = await storeAccessService.getScanEligibility(user.id);
  if (!scanEligibility.canScan) redirect("/scan");

  const payloadParam = (await searchParams).payload;
  const encodedPayload = Array.isArray(payloadParam)
    ? payloadParam[0]
    : payloadParam;
  if (!encodedPayload) notFound();

  const payload = decodeInventoryQrPayload(encodedPayload);
  if (payload.inventoryIds.length === 1) {
    redirect(`/inventory/${payload.inventoryIds[0]}`);
  }

  const inventories = await inventoryService.listActiveInventoriesByIds(
    payload.inventoryIds,
  );

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 pt-6 pb-8">
      <header className="mb-6 grid gap-3">
        <Link
          href="/scan"
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
          <p className="text-sm text-muted-foreground">Inventory QR</p>
          <h1 className="text-balance text-xl font-bold">เลือกสินค้า</h1>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3">
        {inventories.map((inventory) => (
          <Link
            key={inventory.id}
            href={`/inventory/${inventory.id}?${new URLSearchParams({
              payload: encodedPayload,
            }).toString()}`}
          >
            <Card className="h-full overflow-hidden">
              <div
                className="aspect-square bg-muted bg-cover bg-center"
                style={
                  inventory.imageUrl
                    ? { backgroundImage: `url(${inventory.imageUrl})` }
                    : undefined
                }
                aria-label={`Inventory image for ${inventory.name}`}
              />
              <CardHeader>
                <CardTitle className="text-sm">{inventory.name}</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                {inventory.amount} ชิ้นในระบบ
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </main>
  );
}
