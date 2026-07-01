import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { clientVisits, orderItems, orders } from "@/db/schema";
import { cartSyncService } from "@/services/cart-sync.service";

class OrderService {
  async createPaidMockOrderFromCart(clientVisitId: number) {
    const cart = await cartSyncService.getCart(clientVisitId);
    if (!cart || cart.items.length === 0) {
      throw new Error("No synced cart found for this client visit");
    }

    const totalPrice = cart.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );

    const [order] = await db
      .insert(orders)
      .values({
        clientVisitId,
        status: "paid",
        paymentStatus: "paid",
        totalPrice,
        paymentReference: "mock-paid",
        updatedAt: new Date(),
      })
      .returning();

    if (!order) throw new Error("Failed to create order");

    await db.insert(orderItems).values(
      cart.items.map((item) => ({
        orderId: order.id,
        inventoryId: item.inventoryId,
        name: item.name,
        price: item.price,
        amount: item.quantity,
        weightPerPiece: item.weightPerPiece,
        unitId: item.unitId,
        imageUrl: item.imageUrl,
        updatedAt: new Date(),
      })),
    );

    await db
      .update(clientVisits)
      .set({
        status: "exited",
        exitedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(clientVisits.id, clientVisitId));

    await cartSyncService.clearCart(clientVisitId);

    return order;
  }
}

export const orderService = new OrderService();
