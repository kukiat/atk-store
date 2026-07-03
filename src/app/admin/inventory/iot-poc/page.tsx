import { RotateCw } from "lucide-react";
import Link from "next/link";

import { sendMockPickedCountAction } from "@/app/admin/inventory/iot-poc/actions";
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
  if (status === "over" || status === "short" || status === "expired") {
    return "destructive" as const;
  }
  if (status === "matched") return "default" as const;
  return "outline" as const;
}

export default function IotPocPage() {
  const sessions = iotSessionService.listSessions(50);

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>IOT PoC Portal</CardTitle>
              <CardDescription>
                Mock picked-count events for pending shelf sessions.
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
            <div className="text-muted-foreground rounded-lg border border-dashed p-6 text-sm">
              No IOT PoC sessions yet. Submit a mobile cart to open a mock shelf
              session.
            </div>
          ) : (
            <div className="grid gap-4">
              {sessions.map((session) => {
                const total = session.items.reduce(
                  (sum, item) => sum + item.price * item.quantity,
                  0,
                );

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

                      <div className="grid gap-3">
                        {session.shelves.map((shelf) => (
                          <div
                            key={shelf.shelfId}
                            className="grid gap-3 rounded-lg border p-3"
                          >
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                              <div className="min-w-0">
                                <p className="font-medium">
                                  {shelf.inventoryName}
                                </p>
                                <p className="text-muted-foreground truncate font-mono text-xs">
                                  {shelf.channelId}
                                </p>
                              </div>
                              <Badge variant={statusVariant(shelf.status)}>
                                {shelf.status}
                              </Badge>
                            </div>

                            <dl className="grid gap-2 text-sm sm:grid-cols-4">
                              <div>
                                <dt className="text-muted-foreground">
                                  Sensor
                                </dt>
                                <dd className="font-mono text-xs">
                                  {shelf.sensorId ?? "not set"}
                                </dd>
                              </div>
                              <div>
                                <dt className="text-muted-foreground">
                                  Expected
                                </dt>
                                <dd className="tabular-nums">
                                  {shelf.expectedCount} pcs
                                </dd>
                              </div>
                              <div>
                                <dt className="text-muted-foreground">
                                  Weight
                                </dt>
                                <dd className="tabular-nums">
                                  {shelf.expectedWeight} g
                                </dd>
                              </div>
                              <div>
                                <dt className="text-muted-foreground">
                                  Picked
                                </dt>
                                <dd className="tabular-nums">
                                  {shelf.pickedCount ?? "-"} pcs
                                </dd>
                              </div>
                            </dl>

                            <form
                              action={sendMockPickedCountAction}
                              className="flex flex-wrap items-end gap-2"
                            >
                              <input
                                type="hidden"
                                name="sessionId"
                                value={session.sessionId}
                              />
                              <input
                                type="hidden"
                                name="shelfId"
                                value={shelf.shelfId}
                              />
                              <label className="grid gap-1 text-sm font-medium">
                                Picked count
                                <input
                                  className={inputClass}
                                  type="number"
                                  min={0}
                                  name="pickedCount"
                                  defaultValue={shelf.expectedCount}
                                  required
                                />
                              </label>
                              <Button type="submit">Send mock event</Button>
                            </form>
                          </div>
                        ))}
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
