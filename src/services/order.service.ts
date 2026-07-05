import "server-only";

import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { clientVisits, orders } from "@/db/schema";
import { walletService } from "@/services/wallet.service";

class OrderService {
  async createPaidWalletOrderFromCart(clientVisitId: number) {
    return walletService.payOrderFromWallet(clientVisitId);
  }

  async createPaidMockOrderFromCart(clientVisitId: number) {
    return this.createPaidWalletOrderFromCart(clientVisitId);
  }

  async getLatestVisitCheckoutStatusForUser(userId: number) {
    const [visit, wallet] = await Promise.all([
      db
        .select({
          id: clientVisits.id,
          status: clientVisits.status,
          enteredAt: clientVisits.enteredAt,
          exitedAt: clientVisits.exitedAt,
        })
        .from(clientVisits)
        .where(eq(clientVisits.userId, userId))
        .orderBy(desc(clientVisits.createdAt))
        .limit(1)
        .then((rows) => rows[0] ?? null),
      walletService.getWalletSnapshot(userId),
    ]);

    if (!visit) {
      return {
        visit: null,
        order: null,
        walletBalanceAvailableMinor: wallet.balanceAvailableMinor,
      };
    }

    const [order] = await db
      .select({
        id: orders.id,
        status: orders.status,
        paymentStatus: orders.paymentStatus,
        totalPrice: orders.totalPrice,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .where(eq(orders.clientVisitId, visit.id))
      .orderBy(desc(orders.createdAt))
      .limit(1);

    return {
      visit,
      order: order ?? null,
      walletBalanceAvailableMinor: wallet.balanceAvailableMinor,
    };
  }
}

export const orderService = new OrderService();
