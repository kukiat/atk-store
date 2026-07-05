import "server-only";

import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  receipts,
  storeSettings,
  type StoreSettings,
} from "@/db/schema";
import { WALLET_CURRENCY } from "@/lib/money";

export type StoreSettingsInput = {
  storeName: string;
  storeLegalName?: string | null;
  storeTaxId?: string | null;
  storeAddress?: string | null;
  storePhone?: string | null;
  storeEmail?: string | null;
  vatPercent: number;
  receiptPrefix: string;
  currency?: string;
};

const DEFAULT_SETTINGS: StoreSettings = {
  key: "default",
  storeName: "ATK Store",
  storeLegalName: null,
  storeTaxId: null,
  storeAddress: null,
  storePhone: null,
  storeEmail: null,
  vatPercent: 0,
  receiptPrefix: "RC",
  currency: WALLET_CURRENCY,
  createdAt: new Date(0),
  updatedAt: new Date(0),
  deletedAt: null,
};

function cleanNullableText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

class ReceiptService {
  async getStoreSettings(): Promise<StoreSettings> {
    const [settings] = await db
      .select()
      .from(storeSettings)
      .where(eq(storeSettings.key, "default"))
      .limit(1);

    return settings ?? DEFAULT_SETTINGS;
  }

  async updateStoreSettings(input: StoreSettingsInput): Promise<StoreSettings> {
    const now = new Date();
    const payload = {
      key: "default",
      storeName: input.storeName.trim() || "ATK Store",
      storeLegalName: cleanNullableText(input.storeLegalName),
      storeTaxId: cleanNullableText(input.storeTaxId),
      storeAddress: cleanNullableText(input.storeAddress),
      storePhone: cleanNullableText(input.storePhone),
      storeEmail: cleanNullableText(input.storeEmail),
      vatPercent: input.vatPercent,
      receiptPrefix: input.receiptPrefix.trim() || "RC",
      currency: input.currency?.trim() || WALLET_CURRENCY,
      updatedAt: now,
    };

    const [settings] = await db
      .insert(storeSettings)
      .values({ ...payload, createdAt: now })
      .onConflictDoUpdate({
        target: storeSettings.key,
        set: payload,
      })
      .returning();

    if (!settings) throw new Error("Failed to save receipt settings");
    return settings;
  }

  async listReceiptsForUser(userId: number) {
    return db.query.receipts.findMany({
      where: eq(receipts.userId, userId),
      orderBy: desc(receipts.issuedAt),
      with: {
        items: {
          orderBy: (items, { asc }) => [asc(items.createdAt)],
        },
      },
    });
  }

  async getReceiptForUser(receiptNo: string, userId: number) {
    return db.query.receipts.findFirst({
      where: (table, { and }) =>
        and(eq(table.receiptNo, receiptNo), eq(table.userId, userId)),
      with: {
        items: {
          orderBy: (items, { asc }) => [asc(items.createdAt)],
        },
        order: true,
      },
    });
  }
}

export const receiptService = new ReceiptService();
