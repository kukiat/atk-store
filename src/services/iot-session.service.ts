import "server-only";

import { randomUUID } from "node:crypto";

import { db } from "@/db";
import { notifications, type User } from "@/db/schema";
import { cartSyncService } from "@/services/cart-sync.service";
import type { CartItem } from "@/types";

export type IotShelfStatus = "pending" | "matched" | "short" | "over";
export type IotSessionStatus =
  | "pending"
  | "matched"
  | "short"
  | "over"
  | "expired";

export type IotShelfCheck = {
  shelfId: string;
  sensorId: string | null;
  channelId: string;
  inventoryId: string;
  inventoryName: string;
  expectedCount: number;
  expectedWeight: number;
  pickedCount: number | null;
  status: IotShelfStatus;
};

export type IotSession = {
  sessionId: string;
  clientVisitId: number;
  userId: number;
  customerName: string | null;
  customerEmail: string;
  status: IotSessionStatus;
  items: CartItem[];
  shelves: IotShelfCheck[];
  message: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  rawEvents: Array<Record<string, unknown>>;
};

type CreateIotSessionInput = {
  clientVisitId: number;
  user: User;
  items: CartItem[];
  shelves: Array<{
    shelfId: string;
    sensorId: string | null;
    inventoryId: string;
    inventoryName: string;
    expectedCount: number;
    expectedWeight: number;
  }>;
};

type ApplyPickedCountInput = {
  sessionId?: string | null;
  channelId?: string | null;
  shelfId?: string | null;
  pickedCount: number;
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

function buildChannelId(
  shelfId: string,
  clientVisitId: number,
  sessionId: string,
): string {
  return `shelf:${shelfId}:visit:${clientVisitId}:${sessionId}`;
}

function cloneSession(session: IotSession): IotSession {
  return structuredClone(session);
}

function formatMismatchMessage(shelf: IotShelfCheck): string {
  if (shelf.status === "short") {
    return `${shelf.inventoryName}: หยิบ ${shelf.pickedCount ?? 0} ชิ้น จากที่เลือก ${shelf.expectedCount} ชิ้น`;
  }
  if (shelf.status === "over") {
    return `${shelf.inventoryName}: หยิบเกิน ${shelf.pickedCount ?? 0} ชิ้น จากที่เลือก ${shelf.expectedCount} ชิ้น`;
  }
  return `${shelf.inventoryName}: หยิบครบ ${shelf.expectedCount} ชิ้น`;
}

function resolveSessionStatus(shelves: IotShelfCheck[]): IotSessionStatus {
  if (shelves.some((shelf) => shelf.status === "over")) return "over";
  if (shelves.some((shelf) => shelf.status === "short")) return "short";
  if (shelves.every((shelf) => shelf.status === "matched")) return "matched";
  return "pending";
}

class IotSessionService {
  createSession(input: CreateIotSessionInput): IotSession {
    const sessionId = randomUUID();
    const now = new Date().toISOString();
    const shelves = input.shelves.map((shelf) => ({
      ...shelf,
      channelId: buildChannelId(shelf.shelfId, input.clientVisitId, sessionId),
      pickedCount: null,
      status: "pending" as const,
    }));

    const session: IotSession = {
      sessionId,
      clientVisitId: input.clientVisitId,
      userId: input.user.id,
      customerName: input.user.name,
      customerEmail: input.user.email,
      status: "pending",
      items: input.items,
      shelves,
      message: "รอผลการหยิบสินค้าจาก IOT mock",
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
    const session = this.findSession(input);
    if (!session) {
      throw new Error("IOT session not found");
    }

    const shelfIndex = session.shelves.findIndex((shelf) => {
      if (input.channelId) return shelf.channelId === input.channelId;
      if (input.shelfId) return shelf.shelfId === input.shelfId;
      return false;
    });

    if (shelfIndex < 0) {
      throw new Error("Shelf is not part of this IOT session");
    }

    const shelf = session.shelves[shelfIndex];
    const status =
      input.pickedCount === shelf.expectedCount
        ? "matched"
        : input.pickedCount < shelf.expectedCount
          ? "short"
          : "over";

    const nextShelf: IotShelfCheck = {
      ...shelf,
      pickedCount: input.pickedCount,
      status,
    };
    const shelves = session.shelves.map((item, index) =>
      index === shelfIndex ? nextShelf : item,
    );
    const nextStatus = resolveSessionStatus(shelves);
    const now = new Date().toISOString();

    session.shelves = shelves;
    session.status = nextStatus;
    session.updatedAt = now;
    session.completedAt = nextStatus === "matched" ? now : session.completedAt;
    session.rawEvents.push(input.rawPayload ?? {});
    session.message =
      nextStatus === "matched"
        ? "IOT mock ยืนยันว่าหยิบสินค้าครบตรงตามที่เลือกแล้ว"
        : formatMismatchMessage(nextShelf);

    sessionStore.set(session.sessionId, session);

    if (nextStatus === "matched") {
      await cartSyncService.setCart(
        session.clientVisitId,
        session.items,
        session.sessionId,
      );
    }

    await this.insertNotifications(session, nextShelf);
    return cloneSession(session);
  }

  private findSession(input: ApplyPickedCountInput): IotSession | null {
    if (input.sessionId) return sessionStore.get(input.sessionId) ?? null;
    if (!input.channelId) return null;

    return (
      Array.from(sessionStore.values()).find((session) =>
        session.shelves.some((shelf) => shelf.channelId === input.channelId),
      ) ?? null
    );
  }

  private async insertNotifications(
    session: IotSession,
    shelf: IotShelfCheck,
  ): Promise<void> {
    const severity = session.status === "matched" ? "info" : "warning";
    const title =
      session.status === "matched"
        ? "IOT pick matched"
        : "IOT pick mismatch";
    const rawPayload = {
      sessionId: session.sessionId,
      channelId: shelf.channelId,
      shelfId: shelf.shelfId,
      sensorId: shelf.sensorId,
      expectedCount: shelf.expectedCount,
      pickedCount: shelf.pickedCount,
      status: shelf.status,
      strict: true,
    };

    await db.insert(notifications).values([
      {
        clientVisitId: session.clientVisitId,
        recipientType: "client",
        userId: session.userId,
        title,
        message: session.message,
        severity,
        rawPayload,
      },
      {
        clientVisitId: session.clientVisitId,
        recipientType: "admin",
        title,
        message: `${session.customerName ?? session.customerEmail}: ${session.message}`,
        severity,
        rawPayload,
      },
      {
        clientVisitId: session.clientVisitId,
        recipientType: "super_admin",
        title,
        message: `${session.customerName ?? session.customerEmail}: ${session.message}`,
        severity,
        rawPayload,
      },
    ]);
  }
}

export const iotSessionService = new IotSessionService();
