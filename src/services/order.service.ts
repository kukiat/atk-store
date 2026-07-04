import "server-only";

import { walletService } from "@/services/wallet.service";

class OrderService {
  async createPaidWalletOrderFromCart(clientVisitId: number) {
    return walletService.payOrderFromWallet(clientVisitId);
  }

  async createPaidMockOrderFromCart(clientVisitId: number) {
    return this.createPaidWalletOrderFromCart(clientVisitId);
  }
}

export const orderService = new OrderService();
