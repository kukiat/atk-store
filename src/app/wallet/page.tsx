import { ArrowLeft, CreditCard, Landmark, WalletCards } from "lucide-react";
import Link from "next/link";

import { createWalletTopupAction } from "@/app/wallet/actions";
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

const inputClass =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40";

function statusVariant(status: string) {
  if (status === "paid") return "default";
  if (status === "failed" || status === "cancelled") return "destructive";
  return "outline";
}

function channelIcon(channel: string) {
  if (channel === "promptpay") return <Landmark className="size-4" />;
  return <CreditCard className="size-4" />;
}

export default async function WalletPage() {
  const user = await requireCurrentUser();
  const { wallet, channels, topups, ledgerEntries, livemode } =
    await walletService.getWalletOverview(user.id);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-balance">Wallet</h1>
          <p className="text-muted-foreground text-sm text-pretty">
            Top up and review your wallet activity.
          </p>
        </div>
        <Link
          href="/"
          className={cn(buttonVariants({ variant: "outline" }), "shrink-0")}
        >
          <ArrowLeft className="size-4" />
          Home
        </Link>
      </div>

      <section className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <WalletCards className="size-5" />
              Wallet
            </CardTitle>
            <CardDescription>
              {livemode ? "Live mode" : "Sandbox mode"}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div>
              <p className="text-muted-foreground text-sm">Available balance</p>
              <p className="text-4xl font-bold tabular-nums">
                {formatMinorBaht(wallet.balanceAvailableMinor)}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg border p-3">
                <p className="text-muted-foreground">Pending</p>
                <p className="font-medium tabular-nums">
                  {formatMinorBaht(wallet.balancePendingMinor)}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-muted-foreground">Status</p>
                <p className="font-medium capitalize">{wallet.status}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top up</CardTitle>
            <CardDescription>Fund wallet through Stripe Checkout.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={createWalletTopupAction} className="grid gap-4">
              <label className="grid gap-1.5 text-sm font-medium">
                Amount
                <input
                  className={inputClass}
                  name="amountBaht"
                  type="number"
                  min="10"
                  step="1"
                  defaultValue="100"
                  required
                />
              </label>

              <div className="grid gap-2">
                <p className="text-sm font-medium">Channel</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {channels.map((channel, index) => (
                    <label
                      key={channel.id}
                      className="flex min-h-14 cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm hover:bg-muted/40 has-checked:border-primary has-checked:bg-primary/5"
                    >
                      <input
                        type="radio"
                        name="channelCode"
                        value={channel.channelCode}
                        defaultChecked={index === 0}
                        className="size-4"
                      />
                      {channelIcon(channel.channelCode)}
                      <span className="min-w-0">
                        <span className="block font-medium">
                          {channel.displayName}
                        </span>
                        <span className="text-muted-foreground block text-xs">
                          {formatMinorBaht(channel.minAmountMinor)} -{" "}
                          {formatMinorBaht(channel.maxAmountMinor)}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <button
                className={cn(buttonVariants({ size: "lg" }), "w-full")}
                type="submit"
              >
                Continue to Stripe
              </button>
            </form>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top-up history</CardTitle>
          </CardHeader>
          <CardContent>
            {topups.length === 0 ? (
              <p className="text-muted-foreground text-sm">No top-ups yet.</p>
            ) : (
              <div className="divide-y rounded-lg border">
                {topups.map((topup) => (
                  <div
                    key={topup.id}
                    className="grid gap-2 p-3 sm:grid-cols-[1fr_auto] sm:items-center"
                  >
                    <div>
                      <p className="font-medium tabular-nums">
                        {formatMinorBaht(topup.amountMinor)}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {topup.requestedChannel} ·{" "}
                        {topup.createdAt.toLocaleString("th-TH")}
                      </p>
                    </div>
                    <Badge variant={statusVariant(topup.status)}>
                      {topup.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ledger</CardTitle>
          </CardHeader>
          <CardContent>
            {ledgerEntries.length === 0 ? (
              <p className="text-muted-foreground text-sm">No ledger entries.</p>
            ) : (
              <div className="divide-y rounded-lg border">
                {ledgerEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="grid gap-2 p-3 sm:grid-cols-[1fr_auto] sm:items-center"
                  >
                    <div>
                      <p className="font-medium">
                        {entry.type.replace("_", " ")}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        Balance after {formatMinorBaht(entry.balanceAfterMinor)}
                      </p>
                    </div>
                    <p
                      className={cn(
                        "font-medium tabular-nums",
                        entry.direction === "credit"
                          ? "text-emerald-600"
                          : "text-destructive",
                      )}
                    >
                      {entry.direction === "credit" ? "+" : "-"}
                      {formatMinorBaht(entry.amountMinor)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
