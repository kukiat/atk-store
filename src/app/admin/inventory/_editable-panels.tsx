"use client";

import { Pencil, Trash2, X } from "lucide-react";
import { Fragment, useState } from "react";

import {
  deleteInventoryAction,
  saveInventoryAction,
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

export type EditableUnit = {
  id: string;
  name: string;
};

export type EditableInventory = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  amount: number;
  weightPerPiece: number;
  unitId: string;
  isActive: boolean;
  imageUrl: string | null;
};

type InventoriesEditorProps = {
  units: EditableUnit[];
  inventories: EditableInventory[];
};

export function InventoriesEditor({
  units,
  inventories,
}: InventoriesEditorProps) {
  const [expandedInventoryId, setExpandedInventoryId] = useState<string | null>(
    null,
  );
  const unitName = new Map(units.map((unit) => [unit.id, unit.name]));

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
          <InventoryFields units={units} />
          <ConfirmSubmitButton
            title="Save inventory?"
            description="This will save this inventory master. IOT manages shelf mapping and in-store quantity."
            confirmLabel="Save inventory"
            className="self-end"
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
              <th className="p-3">Price</th>
              <th className="p-3">In-stock</th>
              <th className="p-3">Weight</th>
              <th className="p-3">Image</th>
              <th className="p-3">Status</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {inventories.length === 0 ? (
              <tr>
                <td
                  className="p-6 text-center text-muted-foreground"
                  colSpan={7}
                >
                  No inventory masters yet. Add one before IOT maps items to
                  shelves.
                </td>
              </tr>
            ) : (
              inventories.map((inventory) => {
                const expanded = expandedInventoryId === inventory.id;

                return (
                  <Fragment key={inventory.id}>
                    <tr className="border-t">
                      <td className="p-3 font-medium">{inventory.name}</td>
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
                          alt={`${inventory.name} inventory image`}
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
                        <td className="p-3" colSpan={7}>
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
                            <InventoryFields
                              units={units}
                              inventory={inventory}
                            />
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

function InventoryFields({
  units,
  inventory,
}: {
  units: EditableUnit[];
  inventory?: EditableInventory;
}) {
  return (
    <>
      <div className="grid gap-3 md:col-span-4 md:grid-cols-4">
        <label className={labelClass}>
          Name
          <input
            className={inputClass}
            name="name"
            defaultValue={inventory?.name}
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
            defaultValue={inventory?.price}
            required
          />
        </label>
        <label className={labelClass}>
          Amount
          <input
            className={inputClass}
            name="amount"
            type="number"
            defaultValue={inventory?.amount}
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
            defaultValue={inventory?.weightPerPiece}
            required
          />
        </label>
        <label className={labelClass}>
          Unit
          <select
            className={inputClass}
            name="unitId"
            defaultValue={inventory?.unitId}
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
            defaultValue={inventory?.imageUrl ?? ""}
            placeholder="https://..."
          />
        </label>
        <label className={`${labelClass} justify-end pb-2`}>
          <span>Active</span>
          <input
            name="isActive"
            type="checkbox"
            defaultChecked={inventory?.isActive ?? true}
          />
        </label>
        <label className={`${labelClass} md:col-span-3`}>
          Description
          <input
            className={inputClass}
            name="description"
            defaultValue={inventory?.description ?? ""}
          />
        </label>
        <div className="md:col-span-3">
          <ImageUploadField
            label={inventory ? "Replace inventory image" : "Inventory image"}
            description="Select or drop inventory image"
            currentImageUrl={inventory?.imageUrl}
          />
        </div>
      </div>
    </>
  );
}
