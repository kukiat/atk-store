import "server-only";

import { and, eq, inArray, isNull } from "drizzle-orm";

import { db } from "@/db";
import { inventories, notifications, shelfs, type User } from "@/db/schema";
import { clientVisitService } from "@/services/client-visit.service";
import { iotSessionService } from "@/services/iot-session.service";
import type { CartItem, IotTransaction } from "@/types";

export type IotWatchResult = {
  clientVisitId: number;
  sessionId: string;
  transactions: IotTransaction[];
  status: "pending";
  message: string;
};

type TrustedCartItem = CartItem & {
  sensorId: string | null;
};

function aggregateRequestedQuantities(items: CartItem[]): Map<string, number> {
  const requested = new Map<string, number>();

  for (const item of items) {
    requested.set(
      item.inventoryId,
      (requested.get(item.inventoryId) ?? 0) + item.quantity,
    );
  }

  return requested;
}

class IotService {
  async watchCart(user: User, items: CartItem[]): Promise<IotWatchResult> {
    if (items.length === 0) {
      throw new Error("Cart is empty");
    }

    const activeVisit = await clientVisitService.requireActiveVisitForUser(
      user.id,
    );
    const clientVisitId = activeVisit.id;
    const trustedItems = await this.buildTrustedItems(items);
    const shelvesToOpen = this.buildShelvesToOpen(trustedItems);
    const cartItems = trustedItems.map((item) => ({
      inventoryId: item.inventoryId,
      shelfId: item.shelfId,
      name: item.name,
      price: item.price,
      weightPerPiece: item.weightPerPiece,
      unitId: item.unitId,
      imageUrl: item.imageUrl,
      quantity: item.quantity,
    }));
    const session = iotSessionService.createSession({
      clientVisitId,
      user,
      items: cartItems,
      shelves: shelvesToOpen,
    });
    const transactions = session.shelves.map((shelf) => ({
      shelfId: shelf.shelfId,
      sensorId: shelf.sensorId,
      channelId: shelf.channelId,
      expectedCount: shelf.expectedCount,
      expectedWeight: shelf.expectedWeight,
    }));

    await db.insert(notifications).values([
      {
        clientVisitId,
        recipientType: "client",
        userId: user.id,
        title: "IOT mock door opened",
        message: "ระบบ mock เปิดตู้แล้ว กำลังรอผลการหยิบสินค้า",
        severity: "info",
        rawPayload: {
          iotServerUrl: process.env.IOT_SERVER_URL ?? null,
          sessionId: session.sessionId,
          transactions,
          strict: true,
          mock: true,
        },
      },
      {
        clientVisitId,
        recipientType: "admin",
        title: "IOT watch started",
        message: `${user.name ?? user.email} submitted ${trustedItems.length} cart lines.`,
        severity: "info",
        rawPayload: {
          sessionId: session.sessionId,
          transactions,
          strict: true,
          mock: true,
        },
      },
      {
        clientVisitId,
        recipientType: "super_admin",
        title: "IOT watch started",
        message: `${user.name ?? user.email} submitted ${trustedItems.length} cart lines.`,
        severity: "info",
        rawPayload: {
          sessionId: session.sessionId,
          transactions,
          strict: true,
          mock: true,
        },
      },
    ]);

    return {
      clientVisitId,
      sessionId: session.sessionId,
      transactions,
      status: "pending",
      message: "IOT mock door opened. Waiting for picked count.",
    };
  }

  private async buildTrustedItems(
    items: CartItem[],
  ): Promise<TrustedCartItem[]> {
    const requested = aggregateRequestedQuantities(items);
    const inventoryIds = Array.from(requested.keys());
    const rows = await db
      .select({
        inventoryId: inventories.id,
        shelfId: inventories.shelfId,
        name: inventories.name,
        price: inventories.price,
        amount: inventories.amount,
        weightPerPiece: inventories.weightPerPiece,
        unitId: inventories.unitId,
        imageUrl: inventories.imageUrl,
        sensorId: shelfs.sensorId,
      })
      .from(inventories)
      .innerJoin(shelfs, eq(inventories.shelfId, shelfs.id))
      .where(
        and(
          inArray(inventories.id, inventoryIds),
          eq(inventories.isActive, true),
          isNull(inventories.deletedAt),
          isNull(shelfs.deletedAt),
        ),
      );

    const byId = new Map(rows.map((row) => [row.inventoryId, row]));

    return inventoryIds.map((inventoryId) => {
      const row = byId.get(inventoryId);
      const quantity = requested.get(inventoryId) ?? 0;

      if (!row) throw new Error("Selected inventory is not available");
      if (quantity > row.amount) {
        throw new Error(`${row.name} has only ${row.amount} items available`);
      }

      return {
        inventoryId: row.inventoryId,
        shelfId: row.shelfId,
        name: row.name,
        price: row.price,
        weightPerPiece: row.weightPerPiece,
        unitId: row.unitId,
        imageUrl: row.imageUrl,
        sensorId: row.sensorId,
        quantity,
      };
    });
  }

  private buildShelvesToOpen(items: TrustedCartItem[]) {
    const shelvesById = new Map<
      string,
      {
        shelfId: string;
        sensorId: string | null;
        inventoryId: string;
        inventoryName: string;
        expectedCount: number;
        expectedWeight: number;
      }
    >();

    for (const item of items) {
      const existing = shelvesById.get(item.shelfId);
      if (existing && existing.inventoryId !== item.inventoryId) {
        throw new Error("Strict IOT PoC supports one inventory per shelf");
      }

      shelvesById.set(item.shelfId, {
        shelfId: item.shelfId,
        sensorId: item.sensorId,
        inventoryId: item.inventoryId,
        inventoryName: item.name,
        expectedCount: (existing?.expectedCount ?? 0) + item.quantity,
        expectedWeight:
          (existing?.expectedWeight ?? 0) + item.quantity * item.weightPerPiece,
      });
    }

    return Array.from(shelvesById.values());
  }
}

export const iotService = new IotService();
