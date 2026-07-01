"use client";

import { Plus, X } from "lucide-react";
import { useMemo, useState } from "react";

import { createQrCodeAction } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";

const inputClass =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40";
const labelClass = "grid gap-1 text-sm font-medium";

type ShelfOption = {
  id: string;
  name: string;
};

export function QrCodeBuilder({ shelves }: { shelves: ShelfOption[] }) {
  const [selectedId, setSelectedId] = useState(shelves[0]?.id ?? "");
  const [selectedShelfIds, setSelectedShelfIds] = useState<string[]>([]);

  const selectedShelves = useMemo(
    () =>
      selectedShelfIds
        .map((id) => shelves.find((shelf) => shelf.id === id))
        .filter((shelf): shelf is ShelfOption => Boolean(shelf)),
    [selectedShelfIds, shelves],
  );

  const availableShelves = shelves.filter(
    (shelf) => !selectedShelfIds.includes(shelf.id),
  );

  function addShelf() {
    if (!selectedId || selectedShelfIds.includes(selectedId)) return;

    const next = [...selectedShelfIds, selectedId];
    setSelectedShelfIds(next);
    setSelectedId(shelves.find((shelf) => !next.includes(shelf.id))?.id ?? "");
  }

  function removeShelf(shelfId: string) {
    setSelectedShelfIds((current) => current.filter((id) => id !== shelfId));
    if (!selectedId) setSelectedId(shelfId);
  }

  return (
    <form
      action={createQrCodeAction}
      className="grid gap-4 rounded-lg border p-4"
    >
      <input type="hidden" name="shelfIds" value={selectedShelfIds.join(",")} />

      <div className="grid gap-3 md:grid-cols-[1fr_auto]">
        <label className={labelClass}>
          Shelf
          <select
            className={inputClass}
            value={selectedId}
            onChange={(event) => setSelectedId(event.target.value)}
            disabled={availableShelves.length === 0}
          >
            {availableShelves.length === 0 ? (
              <option value="">All shelves selected</option>
            ) : (
              availableShelves.map((shelf) => (
                <option key={shelf.id} value={shelf.id}>
                  {shelf.name}
                </option>
              ))
            )}
          </select>
        </label>
        <Button
          type="button"
          className="self-end"
          variant="outline"
          onClick={addShelf}
          disabled={!selectedId}
        >
          <Plus className="size-4" />
          Add shelf
        </Button>
      </div>

      <div className="grid gap-2">
        {selectedShelves.length === 0 ? (
          <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
            Select one or more shelves before generating a QR code.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {selectedShelves.map((shelf) => (
              <span
                key={shelf.id}
                className="inline-flex items-center gap-2 rounded-full border bg-muted px-3 py-1 text-sm"
              >
                {shelf.name}
                <button
                  type="button"
                  className="rounded-full text-muted-foreground hover:text-foreground"
                  onClick={() => removeShelf(shelf.id)}
                  aria-label={`Remove ${shelf.name}`}
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

      <Button className="w-fit" disabled={selectedShelfIds.length === 0}>
        Generate QR
      </Button>
    </form>
  );
}
