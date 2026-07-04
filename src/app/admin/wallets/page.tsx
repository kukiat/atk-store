import { desc, eq } from "drizzle-orm";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { db } from "@/db";
import {
  stripeWebhookEvents,
  users,
  wallets,
  walletTopupIntents,
} from "@/db/schema";
import { formatMinorBaht } from "@/lib/money";

function statusVariant(status: string) {
  if (status === "paid" || status === "processed") return "default";
  if (status === "failed") return "destructive";
  return "outline";
}

export default async function AdminWalletsPage() {
  const [walletRows, topupRows, webhookRows] = await Promise.all([
    db
      .select({
        id: wallets.id,
        userEmail: users.email,
        userName: users.name,
        balanceAvailableMinor: wallets.balanceAvailableMinor,
        balancePendingMinor: wallets.balancePendingMinor,
        status: wallets.status,
        updatedAt: wallets.updatedAt,
      })
      .from(wallets)
      .leftJoin(users, eq(wallets.userId, users.id))
      .orderBy(desc(wallets.updatedAt))
      .limit(50),
    db
      .select({
        id: walletTopupIntents.id,
        userEmail: users.email,
        amountMinor: walletTopupIntents.amountMinor,
        requestedChannel: walletTopupIntents.requestedChannel,
        confirmedChannel: walletTopupIntents.confirmedChannel,
        status: walletTopupIntents.status,
        livemode: walletTopupIntents.livemode,
        createdAt: walletTopupIntents.createdAt,
      })
      .from(walletTopupIntents)
      .innerJoin(wallets, eq(walletTopupIntents.walletId, wallets.id))
      .leftJoin(users, eq(wallets.userId, users.id))
      .orderBy(desc(walletTopupIntents.createdAt))
      .limit(50),
    db.query.stripeWebhookEvents.findMany({
      orderBy: desc(stripeWebhookEvents.createdAt),
      limit: 50,
    }),
  ]);

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-2xl font-bold">Wallets</h1>
        <p className="text-muted-foreground text-sm">
          Customer wallet balances, Stripe top-ups, and webhook processing.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Wallet balances</CardTitle>
          <CardDescription>Latest customer wallet snapshots.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-muted/60 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Customer</th>
                  <th className="px-3 py-2 font-medium">Available</th>
                  <th className="px-3 py-2 font-medium">Pending</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Updated</th>
                </tr>
              </thead>
              <tbody>
                {walletRows.map((wallet) => (
                  <tr key={wallet.id} className="border-t">
                    <td className="px-3 py-2">
                      <p className="font-medium">
                        {wallet.userName ?? wallet.userEmail ?? "Unknown"}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {wallet.userEmail}
                      </p>
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {formatMinorBaht(wallet.balanceAvailableMinor)}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {formatMinorBaht(wallet.balancePendingMinor)}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant="outline">{wallet.status}</Badge>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {wallet.updatedAt.toLocaleString("th-TH")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Top-up intents</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-muted/60 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Customer</th>
                  <th className="px-3 py-2 font-medium">Amount</th>
                  <th className="px-3 py-2 font-medium">Channel</th>
                  <th className="px-3 py-2 font-medium">Mode</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {topupRows.map((topup) => (
                  <tr key={topup.id} className="border-t">
                    <td className="px-3 py-2">{topup.userEmail}</td>
                    <td className="px-3 py-2 tabular-nums">
                      {formatMinorBaht(topup.amountMinor)}
                    </td>
                    <td className="px-3 py-2">
                      {topup.confirmedChannel ?? topup.requestedChannel}
                    </td>
                    <td className="px-3 py-2">
                      {topup.livemode ? "live" : "sandbox"}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={statusVariant(topup.status)}>
                        {topup.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {topup.createdAt.toLocaleString("th-TH")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Stripe webhook events</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[780px] text-left text-sm">
              <thead className="bg-muted/60 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Event</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">Mode</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Processed</th>
                </tr>
              </thead>
              <tbody>
                {webhookRows.map((event) => (
                  <tr key={event.id} className="border-t">
                    <td className="px-3 py-2 font-mono text-xs">
                      {event.stripeEventId}
                    </td>
                    <td className="px-3 py-2">{event.eventType}</td>
                    <td className="px-3 py-2">
                      {event.livemode ? "live" : "sandbox"}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={statusVariant(event.processingStatus)}>
                        {event.processingStatus}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {event.processedAt?.toLocaleString("th-TH") ?? "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
