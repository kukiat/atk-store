import { RotateCw } from "lucide-react";
import Link from "next/link";

import {
  sendMockDoorClosedAction,
  sendMockPickedCountAction,
} from "@/app/admin/inventory/iot-poc/actions";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatBaht } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  iotSessionService,
  type IotSessionStatus,
} from "@/services/iot-session.service";

const inputClass =
  "h-9 w-24 rounded-md border border-input bg-background px-3 text-sm tabular-nums outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40";

function statusVariant(status: IotSessionStatus) {
  if (status === "expired") {
    return "destructive" as const;
  }
  if (status === "updated" || status === "closed") return "default" as const;
  return "outline" as const;
}

export default async function IotPocPage() {
  const sessions = await iotSessionService.listSessions(50);

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>IOT PoC Portal</CardTitle>
              <CardDescription>
                Mock cumulative picked-count and shelf-closed loadcell events.
              </CardDescription>
            </div>
            <Link
              href="/admin/inventory/iot-poc"
              className={cn(buttonVariants({ variant: "outline" }), "w-fit")}
            >
              <RotateCw className="size-4" />
              Refresh
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {sessions.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
              No IOT PoC sessions yet. Scan an inventory QR on mobile to open a
              mock inventory session.
            </div>
          ) : (
            <div className="grid gap-4">
              {sessions.map((session) => {
                const total = session.items.reduce(
                  (sum, item) => sum + item.price * item.quantity,
                  0,
                );
                const item = session.items[0];

                return (
                  <Card key={session.sessionId}>
                    <CardHeader>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <CardTitle className="truncate text-base">
                            Visit #{session.clientVisitId}
                          </CardTitle>
                          <CardDescription className="truncate">
                            {session.customerName ?? session.customerEmail}
                          </CardDescription>
                        </div>
                        <Badge variant={statusVariant(session.status)}>
                          {session.status}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                      <div className="grid gap-2 text-sm sm:grid-cols-3">
                        <div>
                          <p className="text-muted-foreground">Session</p>
                          <p className="truncate font-mono text-xs">
                            {session.sessionId}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Cart total</p>
                          <p className="font-medium tabular-nums">
                            {formatBaht(total)}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Updated</p>
                          <p className="font-medium tabular-nums">
                            {new Date(session.updatedAt).toLocaleString()}
                          </p>
                        </div>
                      </div>

                      <div className="grid gap-3 rounded-lg border p-3">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <p className="font-medium">
                              {session.inventoryName}
                            </p>
                            <p className="truncate font-mono text-xs text-muted-foreground">
                              {session.inventoryId}
                            </p>
                          </div>
                          <Badge variant={statusVariant(session.status)}>
                            {session.status}
                          </Badge>
                        </div>

                        <dl className="grid gap-2 text-sm sm:grid-cols-4">
                          <div>
                            <dt className="text-muted-foreground">Price</dt>
                            <dd className="tabular-nums">
                              {item ? formatBaht(item.price) : "-"}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-muted-foreground">
                              In-store remaining
                            </dt>
                            <dd className="tabular-nums">
                              {session.currentQty ?? session.inStoreQty ?? "-"}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-muted-foreground">
                              Cumulative
                            </dt>
                            <dd className="tabular-nums">
                              {session.pickedCount} pcs
                            </dd>
                          </div>
                          <div>
                            <dt className="text-muted-foreground">Branch</dt>
                            <dd className="tabular-nums">
                              {session.branchCode}
                            </dd>
                          </div>
                        </dl>

                        <div className="flex flex-wrap items-end gap-2">
                          <form
                            action={sendMockPickedCountAction}
                            className="flex flex-wrap items-end gap-2"
                          >
                            <input
                              type="hidden"
                              name="sessionId"
                              value={session.sessionId}
                            />
                            <label className="grid gap-1 text-sm font-medium">
                              Cumulative count
                              <input
                                className={inputClass}
                                type="number"
                                min={0}
                                name="pickedCount"
                                defaultValue={session.pickedCount}
                                required
                              />
                            </label>
                            <label className="grid gap-1 text-sm font-medium">
                              Current qty
                              <input
                                className={inputClass}
                                type="number"
                                min={0}
                                name="currentQty"
                                defaultValue={
                                  session.currentQty ?? session.inStoreQty ?? 0
                                }
                                required
                              />
                            </label>
                            <Button type="submit">Send count</Button>
                          </form>
                          <form action={sendMockDoorClosedAction}>
                            <input
                              type="hidden"
                              name="sessionId"
                              value={session.sessionId}
                            />
                            <Button
                              type="submit"
                              variant="outline"
                              disabled={session.status === "closed"}
                            >
                              Door closed
                            </Button>
                          </form>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
