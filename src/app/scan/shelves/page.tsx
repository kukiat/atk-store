import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { decodeShelfQrPayload } from "@/lib/qr-payload";
import { shelfService } from "@/services/shelf.service";

export default async function ScanShelvesPage({
  searchParams,
}: {
  searchParams: Promise<{ payload?: string | string[] }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");

  const payloadParam = (await searchParams).payload;
  const encodedPayload = Array.isArray(payloadParam)
    ? payloadParam[0]
    : payloadParam;
  if (!encodedPayload) notFound();

  const payload = decodeShelfQrPayload(encodedPayload);
  if (payload.shelfIds.length === 1) redirect(`/shelf/${payload.shelfIds[0]}`);

  const shelves = await shelfService.listShelvesByIds(payload.shelfIds);

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 pt-6 pb-8">
      <header className="mb-6">
        <p className="text-sm text-muted-foreground">Integrated shelf</p>
        <h1 className="text-balance text-xl font-bold">เลือก shelf</h1>
      </header>

      <div className="grid grid-cols-2 gap-3">
        {shelves.map((shelf) => (
          <Link key={shelf.id} href={`/shelf/${shelf.id}`}>
            <Card className="h-full">
              <div
                className="aspect-square bg-muted bg-cover bg-center"
                style={
                  shelf.imageUrl
                    ? { backgroundImage: `url(${shelf.imageUrl})` }
                    : undefined
                }
                aria-label={`Shelf image for ${shelf.name}`}
              />
              <CardHeader>
                <CardTitle className="text-sm">{shelf.name}</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                {shelf.sensorId ?? "No sensor"}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </main>
  );
}
