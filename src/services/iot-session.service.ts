import "server-only";

import { randomUUID } from "node:crypto";

import { db } from "@/db";
import { notifications, type User } from "@/db/schema";
import { publishCartUpdated } from "@/services/cart-events.service";
import { cartSyncService } from "@/services/cart-sync.service";
import { publishIotSessionUpdated } from "@/services/iot-session-events.service";
import type { CartItem } from "@/types";

export type IotShelfStatus = "open" | "updated" | "closed";
export type IotSessionStatus = "open" | "updated" | "closed" | "expired";

export type IotShelfPick = {
  shelfId: string;
  sensorId: string | null;
  channelId: string;
  inventoryId: string;
  inventoryName: string;
  cartItem: CartItem;
  pickedCount: number;
  status: IotShelfStatus;
  doorClosedAt: string | null;
};

export type IotSession = {
  sessionId: string;
  clientVisitId: number;
  userId: number;
  customerName: string | null;
  customerEmail: string;
  status: IotSessionStatus;
  items: CartItem[];
  shelves: IotShelfPick[];
  message: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  rawEvents: Array<Record<string, unknown>>;
};

type CreateIotSessionInput = {
  clientVisitId: number;
  user: User;
  shelf: {
    shelfId: string;
    sensorId: string | null;
    inventoryId: string;
    inventoryName: string;
    cartItem: Omit<CartItem, "quantity">;
  };
};

type ResolveSessionInput = {
  sessionId?: string | null;
  channelId?: string | null;
  shelfId?: string | null;
};

type ApplyPickedCountInput = ResolveSessionInput & {
  pickedCount: number;
  rawPayload?: Record<string, unknown>;
};

type CloseDoorInput = ResolveSessionInput & {
  rawPayload?: Record<string, unknown>;
};

const globalForIotSessions = globalThis as unknown as {
  atkIotSessions: Map<string, IotSession> | undefined;
};

const sessionStore =
  globalForIotSessions.atkIotSessions ?? new Map<string, IotSession>();

if (process.env.NODE_ENV !== "production") {
  globalForIotSessions.atkIotSessions = sessionStore;
}

function cloneSession(session: IotSession): IotSession {
  return structuredClone(session);
}

function upsertSessionItem(
  items: CartItem[],
  item: CartItem,
  quantity: number,
): CartItem[] {
  if (quantity <= 0) {
    return items.filter((cartItem) => cartItem.inventoryId !== item.inventoryId);
  }

  return [
    ...items.filter((cartItem) => cartItem.inventoryId !== item.inventoryId),
    { ...item, quantity },
  ];
}

class IotSessionService {
  createSession(input: CreateIotSessionInput): IotSession {
    const sessionId = randomUUID();
    const channelId = randomUUID();
    const now = new Date().toISOString();
    const shelf: IotShelfPick = {
      shelfId: input.shelf.shelfId,
      sensorId: input.shelf.sensorId,
      channelId,
      inventoryId: input.shelf.inventoryId,
      inventoryName: input.shelf.inventoryName,
      cartItem: { ...input.shelf.cartItem, quantity: 0 },
      pickedCount: 0,
      status: "open",
      doorClosedAt: null,
    };

    const session: IotSession = {
      sessionId,
      clientVisitId: input.clientVisitId,
      userId: input.user.id,
      customerName: input.user.name,
      customerEmail: input.user.email,
      status: "open",
      items: [],
      shelves: [shelf],
      message: "เปิดตู้แล้ว รอจำนวนสินค้าที่หยิบจาก IOT",
      createdAt: now,
      updatedAt: now,
      completedAt: null,
      rawEvents: [],
    };

    sessionStore.set(sessionId, session);
    return cloneSession(session);
  }

  getSession(sessionId: string): IotSession | null {
    const session = sessionStore.get(sessionId);
    return session ? cloneSession(session) : null;
  }

  listSessions(limit = 30): IotSession[] {
    return Array.from(sessionStore.values())
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit)
      .map(cloneSession);
  }

  async applyPickedCount(input: ApplyPickedCountInput): Promise<IotSession> {
    if (!Number.isInteger(input.pickedCount) || input.pickedCount < 0) {
      throw new Error("pickedCount must be a non-negative integer");
    }

    const { session, shelfIndex } = this.findSessionWithShelf(input);
    if (!session) throw new Error("IOT session not found");
    if (session.status === "closed") {
      throw new Error("IOT session is already closed");
    }
    if (shelfIndex < 0) {
      throw new Error("Shelf is not part of this IOT session");
    }

    const shelf = session.shelves[shelfIndex];
    const nextShelf: IotShelfPick = {
      ...shelf,
      pickedCount: input.pickedCount,
      status: input.pickedCount > 0 ? "updated" : "open",
    };
    const nextItem = { ...shelf.cartItem, quantity: input.pickedCount };
    const now = new Date().toISOString();

    session.shelves = session.shelves.map((item, index) =>
      index === shelfIndex ? nextShelf : item,
    );
    session.items = upsertSessionItem(session.items, nextItem, input.pickedCount);
    session.status = input.pickedCount > 0 ? "updated" : "open";
    session.updatedAt = now;
    session.rawEvents.push(input.rawPayload ?? {});
    session.message =
      input.pickedCount > 0
        ? `${shelf.inventoryName}: IOT ส่งจำนวนสะสม ${input.pickedCount} ชิ้นเข้าตะกร้าแล้ว`
        : `${shelf.inventoryName}: IOT ส่งจำนวนสะสม 0 ชิ้น สินค้าถูกเอาออกจากตะกร้าแล้ว`;

    sessionStore.set(session.sessionId, session);

    await cartSyncService.setCartItemQuantity(
      session.clientVisitId,
      nextItem,
      input.pickedCount,
      session.sessionId,
    );
    publishCartUpdated(session.userId);
    publishIotSessionUpdated(session.sessionId);
    await this.insertNotifications(session, nextShelf, "picked_count");

    return cloneSession(session);
  }

  async closeDoor(input: CloseDoorInput): Promise<IotSession> {
    const { session, shelfIndex } = this.findSessionWithShelf(input);
    if (!session) throw new Error("IOT session not found");
    if (shelfIndex < 0) {
      throw new Error("Shelf is not part of this IOT session");
    }

    const shelf = session.shelves[shelfIndex];
    const now = new Date().toISOString();
    const nextShelf: IotShelfPick = {
      ...shelf,
      status: "closed",
      doorClosedAt: now,
    };

    session.shelves = session.shelves.map((item, index) =>
      index === shelfIndex ? nextShelf : item,
    );
    session.status = session.shelves.every((item) => item.status === "closed")
      ? "closed"
      : session.status;
    session.completedAt = session.status === "closed" ? now : session.completedAt;
    session.updatedAt = now;
    session.rawEvents.push(input.rawPayload ?? {});
    session.message = `${shelf.inventoryName}: ประตูตู้ปิดแล้ว จำนวนในตะกร้าคือ ${shelf.pickedCount} ชิ้น`;

    sessionStore.set(session.sessionId, session);
    publishIotSessionUpdated(session.sessionId);
    await this.insertNotifications(session, nextShelf, "door_closed");

    return cloneSession(session);
  }

  private findSessionWithShelf(input: ResolveSessionInput): {
    session: IotSession | null;
    shelfIndex: number;
  } {
    const session = input.sessionId
      ? sessionStore.get(input.sessionId) ?? null
      : input.channelId
        ? Array.from(sessionStore.values()).find((item) =>
            item.shelves.some((shelf) => shelf.channelId === input.channelId),
          ) ?? null
        : null;

    if (!session) return { session: null, shelfIndex: -1 };

    const shelfIndex = session.shelves.findIndex((shelf) => {
      if (input.channelId) return shelf.channelId === input.channelId;
      if (input.shelfId) return shelf.shelfId === input.shelfId;
      return true;
    });

    return { session, shelfIndex };
  }

  private async insertNotifications(
    session: IotSession,
    shelf: IotShelfPick,
    eventType: "picked_count" | "door_closed",
  ): Promise<void> {
    const title =
      eventType === "door_closed" ? "IOT door closed" : "IOT picked count";
    const rawPayload = {
      sessionId: session.sessionId,
      channelId: shelf.channelId,
      shelfId: shelf.shelfId,
      sensorId: shelf.sensorId,
      inventoryId: shelf.inventoryId,
      pickedCount: shelf.pickedCount,
      status: shelf.status,
      eventType,
      strict: true,
    };

    await db.insert(notifications).values([
      {
        clientVisitId: session.clientVisitId,
        recipientType: "client",
        userId: session.userId,
        title,
        message: session.message,
        severity: "info",
        rawPayload,
      },
      {
        clientVisitId: session.clientVisitId,
        recipientType: "admin",
        title,
        message: `${session.customerName ?? session.customerEmail}: ${session.message}`,
        severity: "info",
        rawPayload,
      },
      {
        clientVisitId: session.clientVisitId,
        recipientType: "super_admin",
        title,
        message: `${session.customerName ?? session.customerEmail}: ${session.message}`,
        severity: "info",
        rawPayload,
      },
    ]);
  }
}

export const iotSessionService = new IotSessionService();
