import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { CustomerLiveMap } from "@/app/live-map/start/[token]/customer-live-map";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { clientVisitService } from "@/services/client-visit.service";
import { liveMapService } from "@/services/live-map.service";

export default async function LiveMapStartPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");

  const { token } = await params;
  const [mapData, activeVisit] = await Promise.all([
    liveMapService.getCustomerMapByToken(token),
    clientVisitService.getActiveVisitForUser(user.id),
  ]);
  if (!mapData) notFound();

  if (!activeVisit) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 items-center px-4 py-8">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>ยังไม่พร้อมเริ่ม Live Map</CardTitle>
            <CardDescription>
              กรุณาผ่านการยืนยันเข้าร้านก่อนสแกน Live Map QR
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/" className={cn(buttonVariants(), "w-fit")}>
              กลับหน้าหลัก
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  return <CustomerLiveMap data={mapData} />;
}
