import "server-only";

import { and, asc, eq, gt, isNull } from "drizzle-orm";

import { db } from "@/db";
import { inventories, notifications, shelfs, type User } from "@/db/schema";
import { clientVisitService } from "@/services/client-visit.service";
import { iotSessionService } from "@/services/iot-session.service";
import type { CartItem } from "@/types";

export type IotOpenShelfResult = {
  clientVisitId: number;
  sessionId: string;
  channelId: string;
  shelfId: string;
  sensorId: string | null;
  status: "open";
  inventory: CartItem;
  message: string;
};

type ShelfInventory = {
  shelfId: string;
  shelfName: string;
  sensorId: string | null;
  inventoryId: string;
  inventoryName: string;
  price: number;
  amount: number;
  weightPerPiece: number;
  unitId: string;
  imageUrl: string | null;
};

class IotService {
  async openShelf(user: User, shelfId: string): Promise<IotOpenShelfResult> {
    const activeVisit = await clientVisitService.requireActiveVisitForUser(
      user.id,
    );
    const clientVisitId = activeVisit.id;
    const shelfInventory = await this.getSingleAvailableInventory(shelfId);

    if (!shelfInventory) {
      throw new Error("Shelf has no available inventory");
    }

    const cartItem = {
      inventoryId: shelfInventory.inventoryId,
      shelfId: shelfInventory.shelfId,
      name: shelfInventory.inventoryName,
      price: shelfInventory.price,
      weightPerPiece: shelfInventory.weightPerPiece,
      unitId: shelfInventory.unitId,
      imageUrl: shelfInventory.imageUrl,
    };
    const session = iotSessionService.createSession({
      clientVisitId,
      user,
      shelf: {
        shelfId: shelfInventory.shelfId,
        sensorId: shelfInventory.sensorId,
        inventoryId: shelfInventory.inventoryId,
        inventoryName: shelfInventory.inventoryName,
        cartItem,
      },
    });
    const shelf = session.shelves[0];
    const inventory = { ...cartItem, quantity: 0 };

    await db.insert(notifications).values([
      {
        clientVisitId,
        recipientType: "client",
        userId: user.id,
        title: "IOT shelf opened",
        message: "ระบบเปิดตู้แล้ว รอข้อมูลจำนวนสินค้าที่หยิบจาก IOT",
        severity: "info",
        rawPayload: {
          iotServerUrl: process.env.IOT_SERVER_URL ?? null,
          sessionId: session.sessionId,
          channelId: shelf.channelId,
          shelfId: shelf.shelfId,
          sensorId: shelf.sensorId,
          inventoryId: shelf.inventoryId,
          strict: true,
          mock: true,
        },
      },
      {
        clientVisitId,
        recipientType: "admin",
        title: "IOT shelf opened",
        message: `${user.name ?? user.email} opened ${shelfInventory.shelfName}.`,
        severity: "info",
        rawPayload: {
          sessionId: session.sessionId,
          channelId: shelf.channelId,
          shelfId: shelf.shelfId,
          sensorId: shelf.sensorId,
          inventoryId: shelf.inventoryId,
          strict: true,
          mock: true,
        },
      },
      {
        clientVisitId,
        recipientType: "super_admin",
        title: "IOT shelf opened",
        message: `${user.name ?? user.email} opened ${shelfInventory.shelfName}.`,
        severity: "info",
        rawPayload: {
          sessionId: session.sessionId,
          channelId: shelf.channelId,
          shelfId: shelf.shelfId,
          sensorId: shelf.sensorId,
          inventoryId: shelf.inventoryId,
          strict: true,
          mock: true,
        },
      },
    ]);

    return {
      clientVisitId,
      sessionId: session.sessionId,
      channelId: shelf.channelId,
      shelfId: shelf.shelfId,
      sensorId: shelf.sensorId,
      status: "open",
      inventory,
      message: "เปิดตู้แล้ว หยิบสินค้าได้เลย",
    };
  }

  private async getSingleAvailableInventory(
    shelfId: string,
  ): Promise<ShelfInventory | null> {
    const normalizedShelfId = shelfId.trim();
    if (!normalizedShelfId) return null;

    const rows = await db
      .select({
        shelfId: shelfs.id,
        shelfName: shelfs.name,
        sensorId: shelfs.sensorId,
        inventoryId: inventories.id,
        inventoryName: inventories.name,
        price: inventories.price,
        amount: inventories.amount,
        weightPerPiece: inventories.weightPerPiece,
        unitId: inventories.unitId,
        imageUrl: inventories.imageUrl,
      })
      .from(shelfs)
      .innerJoin(inventories, eq(inventories.shelfId, shelfs.id))
      .where(
        and(
          eq(shelfs.id, normalizedShelfId),
          isNull(shelfs.deletedAt),
          eq(inventories.isActive, true),
          isNull(inventories.deletedAt),
          gt(inventories.amount, 0),
        ),
      )
      .orderBy(asc(inventories.name));

    if (rows.length === 0) return null;
    if (rows.length > 1) {
      throw new Error("Strict IOT flow supports one inventory per shelf");
    }

    return rows[0];
  }
}

export const iotService = new IotService();
