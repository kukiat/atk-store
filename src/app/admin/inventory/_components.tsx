import Link from "next/link";

import {
  deleteGroupAction,
  deleteInventoryAction,
  deleteQrCodeAction,
  deleteShelfAction,
  deleteUnitAction,
  importInventoriesAction,
  saveGroupAction,
  saveInventoryAction,
  saveShelfAction,
  saveUnitAction,
} from "@/app/admin/actions";
import { QrCodeBuilder } from "@/app/admin/inventory/_qr-code-builder";
import { ImageUploadField } from "@/components/image-upload-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatBaht } from "@/lib/format";
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
          className="grid gap-3 sm:grid-cols-[1fr_auto]"
        >
          <label className={labelClass}>
            Group name
            <input className={inputClass} name="name" required />
          </label>
          <Button className="self-end">Save group</Button>
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
                className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_auto_auto]"
              >
                <input type="hidden" name="id" value={group.id} />
                <input
                  className={inputClass}
                  name="name"
                  defaultValue={group.name}
                  aria-label={`Group ${group.name}`}
                />
                <Button variant="outline">Update</Button>
                <Button
                  formAction={deleteGroupAction}
                  variant="destructive"
                  name="id"
                  value={group.id}
                >
                  Delete
                </Button>
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
          className="grid gap-3 sm:grid-cols-[1fr_auto]"
        >
          <label className={labelClass}>
            Unit name
            <input
              className={inputClass}
              name="name"
              defaultValue="gram"
              required
            />
          </label>
          <Button className="self-end">Save unit</Button>
        </form>
        <div className="grid gap-2">
          {data.units.map((unit) => (
            <form
              key={unit.id}
              action={saveUnitAction}
              className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_auto_auto]"
            >
              <input type="hidden" name="id" value={unit.id} />
              <input
                className={inputClass}
                name="name"
                defaultValue={unit.name}
                aria-label={`Unit ${unit.name}`}
              />
              <Button variant="outline">Update</Button>
              <Button
                formAction={deleteUnitAction}
                variant="destructive"
                name="id"
                value={unit.id}
              >
                Delete
              </Button>
            </form>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function ShelfsPanel({ data }: { data: InventoryAdminData }) {
  const groupName = new Map(data.groups.map((group) => [group.id, group.name]));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Shelves</CardTitle>
        <CardDescription>
          Standalone shelves or shelves inside a group.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <form
          action={saveShelfAction}
          encType="multipart/form-data"
          className="grid gap-3 md:grid-cols-5"
        >
          <label className={labelClass}>
            Name
            <input className={inputClass} name="name" required />
          </label>
          <label className={labelClass}>
            Group
            <select className={inputClass} name="groupId">
              <option value="">Standalone</option>
              {data.groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Sensor ID
            <input className={inputClass} name="sensorId" />
          </label>
          <label className={labelClass}>
            Image URL fallback
            <input
              className={inputClass}
              name="imageUrl"
              placeholder="https://..."
            />
          </label>
          <div className="md:col-span-2">
            <ImageUploadField
              label="Shelf image"
              description="Select or drop shelf image"
            />
          </div>
          <Button className="self-end">Save shelf</Button>
        </form>

        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-muted text-left">
              <tr>
                <th className="p-3">Name</th>
                <th className="p-3">Group</th>
                <th className="p-3">Sensor</th>
                <th className="p-3">Image</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.shelfs.map((shelf) => (
                <tr key={shelf.id} className="border-t">
                  <td className="p-3 font-medium">{shelf.name}</td>
                  <td className="p-3">
                    {shelf.groupId
                      ? groupName.get(shelf.groupId)
                      : "Standalone"}
                  </td>
                  <td className="p-3">{shelf.sensorId ?? "-"}</td>
                  <td className="p-3">
                    {shelf.imageUrl ? "Ready" : "No image"}
                  </td>
                  <td className="p-3">
                    <form action={deleteShelfAction}>
                      <Button
                        variant="destructive"
                        size="sm"
                        name="id"
                        value={shelf.id}
                      >
                        Delete
                      </Button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

export function InventoriesPanel({ data }: { data: InventoryAdminData }) {
  const shelfName = new Map(data.shelfs.map((shelf) => [shelf.id, shelf.name]));
  const unitName = new Map(data.units.map((unit) => [unit.id, unit.name]));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Inventories</CardTitle>
        <CardDescription>Sellable items on each shelf.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <form
          action={saveInventoryAction}
          encType="multipart/form-data"
          className="grid gap-3 md:grid-cols-4"
        >
          <label className={labelClass}>
            Shelf
            <select className={inputClass} name="shelfId" required>
              {data.shelfs.map((shelf) => (
                <option key={shelf.id} value={shelf.id}>
                  {shelf.name}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Name
            <input className={inputClass} name="name" required />
          </label>
          <label className={labelClass}>
            Price
            <input
              className={inputClass}
              name="price"
              type="number"
              step="0.01"
              required
            />
          </label>
          <label className={labelClass}>
            Amount
            <input
              className={inputClass}
              name="amount"
              type="number"
              required
            />
          </label>
          <label className={labelClass}>
            Weight / piece
            <input
              className={inputClass}
              name="weightPerPiece"
              type="number"
              step="0.01"
              required
            />
          </label>
          <label className={labelClass}>
            Unit
            <select className={inputClass} name="unitId" required>
              {data.units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.name}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Image URL fallback
            <input
              className={inputClass}
              name="imageUrl"
              placeholder="https://..."
            />
          </label>
          <label className={`${labelClass} justify-end pb-2`}>
            <span>Active</span>
            <input name="isActive" type="checkbox" defaultChecked />
          </label>
          <label className={`${labelClass} md:col-span-3`}>
            Description
            <input className={inputClass} name="description" />
          </label>
          <div className="md:col-span-3">
            <ImageUploadField
              label="Inventory image"
              description="Select or drop inventory image"
            />
          </div>
          <Button className="self-end">Save inventory</Button>
        </form>

        <form
          action={importInventoriesAction}
          className="grid gap-2 rounded-lg border p-3"
        >
          <label className={labelClass}>
            CSV import
            <textarea
              className={textareaClass}
              name="csv"
              placeholder="shelfId,name,description,price,amount,weightPerPiece,unitId,isActive,imageUrl"
            />
          </label>
          <Button className="w-fit" variant="outline">
            Import / update
          </Button>
        </form>

        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-muted text-left">
              <tr>
                <th className="p-3">Name</th>
                <th className="p-3">Shelf</th>
                <th className="p-3">Price</th>
                <th className="p-3">Amount</th>
                <th className="p-3">Weight</th>
                <th className="p-3">Status</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.inventories.map((inventory) => (
                <tr key={inventory.id} className="border-t">
                  <td className="p-3 font-medium">{inventory.name}</td>
                  <td className="p-3">{shelfName.get(inventory.shelfId)}</td>
                  <td className="p-3 tabular-nums">
                    {formatBaht(inventory.price)}
                  </td>
                  <td className="p-3 tabular-nums">{inventory.amount}</td>
                  <td className="p-3 tabular-nums">
                    {inventory.weightPerPiece} {unitName.get(inventory.unitId)}
                  </td>
                  <td className="p-3">
                    <Badge
                      variant={inventory.isActive ? "outline" : "secondary"}
                    >
                      {inventory.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                  <td className="p-3">
                    <form action={deleteInventoryAction}>
                      <Button
                        variant="destructive"
                        size="sm"
                        name="id"
                        value={inventory.id}
                      >
                        Delete
                      </Button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
            <Button render={<Link href="#create-qrcode" />} size="sm">
              Create QR Code
            </Button>
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
                          <form action={deleteQrCodeAction}>
                            <Button
                              variant="destructive"
                              size="sm"
                              name="id"
                              value={qr.id}
                            >
                              Delete
                            </Button>
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
