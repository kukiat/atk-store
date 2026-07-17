import "server-only";

import { randomUUID } from "node:crypto";

import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  inventories,
  iotSessionEvents,
  iotSessions,
  notifications,
  users,
  type User,
} from "@/db/schema";
import { publishCartUpdated } from "@/services/cart-events.service";
import { cartSyncService } from "@/services/cart-sync.service";
import { publishIotSessionUpdated } from "@/services/iot-session-events.service";
import type { CartItem } from "@/types";

export type IotSessionStatus = "open" | "updated" | "closed" | "expired";
export type IotSessionEventType = "picked_count" | "door_closed" | "error";

export type IotSession = {
  sessionId: string;
  clientVisitId: number;
  userId: number;
  customerName: string | null;
  customerEmail: string;
  inventoryId: string;
  inventoryName: string;
  branchCode: string;
  status: IotSessionStatus;
  pickedCount: number;
  currentQty: number | null;
  inStoreQty: number | null;
  items: CartItem[];
  message: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  rawEvents: Array<Record<string, unknown>>;
};

type InventorySessionMaster = {
  inventoryId: string;
  inventoryName: string;
  cartItem: Omit<CartItem, "quantity">;
};

type CreateIotSessionInput = {
  sessionId?: string;
  clientVisitId: number;
  user: User;
  inventory: InventorySessionMaster;
  branchCode: string;
  inStoreQty?: number | null;
  metadata?: Record<string, unknown>;
};

type ResolveSessionInput = {
  sessionId?: string | null;
  inventoryId?: string | null;
};

type ApplyPickedCountInput = ResolveSessionInput & {
  pickedCount: number;
  currentQty?: number | null;
  seq?: number | null;
  occurredAt?: string | null;
  rawPayload?: Record<string, unknown>;
};

type ApplyFinalCountInput = ResolveSessionInput & {
  finalPickedCount: number;
  rawPayload?: Record<string, unknown>;
};

type CloseDoorInput = ResolveSessionInput & {
  seq?: number | null;
  occurredAt?: string | null;
  rawPayload?: Record<string, unknown>;
};

type ApplyErrorInput = ResolveSessionInput & {
  message: string;
  seq?: number | null;
  rawPayload?: Record<string, unknown>;
};

function toIso(value: Date | string | null): string | null {
  if (!value) return null;
  return value instanceof Date
    ? value.toISOString()
    : new Date(value).toISOString();
}

function buildCartItem(input: {
  inventoryId: string;
  name: string;
  price: number;
  weightPerPiece: number;
  unitId: string;
  imageUrl: string | null;
  quantity: number;
}): CartItem {
  return {
    inventoryId: input.inventoryId,
    name: input.name,
    price: input.price,
    weightPerPiece: input.weightPerPiece,
    unitId: input.unitId,
    imageUrl: input.imageUrl,
    quantity: input.quantity,
  };
}

class IotSessionService {
  async createSession(input: CreateIotSessionInput): Promise<IotSession> {
    const sessionId = input.sessionId ?? randomUUID();
    const now = new Date();

    await db.insert(iotSessions).values({
      id: sessionId,
      clientVisitId: input.clientVisitId,
      userId: input.user.id,
      inventoryId: input.inventory.inventoryId,
      branchCode: input.branchCode,
      status: "open",
      pickedCount: 0,
      currentQty: input.inStoreQty ?? null,
      inStoreQty: input.inStoreQty ?? null,
      metadata: input.metadata,
      openedAt: now,
      updatedAt: now,
    });

    const session = await this.getSession(sessionId);
    if (!session) throw new Error("Failed to create IOT session");
    return session;
  }

  async getSession(sessionId: string): Promise<IotSession | null> {
    const [row] = await db
      .select({
        id: iotSessions.id,
        clientVisitId: iotSessions.clientVisitId,
        userId: iotSessions.userId,
        customerName: users.name,
        customerEmail: users.email,
        inventoryId: iotSessions.inventoryId,
        inventoryName: inventories.name,
        price: inventories.price,
        weightPerPiece: inventories.weightPerPiece,
        unitId: inventories.unitId,
        imageUrl: inventories.imageUrl,
        branchCode: iotSessions.branchCode,
        status: iotSessions.status,
        pickedCount: iotSessions.pickedCount,
        currentQty: iotSessions.currentQty,
        inStoreQty: iotSessions.inStoreQty,
        createdAt: iotSessions.createdAt,
        updatedAt: iotSessions.updatedAt,
        closedAt: iotSessions.closedAt,
      })
      .from(iotSessions)
      .innerJoin(inventories, eq(iotSessions.inventoryId, inventories.id))
      .innerJoin(users, eq(iotSessions.userId, users.id))
      .where(eq(iotSessions.id, sessionId))
      .limit(1);

    if (!row) return null;

    const events = await db
      .select({ rawPayload: iotSessionEvents.rawPayload })
      .from(iotSessionEvents)
      .where(eq(iotSessionEvents.sessionId, sessionId))
      .orderBy(desc(iotSessionEvents.createdAt))
      .limit(50);

    const cartItem = buildCartItem({
      inventoryId: row.inventoryId,
      name: row.inventoryName,
      price: row.price,
      weightPerPiece: row.weightPerPiece,
      unitId: row.unitId,
      imageUrl: row.imageUrl,
      quantity: row.pickedCount,
    });
    const items = row.pickedCount > 0 ? [cartItem] : [];

    return {
      sessionId: row.id,
      clientVisitId: row.clientVisitId,
      userId: row.userId,
      customerName: row.customerName,
      customerEmail: row.customerEmail,
      inventoryId: row.inventoryId,
      inventoryName: row.inventoryName,
      branchCode: row.branchCode,
      status: row.status,
      pickedCount: row.pickedCount,
      currentQty: row.currentQty,
      inStoreQty: row.inStoreQty,
      items,
      message: this.buildMessage({
        inventoryName: row.inventoryName,
        status: row.status,
        pickedCount: row.pickedCount,
        currentQty: row.currentQty,
      }),
      createdAt: toIso(row.createdAt) ?? new Date().toISOString(),
      updatedAt: toIso(row.updatedAt) ?? new Date().toISOString(),
      completedAt: toIso(row.closedAt),
      rawEvents: events
        .map((event) => event.rawPayload)
        .filter((event): event is Record<string, unknown> => Boolean(event)),
    };
  }

  async listSessions(limit = 30): Promise<IotSession[]> {
    const rows = await db
      .select({ id: iotSessions.id })
      .from(iotSessions)
      .orderBy(desc(iotSessions.createdAt))
      .limit(limit);

    const sessions = await Promise.all(
      rows.map((row) => this.getSession(row.id)),
    );
    return sessions.filter((session): session is IotSession =>
      Boolean(session),
    );
  }

  async applyPickedCount(input: ApplyPickedCountInput): Promise<IotSession> {
    if (!Number.isInteger(input.pickedCount) || input.pickedCount < 0) {
      throw new Error("pickedCount must be a non-negative integer");
    }

    const session = await this.requireSession(input);
    if (session.status === "closed") return session;

    const now = new Date();
    const nextStatus = input.pickedCount > 0 ? "updated" : "open";

    await db
      .update(iotSessions)
      .set({
        pickedCount: input.pickedCount,
        currentQty: input.currentQty ?? session.currentQty,
        status: nextStatus,
        updatedAt: now,
      })
      .where(eq(iotSessions.id, session.sessionId));

    await this.insertSessionEvent({
      session,
      messageKind: "event",
      eventType: "picked_count",
      seq: input.seq ?? null,
      occurredAt: input.occurredAt,
      rawPayload: input.rawPayload,
    });

    const updatedSession = await this.requireSession({
      sessionId: session.sessionId,
    });
    const cartItem = buildCartItem({
      inventoryId: updatedSession.inventoryId,
      name: updatedSession.inventoryName,
      price: updatedSession.items[0]?.price ?? session.items[0]?.price ?? 0,
      weightPerPiece:
        updatedSession.items[0]?.weightPerPiece ??
        session.items[0]?.weightPerPiece ??
        0,
      unitId: updatedSession.items[0]?.unitId ?? session.items[0]?.unitId ?? "",
      imageUrl:
        updatedSession.items[0]?.imageUrl ?? session.items[0]?.imageUrl ?? null,
      quantity: input.pickedCount,
    });

    await cartSyncService.setCartItemQuantity(
      updatedSession.clientVisitId,
      cartItem,
      input.pickedCount,
      updatedSession.sessionId,
    );
    await publishCartUpdated(updatedSession.userId);
    await publishIotSessionUpdated(updatedSession.sessionId);
    await this.insertNotifications(updatedSession, "picked_count");

    return updatedSession;
  }

  async applyFinalCount(input: ApplyFinalCountInput): Promise<IotSession> {
    return this.applyPickedCount({
      ...input,
      pickedCount: input.finalPickedCount,
    });
  }

  async closeDoor(input: CloseDoorInput): Promise<IotSession> {
    const session = await this.requireSession(input);
    if (session.status !== "closed") {
      await db
        .update(iotSessions)
        .set({
          status: "closed",
          closedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(iotSessions.id, session.sessionId));

      await this.insertSessionEvent({
        session,
        messageKind: "status",
        eventType: "door_closed",
        seq: input.seq ?? null,
        occurredAt: input.occurredAt,
        rawPayload: input.rawPayload,
      });
    }

    const updatedSession = await this.requireSession({
      sessionId: session.sessionId,
    });
    await publishIotSessionUpdated(updatedSession.sessionId);
    await this.insertNotifications(updatedSession, "door_closed");
    return updatedSession;
  }

  async applyError(input: ApplyErrorInput): Promise<IotSession> {
    const session = await this.requireSession(input);
    await db
      .update(iotSessions)
      .set({
        status: "expired",
        closedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(iotSessions.id, session.sessionId));

    await this.insertSessionEvent({
      session,
      messageKind: "event",
      eventType: "error",
      seq: input.seq ?? null,
      rawPayload: input.rawPayload ?? { message: input.message },
    });

    const updatedSession = await this.requireSession({
      sessionId: session.sessionId,
    });
    await publishIotSessionUpdated(updatedSession.sessionId);
    await this.insertNotifications(updatedSession, "error");
    return updatedSession;
  }

  private async requireSession(
    input: ResolveSessionInput,
  ): Promise<IotSession> {
    const sessionId = input.sessionId?.trim();
    if (!sessionId) throw new Error("IOT session id is required");

    const session = await this.getSession(sessionId);
    if (!session) throw new Error("IOT session not found");
    if (input.inventoryId && session.inventoryId !== input.inventoryId) {
      throw new Error("Inventory is not part of this IOT session");
    }
    return session;
  }

  private async insertSessionEvent(input: {
    session: IotSession;
    messageKind: "event" | "status";
    eventType: IotSessionEventType;
    seq: number | null;
    occurredAt?: string | null;
    rawPayload?: Record<string, unknown>;
  }) {
    await db.insert(iotSessionEvents).values({
      sessionId: input.session.sessionId,
      inventoryId: input.session.inventoryId,
      branchCode: input.session.branchCode,
      messageKind: input.messageKind,
      eventType: input.eventType,
      seq: input.seq,
      rawPayload: input.rawPayload,
      occurredAt: input.occurredAt ? new Date(input.occurredAt) : new Date(),
      updatedAt: new Date(),
    });
  }

  private buildMessage(input: {
    inventoryName: string;
    status: IotSessionStatus;
    pickedCount: number;
    currentQty: number | null;
  }) {
    if (input.status === "closed") {
      return `${input.inventoryName}: ประตูตู้ปิดแล้ว จำนวนในตะกร้าคือ ${input.pickedCount} ชิ้น`;
    }
    if (input.status === "expired") {
      return `${input.inventoryName}: IOT session expired`;
    }
    const stockText =
      input.currentQty === null ? "" : ` คงเหลือในตู้ ${input.currentQty} ชิ้น`;
    return input.pickedCount > 0
      ? `${input.inventoryName}: IOT ส่งจำนวนสะสม ${input.pickedCount} ชิ้นเข้าตะกร้าแล้ว${stockText}`
      : `${input.inventoryName}: เปิดตู้แล้ว รอจำนวนสินค้าที่หยิบจาก IOT${stockText}`;
  }

  private async insertNotifications(
    session: IotSession,
    eventType: IotSessionEventType,
  ): Promise<void> {
    const title =
      eventType === "door_closed"
        ? "IOT door closed"
        : eventType === "error"
          ? "IOT error"
          : "IOT picked count";
    const rawPayload = {
      sessionId: session.sessionId,
      inventoryId: session.inventoryId,
      pickedCount: session.pickedCount,
      currentQty: session.currentQty,
      inStoreQty: session.inStoreQty,
      status: session.status,
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
