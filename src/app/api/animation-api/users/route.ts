import { NextResponse } from "next/server";

import { animationService } from "@/services/animation.service";

export const runtime = "nodejs";

const noStore = { "Cache-Control": "no-store" } as const;

export async function GET() {
  const users = await animationService.listUsersWithLatestVisit();

  return NextResponse.json(users, { headers: noStore });
}
