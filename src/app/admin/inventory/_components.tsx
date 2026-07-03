import Link from "next/link";

import {
  ConfirmSubmitButton,
  FormPendingOverlay,
} from "@/app/admin/confirm-submit-button";
import {
  deleteGroupAction,
  deleteQrCodeAction,
  deleteUnitAction,
  importInventoriesAction,
  saveGroupAction,
  saveUnitAction,
} from "@/app/admin/actions";
import {
  InventoriesEditor,
  ShelvesEditor,
} from "@/app/admin/inventory/_editable-panels";
import { QrCodeBuilder } from "@/app/admin/inventory/_qr-code-builder";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatBaht } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { InventoryAdminData } from "@/services/admin-inventory.service";

const inputClass =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40";
const textareaClass =
  "min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40";
const labelClass = "grid gap-1 text-sm font-medium";

export function InventorySummaryCards({ data }: { data: InventoryAdminData }) {
  const totalStock = data.inventories.reduce(
    (sum, inventory) => sum + inventory.amount,
    0,
  );
  const unreadAlerts = data.notifications.filter(
    (notification) => !notification.isRead,
  ).length;

  return (
    <section className="grid gap-3 md:grid-cols-4">
      <SummaryCard
        label="Groups"
        value={data.groups.length}
        href="/admin/inventory/groups"
      />
      <SummaryCard
        label="Shelves"
        value={data.shelfs.length}
        href="/admin/inventory/shelfs"
      />
      <SummaryCard
        label="Inventories"
        value={data.inventories.length}
        href="/admin/inventory/items"
        detail={`${totalStock} units`}
      />
      <SummaryCard
        label="Alerts"
        value={unreadAlerts}
        href="/admin/inventory/orders"
        detail={`${data.orders.length} orders`}
      />
    </section>
  );
}

function SummaryCard({
  label,
  value,
  href,
  detail,
}: {
  label: string;
  value: number;
  href: string;
  detail?: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-lg border bg-card p-4 hover:bg-muted/40"
    >
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
      {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
    </Link>
  );
}

export function GroupsPanel({ data }: { data: InventoryAdminData }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Groups</CardTitle>
        <CardDescription>
          Integrated boxes that contain shelves.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <form
          action={saveGroupAction}
          className="relative grid gap-3 sm:grid-cols-[1fr_auto]"
        >
          <FormPendingOverlay label="Saving group" />
          <label className={labelClass}>
            Group name
            <input className={inputClass} name="name" required />
          </label>
          <ConfirmSubmitButton
            title="Save group?"
            description="This will create a new shelf group in the back-office inventory."
            confirmLabel="Save group"
            className="self-end"
          >
            Save group
          </ConfirmSubmitButton>
        </form>
        <div className="grid gap-2">
          {data.groups.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No groups yet. Create one to represent an integrated box.
            </p>
          ) : (
            data.groups.map((group) => (
              <form
                key={group.id}
                action={saveGroupAction}
                className="relative grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_auto_auto]"
              >
                <FormPendingOverlay label="Updating group" />
                <input type="hidden" name="id" value={group.id} />
                <input
                  className={inputClass}
                  name="name"
                  defaultValue={group.name}
                  aria-label={`Group ${group.name}`}
                />
                <ConfirmSubmitButton
                  title="Update group?"
                  description={`This will save the latest name for ${group.name}.`}
                  confirmLabel="Update"
                  variant="outline"
                >
                  Update
                </ConfirmSubmitButton>
                <ConfirmSubmitButton
                  formAction={deleteGroupAction}
                  title="Delete group?"
                  description={`This will remove ${group.name} from active inventory groups.`}
                  confirmLabel="Delete"
                  variant="destructive"
                  confirmVariant="destructive"
                >
                  Delete
                </ConfirmSubmitButton>
              </form>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function UnitsPanel({ data }: { data: InventoryAdminData }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Units</CardTitle>
        <CardDescription>
          Default is grams, but units stay configurable.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <form
          action={saveUnitAction}
          className="relative grid gap-3 sm:grid-cols-[1fr_auto]"
        >
          <FormPendingOverlay label="Saving unit" />
          <label className={labelClass}>
            Unit name
            <input
              className={inputClass}
              name="name"
              defaultValue="gram"
              required
            />
          </label>
          <ConfirmSubmitButton
            title="Save unit?"
            description="This will add a unit that can be used by inventory items."
            confirmLabel="Save unit"
            className="self-end"
          >
            Save unit
          </ConfirmSubmitButton>
        </form>
        <div className="grid gap-2">
          {data.units.map((unit) => (
            <form
              key={unit.id}
              action={saveUnitAction}
              className="relative grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_auto_auto]"
            >
              <FormPendingOverlay label="Updating unit" />
              <input type="hidden" name="id" value={unit.id} />
              <input
                className={inputClass}
                name="name"
                defaultValue={unit.name}
                aria-label={`Unit ${unit.name}`}
              />
              <ConfirmSubmitButton
                title="Update unit?"
                description={`This will save the latest name for ${unit.name}.`}
                confirmLabel="Update"
                variant="outline"
              >
                Update
              </ConfirmSubmitButton>
              <ConfirmSubmitButton
                formAction={deleteUnitAction}
                title="Delete unit?"
                description={`This will remove ${unit.name} from active units.`}
                confirmLabel="Delete"
                variant="destructive"
                confirmVariant="destructive"
              >
                Delete
              </ConfirmSubmitButton>
            </form>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function ShelfsPanel({ data }: { data: InventoryAdminData }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Shelves</CardTitle>
        <CardDescription>
          Standalone shelves or shelves inside a group.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ShelvesEditor
          groups={data.groups.map((group) => ({
            id: group.id,
            name: group.name,
          }))}
          shelves={data.shelfs.map((shelf) => ({
            id: shelf.id,
            groupId: shelf.groupId,
            name: shelf.name,
            imageUrl: shelf.imageUrl,
            sensorId: shelf.sensorId,
          }))}
          inventories={data.inventories.map((inventory) => ({
            id: inventory.id,
            shelfId: inventory.shelfId,
            name: inventory.name,
            description: inventory.description,
            price: inventory.price,
            amount: inventory.amount,
            weightPerPiece: inventory.weightPerPiece,
            unitId: inventory.unitId,
            isActive: inventory.isActive,
            imageUrl: inventory.imageUrl,
          }))}
        />
      </CardContent>
    </Card>
  );
}

export function InventoriesPanel({ data }: { data: InventoryAdminData }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Inventories</CardTitle>
        <CardDescription>Sellable items on each shelf.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <InventoriesEditor
          shelves={data.shelfs.map((shelf) => ({
            id: shelf.id,
            groupId: shelf.groupId,
            name: shelf.name,
            imageUrl: shelf.imageUrl,
            sensorId: shelf.sensorId,
          }))}
          units={data.units.map((unit) => ({
            id: unit.id,
            name: unit.name,
          }))}
          inventories={data.inventories.map((inventory) => ({
            id: inventory.id,
            shelfId: inventory.shelfId,
            name: inventory.name,
            description: inventory.description,
            price: inventory.price,
            amount: inventory.amount,
            weightPerPiece: inventory.weightPerPiece,
            unitId: inventory.unitId,
            isActive: inventory.isActive,
            imageUrl: inventory.imageUrl,
          }))}
        />

        <form
          action={importInventoriesAction}
          className="relative grid gap-2 rounded-lg border p-3"
        >
          <FormPendingOverlay label="Importing inventory" />
          <label className={labelClass}>
            CSV import
            <textarea
              className={textareaClass}
              name="csv"
              placeholder="shelfId,name,description,price,amount,weightPerPiece,unitId,isActive,imageUrl"
            />
          </label>
          <ConfirmSubmitButton
            title="Import inventory CSV?"
            description="This will create or update inventory items from the CSV content."
            confirmLabel="Import"
            variant="outline"
            className="w-fit"
          >
            Import / update
          </ConfirmSubmitButton>
        </form>

      </CardContent>
    </Card>
  );
}

export function QrCodesPanel({ data }: { data: InventoryAdminData }) {
  const shelfName = new Map(data.shelfs.map((shelf) => [shelf.id, shelf.name]));

  function renderShelfNames(shelfIds: string) {
    return shelfIds
      .split(",")
      .map((id) => shelfName.get(id.trim()) ?? id.trim())
      .join(", ");
  }

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>QR Codes</CardTitle>
              <CardDescription>
                Create as many QR codes as needed, then bind one or more shelves
                to each code.
              </CardDescription>
            </div>
            <Link
              href="#create-qrcode"
              className={cn(buttonVariants({ size: "sm" }))}
            >
              Create QR Code
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="bg-muted text-left">
                <tr>
                  <th className="p-3">Description</th>
                  <th className="p-3">Shelves</th>
                  <th className="p-3">Created</th>
                  <th className="p-3">Payload</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.qrCodes.length === 0 ? (
                  <tr>
                    <td
                      className="p-6 text-center text-muted-foreground"
                      colSpan={5}
                    >
                      No QR codes yet. Create one to bind shelves for scanning.
                    </td>
                  </tr>
                ) : (
                  data.qrCodes.map((qr) => (
                    <tr key={qr.id} className="border-t align-top">
                      <td className="p-3 font-medium">
                        {qr.description ?? "QR code"}
                      </td>
                      <td className="max-w-72 p-3 text-muted-foreground">
                        {renderShelfNames(qr.shelfIds)}
                      </td>
                      <td className="p-3 tabular-nums">
                        {qr.createdAt.toLocaleDateString("th-TH")}
                      </td>
                      <td className="max-w-56 p-3">
                        <span className="block truncate text-xs text-muted-foreground">
                          {qr.encodedPayload}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-2">
                          <details className="group">
                            <summary className="inline-flex h-7 cursor-pointer list-none items-center justify-center rounded-lg border border-border bg-background px-2.5 text-[0.8rem] font-medium hover:bg-muted">
                              View
                            </summary>
                            <div className="mt-3 grid w-36 gap-2 rounded-lg border bg-background p-3">
                              <div className="flex size-28 items-center justify-center rounded-md bg-muted">
                                {qr.imageUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={qr.imageUrl}
                                    alt={`QR code for ${renderShelfNames(qr.shelfIds)}`}
                                    className="size-28 object-contain"
                                  />
                                ) : (
                                  <span className="text-xs text-muted-foreground">
                                    No image
                                  </span>
                                )}
                              </div>
                              {qr.imageUrl && (
                                <Link
                                  href={qr.imageUrl}
                                  target="_blank"
                                  className="text-xs text-primary hover:underline"
                                >
                                  Open image
                                </Link>
                              )}
                            </div>
                          </details>
                          <form
                            action={deleteQrCodeAction}
                            className="relative inline-block"
                          >
                            <FormPendingOverlay label="Deleting QR" />
                            <input type="hidden" name="id" value={qr.id} />
                            <ConfirmSubmitButton
                              title="Delete QR code?"
                              description="This will remove this QR code from the back-office list."
                              confirmLabel="Delete"
                              variant="destructive"
                              confirmVariant="destructive"
                              size="sm"
                            >
                              Delete
                            </ConfirmSubmitButton>
                          </form>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card id="create-qrcode">
        <CardHeader>
          <CardTitle>Create QR Code</CardTitle>
          <CardDescription>
            Choose shelves by name. Add multiple shelves for an integrated group
            QR, or one shelf for a standalone QR.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <QrCodeBuilder
            shelves={data.shelfs.map((shelf) => ({
              id: shelf.id,
              name: shelf.name,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}

export function AlertsOrdersPanel({ data }: { data: InventoryAdminData }) {
  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>Latest IOT websocket/mock alerts.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          {data.notifications.map((notification) => (
            <div key={notification.id} className="rounded-lg border p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium">{notification.title}</p>
                <Badge variant="outline">{notification.recipientType}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {notification.message}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Orders</CardTitle>
          <CardDescription>
            Orders created by exit-camera worker API.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          {data.orders.map((order) => (
            <div key={order.id} className="rounded-lg border p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium">Visit #{order.clientVisitId}</p>
                <Badge variant="outline">{order.paymentStatus}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Total {formatBaht(order.totalPrice)} · {order.status}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </section>
  );
}
