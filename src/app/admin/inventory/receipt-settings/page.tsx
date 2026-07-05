import { Save } from "lucide-react";

import { updateReceiptSettingsAction } from "@/app/admin/inventory/receipt-settings/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { receiptService } from "@/services/receipt.service";

const inputClass =
  "h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40";
const textareaClass =
  "min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40";

export default async function ReceiptSettingsPage() {
  const settings = await receiptService.getStoreSettings();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Receipt Settings</CardTitle>
        <CardDescription>
          Store profile and VAT percentage used for newly issued receipts.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={updateReceiptSettingsAction} className="grid gap-5">
          <div className="grid gap-4 md:grid-cols-2">
            <TextField
              label="Store name"
              name="storeName"
              defaultValue={settings.storeName}
              required
            />
            <TextField
              label="Legal name"
              name="storeLegalName"
              defaultValue={settings.storeLegalName ?? ""}
            />
            <TextField
              label="Tax ID"
              name="storeTaxId"
              defaultValue={settings.storeTaxId ?? ""}
            />
            <TextField
              label="Receipt prefix"
              name="receiptPrefix"
              defaultValue={settings.receiptPrefix}
              required
            />
            <TextField
              label="Phone"
              name="storePhone"
              defaultValue={settings.storePhone ?? ""}
            />
            <TextField
              label="Email"
              name="storeEmail"
              defaultValue={settings.storeEmail ?? ""}
              type="email"
            />
            <TextField
              label="VAT percentage"
              name="vatPercent"
              defaultValue={String(settings.vatPercent)}
              type="number"
              min="0"
              max="100"
              step="0.01"
              required
            />
          </div>

          <label className="grid gap-1 text-sm font-medium">
            Store address
            <textarea
              className={textareaClass}
              name="storeAddress"
              defaultValue={settings.storeAddress ?? ""}
            />
          </label>

          <div className="rounded-lg border border-dashed bg-muted/30 p-3 text-sm text-muted-foreground">
            VAT is calculated as included in the product price. Changing this
            setting only affects receipts issued after saving.
          </div>

          <Button type="submit" className="w-fit">
            <Save className="size-4" />
            Save settings
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function TextField({
  label,
  name,
  defaultValue,
  type = "text",
  required = false,
  min,
  max,
  step,
}: {
  label: string;
  name: string;
  defaultValue: string;
  type?: string;
  required?: boolean;
  min?: string;
  max?: string;
  step?: string;
}) {
  return (
    <label className="grid gap-1 text-sm font-medium">
      {label}
      <input
        className={inputClass}
        name={name}
        defaultValue={defaultValue}
        type={type}
        required={required}
        min={min}
        max={max}
        step={step}
      />
    </label>
  );
}
