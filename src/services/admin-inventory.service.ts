import "server-only";

import { and, asc, desc, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import {
  groups,
  inventories,
  notifications,
  orderItems,
  orders,
  qrCodes,
  shelfs,
  units,
  type Group,
  type Inventory,
  type NewInventory,
  type NewShelf,
  type NewUnit,
  type QrCode,
  type Shelf,
  type Unit,
} from "@/db/schema";
import { generateQrDataUrl } from "@/lib/qr-image";
import { encodeShelfQrPayload } from "@/lib/qr-payload";
import type { AdminActor } from "@/services/admin-user.service";
import { s3StorageService } from "@/services/s3-storage.service";

export type InventoryAdminData = {
  groups: Group[];
  shelfs: Shelf[];
  units: Unit[];
  inventories: Inventory[];
  qrCodes: QrCode[];
  notifications: Array<typeof notifications.$inferSelect>;
  orders: Array<typeof orders.$inferSelect>;
  orderItems: Array<typeof orderItems.$inferSelect>;
};

function requireInventoryPermission(actor: AdminActor) {
  if (!actor.permissions.canAccessAdmin) {
    throw new Error("Admin permission is required");
  }
}

function readOptionalText(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readRequiredText(formData: FormData, key: string): string {
  const value = readOptionalText(formData.get(key));
  if (!value) throw new Error(`${key} is required`);
  return value;
}

function readRequiredNumber(formData: FormData, key: string): number {
  const raw = readRequiredText(formData, key);
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new Error(`${key} must be a number`);
  return value;
}

function readRequiredInteger(formData: FormData, key: string): number {
  const value = readRequiredNumber(formData, key);
  if (!Number.isInteger(value)) throw new Error(`${key} must be an integer`);
  return value;
}

function readId(formData: FormData, key = "id"): string {
  return readRequiredText(formData, key);
}

function readBoolean(formData: FormData, key: string): boolean {
  return formData.get(key) === "on" || formData.get(key) === "true";
}

function readImageFile(formData: FormData): File | null {
  const value = formData.get("imageFile");
  return value instanceof File && value.size > 0 ? value : null;
}

class AdminInventoryService {
  async getDashboardData(actor: AdminActor): Promise<InventoryAdminData> {
    requireInventoryPermission(actor);

    const [
      groupRows,
      shelfRows,
      unitRows,
      inventoryRows,
      qrRows,
      notificationRows,
      orderRows,
      orderItemRows,
    ] = await Promise.all([
      db
        .select()
        .from(groups)
        .where(isNull(groups.deletedAt))
        .orderBy(asc(groups.name)),
      db
        .select()
        .from(shelfs)
        .where(isNull(shelfs.deletedAt))
        .orderBy(asc(shelfs.name)),
      db
        .select()
        .from(units)
        .where(isNull(units.deletedAt))
        .orderBy(asc(units.name)),
      db
        .select()
        .from(inventories)
        .where(isNull(inventories.deletedAt))
        .orderBy(asc(inventories.name)),
      db
        .select()
        .from(qrCodes)
        .where(isNull(qrCodes.deletedAt))
        .orderBy(desc(qrCodes.createdAt)),
      db
        .select()
        .from(notifications)
        .where(isNull(notifications.deletedAt))
        .orderBy(desc(notifications.createdAt))
        .limit(20),
      db
        .select()
        .from(orders)
        .where(isNull(orders.deletedAt))
        .orderBy(desc(orders.createdAt))
        .limit(20),
      db
        .select()
        .from(orderItems)
        .where(isNull(orderItems.deletedAt))
        .orderBy(desc(orderItems.createdAt))
        .limit(100),
    ]);

    return {
      groups: groupRows,
      shelfs: shelfRows,
      units: unitRows,
      inventories: inventoryRows,
      qrCodes: qrRows,
      notifications: notificationRows,
      orders: orderRows,
      orderItems: orderItemRows,
    };
  }

  async saveGroup(actor: AdminActor, formData: FormData): Promise<void> {
    requireInventoryPermission(actor);
    const id = readOptionalText(formData.get("id"));
    const name = readRequiredText(formData, "name");
    const now = new Date();

    if (id) {
      await db
        .update(groups)
        .set({ name, updatedAt: now })
        .where(eq(groups.id, id));
      return;
    }

    await db.insert(groups).values({ name, updatedAt: now });
  }

  async deleteGroup(actor: AdminActor, formData: FormData): Promise<void> {
    requireInventoryPermission(actor);
    await db
      .update(groups)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(groups.id, readId(formData)));
  }

  async saveUnit(actor: AdminActor, formData: FormData): Promise<void> {
    requireInventoryPermission(actor);
    const id = readOptionalText(formData.get("id"));
    const values: NewUnit = {
      name: readRequiredText(formData, "name"),
      updatedAt: new Date(),
    };

    if (id) {
      await db.update(units).set(values).where(eq(units.id, id));
      return;
    }

    await db.insert(units).values(values).onConflictDoNothing();
  }

  async deleteUnit(actor: AdminActor, formData: FormData): Promise<void> {
    requireInventoryPermission(actor);
    await db
      .update(units)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(units.id, readId(formData)));
  }

  async saveShelf(actor: AdminActor, formData: FormData): Promise<void> {
    requireInventoryPermission(actor);
    const id = readOptionalText(formData.get("id"));
    const uploadedImageUrl = await s3StorageService.uploadImageFile(
      readImageFile(formData),
      "shelf",
    );
    const values: NewShelf = {
      groupId: readOptionalText(formData.get("groupId")),
      name: readRequiredText(formData, "name"),
      imageUrl: uploadedImageUrl ?? readOptionalText(formData.get("imageUrl")),
      sensorId: readOptionalText(formData.get("sensorId")),
      updatedAt: new Date(),
    };

    if (id) {
      await db.update(shelfs).set(values).where(eq(shelfs.id, id));
      return;
    }

    await db.insert(shelfs).values(values);
  }

  async deleteShelf(actor: AdminActor, formData: FormData): Promise<void> {
    requireInventoryPermission(actor);
    await db
      .update(shelfs)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(shelfs.id, readId(formData)));
  }

  async saveInventory(actor: AdminActor, formData: FormData): Promise<void> {
    requireInventoryPermission(actor);
    const id = readOptionalText(formData.get("id"));
    const uploadedImageUrl = await s3StorageService.uploadImageFile(
      readImageFile(formData),
      "product",
    );
    const values: NewInventory = {
      shelfId: readRequiredText(formData, "shelfId"),
      name: readRequiredText(formData, "name"),
      description: readOptionalText(formData.get("description")),
      price: readRequiredNumber(formData, "price"),
      amount: readRequiredInteger(formData, "amount"),
      weightPerPiece: readRequiredNumber(formData, "weightPerPiece"),
      unitId: readRequiredText(formData, "unitId"),
      isActive: readBoolean(formData, "isActive"),
      imageUrl: uploadedImageUrl ?? readOptionalText(formData.get("imageUrl")),
      updatedAt: new Date(),
    };

    if (id) {
      await db.update(inventories).set(values).where(eq(inventories.id, id));
      return;
    }

    await db.insert(inventories).values(values);
  }

  async deleteInventory(actor: AdminActor, formData: FormData): Promise<void> {
    requireInventoryPermission(actor);
    await db
      .update(inventories)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(inventories.id, readId(formData)));
  }

  async importInventories(
    actor: AdminActor,
    formData: FormData,
  ): Promise<void> {
    requireInventoryPermission(actor);
    const csv = readRequiredText(formData, "csv");
    const lines = csv
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const [headerLine, ...dataLines] = lines;
    if (!headerLine) return;

    const headers = headerLine.split(",").map((header) => header.trim());
    const now = new Date();

    for (const line of dataLines) {
      const values = line.split(",").map((value) => value.trim());
      const row = Object.fromEntries(
        headers.map((header, index) => [header, values[index] ?? ""]),
      );
      const shelfId = String(row.shelfId ?? "").trim();
      const name = String(row.name ?? "").trim();
      if (!shelfId || !name) continue;

      const payload: NewInventory = {
        shelfId,
        name,
        description: String(row.description ?? "").trim() || null,
        price: Number(row.price ?? 0),
        amount: Number(row.amount ?? 0),
        weightPerPiece: Number(row.weightPerPiece ?? 0),
        unitId: String(row.unitId ?? "").trim(),
        isActive: String(row.isActive ?? "true").toLowerCase() !== "false",
        imageUrl: String(row.imageUrl ?? "").trim() || null,
        updatedAt: now,
      };

      const [existing] = await db
        .select({ id: inventories.id })
        .from(inventories)
        .where(
          and(
            eq(inventories.shelfId, shelfId),
            eq(inventories.name, name),
            isNull(inventories.deletedAt),
          ),
        )
        .limit(1);

      if (existing) {
        await db
          .update(inventories)
          .set(payload)
          .where(eq(inventories.id, existing.id));
      } else {
        await db.insert(inventories).values(payload);
      }
    }
  }

  async createQrCode(actor: AdminActor, formData: FormData): Promise<void> {
    requireInventoryPermission(actor);
    const shelfIds = readRequiredText(formData, "shelfIds")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
    if (shelfIds.length === 0)
      throw new Error("At least one shelf is required");

    const encodedPayload = encodeShelfQrPayload({ shelfIds });
    const imageUrl = await s3StorageService.uploadQrDataUrl(
      await generateQrDataUrl(encodedPayload),
    );

    await db.insert(qrCodes).values({
      shelfIds: shelfIds.join(","),
      encodedPayload,
      imageUrl,
      description: readOptionalText(formData.get("description")),
      updatedAt: new Date(),
    });
  }

  async deleteQrCode(actor: AdminActor, formData: FormData): Promise<void> {
    requireInventoryPermission(actor);
    await db
      .update(qrCodes)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(qrCodes.id, readId(formData)));
  }
}

export const adminInventoryService = new AdminInventoryService();
