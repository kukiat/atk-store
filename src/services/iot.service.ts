import "server-only";

import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { clientVisits, notifications, type User } from "@/db/schema";
import { cartSyncService } from "@/services/cart-sync.service";
import type { CartItem, IotTransaction } from "@/types";

export type IotWatchResult = {
  clientVisitId: number;
  transactions: IotTransaction[];
  message: string;
};

function aggregateTransactions(items: CartItem[]): IotTransaction[] {
  return items.map((item) => ({
    shelfId: item.shelfId,
    amount: item.quantity,
    weightPerPiece: item.weightPerPiece,
  }));
}

class IotService {
  async getActiveVisitForUser(userId: number): Promise<number> {
    const [visit] = await db
      .select({ id: clientVisits.id })
      .from(clientVisits)
      .where(
        and(eq(clientVisits.userId, userId), eq(clientVisits.status, "inside")),
      )
      .orderBy(desc(clientVisits.createdAt))
      .limit(1);

    if (visit) return visit.id;

    const [created] = await db
      .insert(clientVisits)
      .values({
        userId,
        status: "inside",
        enteredAt: new Date(),
        updatedAt: new Date(),
      })
      .returning({ id: clientVisits.id });

    if (!created) {
      throw new Error("Unable to create client visit");
    }

    return created.id;
  }

  async watchCart(user: User, items: CartItem[]): Promise<IotWatchResult> {
    if (items.length === 0) {
      throw new Error("Cart is empty");
    }

    const clientVisitId = await this.getActiveVisitForUser(user.id);
    const transactions = aggregateTransactions(items);

    await cartSyncService.setCart(clientVisitId, items);

    await db.insert(notifications).values([
      {
        clientVisitId,
        recipientType: "client",
        userId: user.id,
        title: "IOT mock accepted",
        message: "ระบบ mock เปิดตู้และบันทึก cart แล้ว",
        severity: "info",
        rawPayload: {
          iotServerUrl: process.env.IOT_SERVER_URL ?? null,
          transactions,
          mock: true,
        },
      },
      {
        clientVisitId,
        recipientType: "admin",
        title: "IOT watch started",
        message: `${user.name ?? user.email} submitted ${items.length} cart lines.`,
        severity: "info",
        rawPayload: { transactions, mock: true },
      },
      {
        clientVisitId,
        recipientType: "super_admin",
        title: "IOT watch started",
        message: `${user.name ?? user.email} submitted ${items.length} cart lines.`,
        severity: "info",
        rawPayload: { transactions, mock: true },
      },
    ]);

    return {
      clientVisitId,
      transactions,
      message: "IOT mock accepted and cart synced.",
    };
  }
}

export const iotService = new IotService();
