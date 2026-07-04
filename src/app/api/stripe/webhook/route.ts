import { NextResponse } from "next/server";

import { StripeConfigError } from "@/lib/stripe";
import { walletService } from "@/services/wallet.service";

export const runtime = "nodejs";

const noStore = { "Cache-Control": "no-store" } as const;

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("stripe-signature");
    const result = await walletService.handleStripeWebhook(rawBody, signature);

    return NextResponse.json(result, { headers: noStore });
  } catch (error) {
    if (error instanceof StripeConfigError) {
      return NextResponse.json(
        { error: "server_misconfigured", message: error.message },
        { status: 500, headers: noStore },
      );
    }

    if (error instanceof Error) {
      return NextResponse.json(
        { error: "webhook_error", message: error.message },
        { status: 400, headers: noStore },
      );
    }

    throw error;
  }
}
