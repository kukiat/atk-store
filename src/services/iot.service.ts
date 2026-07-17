import "server-only";

import { randomUUID } from "node:crypto";

import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import { inventories, notifications, type User } from "@/db/schema";
import { clientVisitService } from "@/services/client-visit.service";
import { iotSessionService } from "@/services/iot-session.service";
import {
  createMockIotPickSession,
  isMockIotServerEnabled,
} from "@/services/mock-iot-server.service";
import type { CartItem } from "@/types";

export type IotOpenInventoryResult = {
  clientVisitId: number;
  sessionId: string;
  channelId: string;
  inventoryId: string;
  status: "open";
  inventory: CartItem;
  inStoreQty: number | null;
  currentQty: number | null;
  branchCode: string;
  message: string;
};

type InventoryMaster = {
  id: string;
  name: string;
  price: number;
  amount: number;
  weightPerPiece: number;
  unitId: string;
  imageUrl: string | null;
};

function getIotServerUrl() {
  return process.env.IOT_SERVER_URL?.trim().replace(/\/$/, "") || null;
}

function getBranchCode() {
  return process.env.BRANCH_CODE?.trim() || "main";
}

function getIotHeaders() {
  const apiKey = process.env.IOT_API_KEY?.trim();
  return {
    "Content-Type": "application/json",
    ...(apiKey ? { "x-iot-api-key": apiKey } : {}),
  };
}

class IotService {
  async openInventory(
    user: User,
    inventoryId: string,
  ): Promise<IotOpenInventoryResult> {
    const activeVisit = await clientVisitService.requireActiveVisitForUser(
      user.id,
    );
    const clientVisitId = activeVisit.id;
    const inventoryMaster = await this.getInventoryMaster(inventoryId);
    if (!inventoryMaster) throw new Error("Inventory not found");

    const sessionId = randomUUID();
    const branchCode = getBranchCode();
    const productConfig = {
      productId: inventoryMaster.id,
      inStoreQty: null,
    };
    await this.createIotPickSession({
      uuid: sessionId,
      email: user.email,
      sku: inventoryMaster.id,
    });

    const cartItem = {
      inventoryId: inventoryMaster.id,
      name: inventoryMaster.name,
      price: inventoryMaster.price,
      weightPerPiece: inventoryMaster.weightPerPiece,
      unitId: inventoryMaster.unitId,
      imageUrl: inventoryMaster.imageUrl,
    };

    const session = await iotSessionService.createSession({
      sessionId,
      clientVisitId,
      user,
      inventory: {
        inventoryId: inventoryMaster.id,
        inventoryName: inventoryMaster.name,
        cartItem,
      },
      branchCode,
      inStoreQty: productConfig.inStoreQty,
      metadata: {
        productConfig,
      },
    });
    const inventory = { ...cartItem, quantity: 0 };

    await this.insertOpenNotifications({
      user,
      clientVisitId,
      sessionId: session.sessionId,
      inventory,
      inStoreQty: productConfig.inStoreQty,
      branchCode,
    });

    return {
      clientVisitId,
      sessionId: session.sessionId,
      channelId: session.sessionId,
      inventoryId: inventoryMaster.id,
      status: "open",
      inventory,
      inStoreQty: productConfig.inStoreQty,
      currentQty: productConfig.inStoreQty,
      branchCode,
      message: "เปิด session แล้ว หยิบสินค้าได้เลย",
    };
  }

  private async getInventoryMaster(
    inventoryId: string,
  ): Promise<InventoryMaster | null> {
    const [inventory] = await db
      .select({
        id: inventories.id,
        name: inventories.name,
        price: inventories.price,
        amount: inventories.amount,
        weightPerPiece: inventories.weightPerPiece,
        unitId: inventories.unitId,
        imageUrl: inventories.imageUrl,
      })
      .from(inventories)
      .where(
        and(
          eq(inventories.id, inventoryId.trim()),
          eq(inventories.isActive, true),
          isNull(inventories.deletedAt),
        ),
      )
      .limit(1);

    return inventory ?? null;
  }

  private async createIotPickSession(input: {
    uuid: string;
    email: string;
    sku: string;
  }) {
    if (isMockIotServerEnabled()) {
      await createMockIotPickSession(input);
      return;
    }

    const iotServerUrl = getIotServerUrl();
    if (!iotServerUrl) return;

    const response = await fetch(`${iotServerUrl}/pick-sessions`, {
      method: "POST",
      headers: getIotHeaders(),
      body: JSON.stringify(input),
    });

    console.log("response", JSON.stringify(response, null, 2));
    console.log(`FETCH: ${iotServerUrl}/pick-sessions`);
    console.log(`HEADERS: ${JSON.stringify(getIotHeaders(), null, 2)}`);
    console.log(`BODY: ${JSON.stringify(input, null, 2)}`);

    if (!response.ok) {
      throw new Error(
        `IOT pick-sessions failed with status ${response.status}`,
      );
    }
  }

  private async insertOpenNotifications(input: {
    user: User;
    clientVisitId: number;
    sessionId: string;
    inventory: CartItem;
    inStoreQty: number | null;
    branchCode: string;
  }) {
    const rawPayload = {
      iotServerUrl: process.env.IOT_SERVER_URL ?? null,
      sessionId: input.sessionId,
      inventoryId: input.inventory.inventoryId,
      inStoreQty: input.inStoreQty,
      branchCode: input.branchCode,
      strict: true,
    };

    await db.insert(notifications).values([
      {
        clientVisitId: input.clientVisitId,
        recipientType: "client",
        userId: input.user.id,
        title: "IOT inventory session opened",
        message: "ระบบเปิด session แล้ว รอข้อมูลจำนวนสินค้าที่หยิบจาก IOT",
        severity: "info",
        rawPayload,
      },
      {
        clientVisitId: input.clientVisitId,
        recipientType: "admin",
        title: "IOT inventory session opened",
        message: `${input.user.name ?? input.user.email} opened ${input.inventory.name}.`,
        severity: "info",
        rawPayload,
      },
      {
        clientVisitId: input.clientVisitId,
        recipientType: "super_admin",
        title: "IOT inventory session opened",
        message: `${input.user.name ?? input.user.email} opened ${input.inventory.name}.`,
        severity: "info",
        rawPayload,
      },
    ]);
  }
}

export const iotService = new IotService();
