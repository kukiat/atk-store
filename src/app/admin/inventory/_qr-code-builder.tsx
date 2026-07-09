"use client";

import { Plus, X } from "lucide-react";
import { useMemo, useState } from "react";

import {
  ConfirmSubmitButton,
  FormPendingOverlay,
} from "@/app/admin/confirm-submit-button";
import { createQrCodeAction } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";

const inputClass =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40";
const labelClass = "grid gap-1 text-sm font-medium";

type InventoryOption = {
  id: string;
  name: string;
};

export function QrCodeBuilder({
  inventories,
}: {
  inventories: InventoryOption[];
}) {
  const [selectedId, setSelectedId] = useState(inventories[0]?.id ?? "");
  const [selectedInventoryIds, setSelectedInventoryIds] = useState<string[]>(
    [],
  );

  const selectedInventories = useMemo(
    () =>
      selectedInventoryIds
        .map((id) => inventories.find((inventory) => inventory.id === id))
        .filter((inventory): inventory is InventoryOption =>
          Boolean(inventory),
        ),
    [selectedInventoryIds, inventories],
  );

  const availableInventories = inventories.filter(
    (inventory) => !selectedInventoryIds.includes(inventory.id),
  );

  function addInventory() {
    if (!selectedId || selectedInventoryIds.includes(selectedId)) return;

    const next = [...selectedInventoryIds, selectedId];
    setSelectedInventoryIds(next);
    setSelectedId(
      inventories.find((inventory) => !next.includes(inventory.id))?.id ?? "",
    );
  }

  function removeInventory(inventoryId: string) {
    setSelectedInventoryIds((current) =>
      current.filter((id) => id !== inventoryId),
    );
    if (!selectedId) setSelectedId(inventoryId);
  }

  return (
    <form
      action={createQrCodeAction}
      className="relative grid gap-4 rounded-lg border p-4"
    >
      <FormPendingOverlay label="Generating QR" />
      <input
        type="hidden"
        name="inventoryIds"
        value={selectedInventoryIds.join(",")}
      />

      <div className="grid gap-3 md:grid-cols-[1fr_auto]">
        <label className={labelClass}>
          Inventory
          <select
            className={inputClass}
            value={selectedId}
            onChange={(event) => setSelectedId(event.target.value)}
            disabled={availableInventories.length === 0}
          >
            {availableInventories.length === 0 ? (
              <option value="">All inventories selected</option>
            ) : (
              availableInventories.map((inventory) => (
                <option key={inventory.id} value={inventory.id}>
                  {inventory.name}
                </option>
              ))
            )}
          </select>
        </label>
        <Button
          type="button"
          className="self-end"
          variant="outline"
          onClick={addInventory}
          disabled={!selectedId}
        >
          <Plus className="size-4" />
          Add inventory
        </Button>
      </div>

      <div className="grid gap-2">
        {selectedInventories.length === 0 ? (
          <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
            Select one or more inventories before generating a QR code.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {selectedInventories.map((inventory) => (
              <span
                key={inventory.id}
                className="inline-flex items-center gap-2 rounded-full border bg-muted px-3 py-1 text-sm"
              >
                {inventory.name}
                <button
                  type="button"
                  className="rounded-full text-muted-foreground hover:text-foreground"
                  onClick={() => removeInventory(inventory.id)}
                  aria-label={`Remove ${inventory.name}`}
                >
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <label className={labelClass}>
        Description
        <input
          className={inputClass}
          name="description"
          placeholder="Optional description"
        />
      </label>

      <ConfirmSubmitButton
        title="Generate QR code?"
        description="This will create a QR code for the selected inventories."
        confirmLabel="Generate QR"
        className="w-fit"
        disabled={selectedInventoryIds.length === 0}
      >
        Generate QR
      </ConfirmSubmitButton>
    </form>
  );
}
