"use server";

import { revalidatePath } from "next/cache";

import { requireCurrentUser } from "@/lib/auth";
import { adminUserService } from "@/services/admin-user.service";
import { receiptService } from "@/services/receipt.service";

function readText(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function readVatPercent(formData: FormData): number {
  const raw = readText(formData, "vatPercent").trim();
  const value = Number(raw);

  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error("VAT percentage must be between 0 and 100");
  }

  return value;
}

export async function updateReceiptSettingsAction(formData: FormData) {
  const user = await requireCurrentUser();
  await adminUserService.getActor(user);

  await receiptService.updateStoreSettings({
    storeName: readText(formData, "storeName"),
    storeLegalName: readText(formData, "storeLegalName"),
    storeTaxId: readText(formData, "storeTaxId"),
    storeAddress: readText(formData, "storeAddress"),
    storePhone: readText(formData, "storePhone"),
    storeEmail: readText(formData, "storeEmail"),
    vatPercent: readVatPercent(formData),
    receiptPrefix: readText(formData, "receiptPrefix"),
  });

  revalidatePath("/admin/inventory/receipt-settings");
}
