"use client";

import { Pencil, Trash2, X } from "lucide-react";
import { Fragment, useState } from "react";

import {
  deleteInventoryAction,
  deleteShelfAction,
  saveInventoryAction,
  saveShelfAction,
} from "@/app/admin/actions";
import {
  ConfirmSubmitButton,
  FormPendingOverlay,
} from "@/app/admin/confirm-submit-button";
import { ImageUploadField } from "@/components/image-upload-field";
import { ImageGalleryButton } from "@/components/image-preview-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatBaht } from "@/lib/format";

const inputClass =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40";
const labelClass = "grid gap-1 text-sm font-medium";

export type EditableGroup = {
  id: string;
  name: string;
};

export type EditableShelf = {
  id: string;
  groupId: string | null;
  name: string;
  imageUrl: string | null;
  sensorId: string | null;
};

export type EditableUnit = {
  id: string;
  name: string;
};

export type EditableInventory = {
  id: string;
  shelfId: string;
  name: string;
  description: string | null;
  price: number;
  amount: number;
  weightPerPiece: number;
  unitId: string;
  isActive: boolean;
  imageUrl: string | null;
};

type ShelvesEditorProps = {
  groups: EditableGroup[];
  shelves: EditableShelf[];
  inventories: EditableInventory[];
};

type InventoriesEditorProps = {
  shelves: EditableShelf[];
  units: EditableUnit[];
  inventories: EditableInventory[];
};

export function ShelvesEditor({
  groups,
  shelves,
  inventories,
}: ShelvesEditorProps) {
  const [expandedShelfId, setExpandedShelfId] = useState<string | null>(null);
  const groupName = new Map(groups.map((group) => [group.id, group.name]));
  const inventoryCountByShelf = new Map<string, number>();
  for (const inventory of inventories) {
    inventoryCountByShelf.set(
      inventory.shelfId,
      (inventoryCountByShelf.get(inventory.shelfId) ?? 0) + 1,
    );
  }
  const usedSensorIds = shelves
    .map((shelf) => shelf.sensorId)
    .filter((sensorId): sensorId is string => Boolean(sensorId));

  async function createShelf(formData: FormData) {
    await saveShelfAction(formData);
  }

  async function updateShelf(formData: FormData) {
    await saveShelfAction(formData);
    setExpandedShelfId(null);
  }

  return (
    <div className="grid gap-4">
      {expandedShelfId ? null : (
        <form
          action={createShelf}
          className="relative grid gap-3 md:grid-cols-5"
        >
          <FormPendingOverlay label="Saving shelf" />
          <label className={labelClass}>
            Name
            <input className={inputClass} name="name" required />
          </label>
          <label className={labelClass}>
            Group
            <select className={inputClass} name="groupId">
              <option value="">Standalone</option>
              {groups.map((group) => (
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
          <ConfirmSubmitButton
            title="Save shelf?"
            description="This will save this shelf and make it available for inventory and QR binding."
            confirmLabel="Save shelf"
            className="self-end"
            uniqueField={{
              name: "sensorId",
              values: usedSensorIds,
              message: "This sensor ID is already assigned to another shelf.",
            }}
          >
            Save shelf
          </ConfirmSubmitButton>
        </form>
      )}

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="bg-muted text-left">
            <tr>
              <th className="p-3">Name</th>
              <th className="p-3">Group</th>
              <th className="p-3">Sensor</th>
              <th className="p-3">Image</th>
              <th className="p-3">Items</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {shelves.length === 0 ? (
              <tr>
                <td className="p-6 text-center text-muted-foreground" colSpan={6}>
                  No shelves yet. Create one before adding inventory.
                </td>
              </tr>
            ) : (
              shelves.map((shelf) => {
                const expanded = expandedShelfId === shelf.id;
                const inventoryCount = inventoryCountByShelf.get(shelf.id) ?? 0;
                const deleteBlocked = inventoryCount > 0;
                const sensorValues = usedSensorIds.filter(
                  (sensorId) => sensorId !== shelf.sensorId,
                );

                return (
                  <Fragment key={shelf.id}>
                    <tr className="border-t">
                      <td className="p-3 font-medium">{shelf.name}</td>
                      <td className="p-3">
                        {shelf.groupId
                          ? groupName.get(shelf.groupId)
                          : "Standalone"}
                      </td>
                      <td className="p-3">{shelf.sensorId ?? "-"}</td>
                      <td className="p-3">
                        <ImageGalleryButton
                          src={shelf.imageUrl}
                          alt={`${shelf.name} shelf image`}
                        />
                      </td>
                      <td className="p-3">
                        <Badge variant={deleteBlocked ? "secondary" : "outline"}>
                          {inventoryCount} item
                          {inventoryCount === 1 ? "" : "s"}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant={expanded ? "destructive" : "outline"}
                            size="icon-sm"
                            aria-label={
                              expanded
                                ? `Close editor for ${shelf.name}`
                                : `Edit ${shelf.name}`
                            }
                            onClick={() =>
                              setExpandedShelfId(expanded ? null : shelf.id)
                            }
                          >
                            {expanded ? (
                              <X className="size-4" />
                            ) : (
                              <Pencil className="size-4" />
                            )}
                          </Button>
                          <form
                            action={deleteShelfAction}
                            className="relative inline-block"
                          >
                            <FormPendingOverlay label="Deleting shelf" />
                            <input type="hidden" name="id" value={shelf.id} />
                            <ConfirmSubmitButton
                              title="Delete shelf?"
                              description={
                                deleteBlocked
                                  ? "Move or delete this shelf's inventory before deleting the shelf."
                                  : `This will remove ${shelf.name} from active shelves.`
                              }
                              confirmLabel="Delete"
                              variant="destructive"
                              confirmVariant="destructive"
                              size="icon-sm"
                              disabled={deleteBlocked}
                            >
                              <Trash2 className="size-4" />
                            </ConfirmSubmitButton>
                          </form>
                        </div>
                      </td>
                    </tr>
                    {expanded ? (
                      <tr className="border-t bg-muted/30">
                        <td className="p-3" colSpan={6}>
                          <form action={updateShelf} className="relative grid gap-3">
                            <FormPendingOverlay label="Updating shelf" />
                            <input type="hidden" name="id" value={shelf.id} />
                            <div className="grid gap-3 md:grid-cols-4">
                              <label className={labelClass}>
                                Name
                                <input
                                  className={inputClass}
                                  name="name"
                                  defaultValue={shelf.name}
                                  required
                                />
                              </label>
                              <label className={labelClass}>
                                Group
                                <select
                                  className={inputClass}
                                  name="groupId"
                                  defaultValue={shelf.groupId ?? ""}
                                >
                                  <option value="">Standalone</option>
                                  {groups.map((group) => (
                                    <option key={group.id} value={group.id}>
                                      {group.name}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label className={labelClass}>
                                Sensor ID
                                <input
                                  className={inputClass}
                                  name="sensorId"
                                  defaultValue={shelf.sensorId ?? ""}
                                />
                              </label>
                              <label className={labelClass}>
                                Image URL fallback
                                <input
                                  className={inputClass}
                                  name="imageUrl"
                                  defaultValue={shelf.imageUrl ?? ""}
                                  placeholder="https://..."
                                />
                              </label>
                              <div className="md:col-span-2">
                                <ImageUploadField
                                  label="Replace shelf image"
                                  description="Select or drop new shelf image"
                                  currentImageUrl={shelf.imageUrl}
                                />
                              </div>
                            </div>
                            <div className="flex justify-end">
                              <ConfirmSubmitButton
                                title="Update shelf?"
                                description={`This will save changes to ${shelf.name}.`}
                                confirmLabel="Update shelf"
                                variant="outline"
                                uniqueField={{
                                  name: "sensorId",
                                  values: sensorValues,
                                  message:
                                    "This sensor ID is already assigned to another shelf.",
                                }}
                              >
                                Update shelf
                              </ConfirmSubmitButton>
                            </div>
                          </form>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function InventoriesEditor({
  shelves,
  units,
  inventories,
}: InventoriesEditorProps) {
  const [expandedInventoryId, setExpandedInventoryId] = useState<string | null>(
    null,
  );
  const shelfName = new Map(shelves.map((shelf) => [shelf.id, shelf.name]));
  const unitName = new Map(units.map((unit) => [unit.id, unit.name]));
  const occupiedShelfIds = new Set(
    inventories.map((inventory) => inventory.shelfId),
  );
  const availableShelves = shelves.filter(
    (shelf) => !occupiedShelfIds.has(shelf.id),
  );

  async function createInventory(formData: FormData) {
    await saveInventoryAction(formData);
  }

  async function updateInventory(formData: FormData) {
    await saveInventoryAction(formData);
    setExpandedInventoryId(null);
  }

  return (
    <div className="grid gap-4">
      {expandedInventoryId ? null : (
        <form
          action={createInventory}
          className="relative grid gap-3 md:grid-cols-4"
        >
          <FormPendingOverlay label="Saving inventory" />
          <label className={labelClass}>
            Shelf
            <select
              className={inputClass}
              name="shelfId"
              required
              disabled={availableShelves.length === 0}
            >
              {availableShelves.length === 0 ? (
                <option value="">All shelves already have an item</option>
              ) : null}
              {availableShelves.map((shelf) => (
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
              {units.map((unit) => (
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
          <ConfirmSubmitButton
            title="Save inventory?"
            description="This will save this product item and its stock settings."
            confirmLabel="Save inventory"
            className="self-end"
            disabled={availableShelves.length === 0}
          >
            Save inventory
          </ConfirmSubmitButton>
        </form>
      )}

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[980px] text-sm">
          <thead className="bg-muted text-left">
            <tr>
              <th className="p-3">Name</th>
              <th className="p-3">Shelf</th>
              <th className="p-3">Price</th>
              <th className="p-3">Amount</th>
              <th className="p-3">Weight</th>
              <th className="p-3">Image</th>
              <th className="p-3">Status</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {inventories.length === 0 ? (
              <tr>
                <td className="p-6 text-center text-muted-foreground" colSpan={8}>
                  No inventory items yet. Add one to make a shelf sellable.
                </td>
              </tr>
            ) : (
              inventories.map((inventory) => {
                const expanded = expandedInventoryId === inventory.id;
                const shelfOptions = shelves.filter(
                  (shelf) =>
                    shelf.id === inventory.shelfId ||
                    !occupiedShelfIds.has(shelf.id),
                );

                return (
                  <Fragment key={inventory.id}>
                    <tr className="border-t">
                      <td className="p-3 font-medium">{inventory.name}</td>
                      <td className="p-3">
                        {shelfName.get(inventory.shelfId)}
                      </td>
                      <td className="p-3 tabular-nums">
                        {formatBaht(inventory.price)}
                      </td>
                      <td className="p-3 tabular-nums">{inventory.amount}</td>
                      <td className="p-3 tabular-nums">
                        {inventory.weightPerPiece}{" "}
                        {unitName.get(inventory.unitId)}
                      </td>
                      <td className="p-3">
                        <ImageGalleryButton
                          src={inventory.imageUrl}
                          alt={`${inventory.name} product image`}
                        />
                      </td>
                      <td className="p-3">
                        <Badge
                          variant={inventory.isActive ? "outline" : "secondary"}
                        >
                          {inventory.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant={expanded ? "destructive" : "outline"}
                            size="icon-sm"
                            aria-label={
                              expanded
                                ? `Close editor for ${inventory.name}`
                                : `Edit ${inventory.name}`
                            }
                            onClick={() =>
                              setExpandedInventoryId(
                                expanded ? null : inventory.id,
                              )
                            }
                          >
                            {expanded ? (
                              <X className="size-4" />
                            ) : (
                              <Pencil className="size-4" />
                            )}
                          </Button>
                          <form
                            action={deleteInventoryAction}
                            className="relative inline-block"
                          >
                            <FormPendingOverlay label="Deleting inventory" />
                            <input
                              type="hidden"
                              name="id"
                              value={inventory.id}
                            />
                            <ConfirmSubmitButton
                              title="Delete inventory item?"
                              description={`This will remove ${inventory.name} from active inventory items.`}
                              confirmLabel="Delete"
                              variant="destructive"
                              confirmVariant="destructive"
                              size="icon-sm"
                            >
                              <Trash2 className="size-4" />
                            </ConfirmSubmitButton>
                          </form>
                        </div>
                      </td>
                    </tr>
                    {expanded ? (
                      <tr className="border-t bg-muted/30">
                        <td className="p-3" colSpan={8}>
                          <form
                            action={updateInventory}
                            className="relative grid gap-3"
                          >
                            <FormPendingOverlay label="Updating inventory" />
                            <input
                              type="hidden"
                              name="id"
                              value={inventory.id}
                            />
                            <div className="grid gap-3 md:grid-cols-4">
                              <label className={labelClass}>
                                Shelf
                                <select
                                  className={inputClass}
                                  name="shelfId"
                                  defaultValue={inventory.shelfId}
                                  required
                                >
                                  {shelfOptions.map((shelf) => (
                                    <option key={shelf.id} value={shelf.id}>
                                      {shelf.name}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label className={labelClass}>
                                Name
                                <input
                                  className={inputClass}
                                  name="name"
                                  defaultValue={inventory.name}
                                  required
                                />
                              </label>
                              <label className={labelClass}>
                                Price
                                <input
                                  className={inputClass}
                                  name="price"
                                  type="number"
                                  step="0.01"
                                  defaultValue={inventory.price}
                                  required
                                />
                              </label>
                              <label className={labelClass}>
                                Amount
                                <input
                                  className={inputClass}
                                  name="amount"
                                  type="number"
                                  defaultValue={inventory.amount}
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
                                  defaultValue={inventory.weightPerPiece}
                                  required
                                />
                              </label>
                              <label className={labelClass}>
                                Unit
                                <select
                                  className={inputClass}
                                  name="unitId"
                                  defaultValue={inventory.unitId}
                                  required
                                >
                                  {units.map((unit) => (
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
                                  defaultValue={inventory.imageUrl ?? ""}
                                  placeholder="https://..."
                                />
                              </label>
                              <label className={`${labelClass} justify-end pb-2`}>
                                <span>Active</span>
                                <input
                                  name="isActive"
                                  type="checkbox"
                                  defaultChecked={inventory.isActive}
                                />
                              </label>
                              <label className={`${labelClass} md:col-span-3`}>
                                Description
                                <input
                                  className={inputClass}
                                  name="description"
                                  defaultValue={inventory.description ?? ""}
                                />
                              </label>
                              <div className="md:col-span-3">
                                <ImageUploadField
                                  label="Replace inventory image"
                                  description="Select or drop new inventory image"
                                  currentImageUrl={inventory.imageUrl}
                                />
                              </div>
                            </div>
                            <div className="flex justify-end">
                              <ConfirmSubmitButton
                                title="Update inventory?"
                                description={`This will save changes to ${inventory.name}.`}
                                confirmLabel="Update inventory"
                                variant="outline"
                              >
                                Update inventory
                              </ConfirmSubmitButton>
                            </div>
                          </form>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
