import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireCurrentUser } from "@/lib/auth";
import { formatMinorBaht } from "@/lib/money";
import { cn } from "@/lib/utils";
import { walletService } from "@/services/wallet.service";

type WalletTopupSuccessPageProps = {
  searchParams: Promise<{ session_id?: string }>;
};

export default async function WalletTopupSuccessPage({
  searchParams,
}: WalletTopupSuccessPageProps) {
  const user = await requireCurrentUser();
  const { session_id: sessionId } = await searchParams;
  const topup = sessionId
    ? await walletService.getTopupIntentForUserSession(user.id, sessionId)
    : null;

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 items-center px-4 py-8 sm:px-6 lg:px-8">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Top-up submitted</CardTitle>
          <CardDescription>
            Wallet balance updates after Stripe confirms the payment webhook.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {topup ? (
            <div className="grid gap-3 rounded-lg border p-4 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-medium tabular-nums">
                  {formatMinorBaht(topup.amountMinor)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Channel</span>
                <span className="font-medium">{topup.requestedChannel}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Status</span>
                <Badge variant={topup.status === "paid" ? "default" : "outline"}>
                  {topup.status}
                </Badge>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground rounded-lg border p-4 text-sm">
              Checkout session was not found for this wallet.
            </p>
          )}

          <Link
            className={cn(buttonVariants({ size: "lg" }), "w-full")}
            href="/wallet"
          >
            Back to wallet
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
