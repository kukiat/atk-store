import { NextResponse } from "next/server";

import { requireCurrentUser } from "@/lib/auth";
import { cartSyncService } from "@/services/cart-sync.service";
import { clientVisitService } from "@/services/client-visit.service";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireCurrentUser();
  const activeVisit = await clientVisitService.getActiveVisitForUser(user.id);

  if (!activeVisit) {
    return NextResponse.json({ visit: null, cart: null });
  }

  const cart = await cartSyncService.getCart(activeVisit.id);

  return NextResponse.json({
    visit: {
      id: activeVisit.id,
      status: activeVisit.status,
    },
    cart,
  });
}
