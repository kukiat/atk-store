import "server-only";

import { and, eq, gt, isNull, sql } from "drizzle-orm";

import { db } from "@/db";
import { inventories } from "@/db/schema";
import { bahtToMinorUnit } from "@/lib/money";
import { clientVisitService } from "@/services/client-visit.service";
import { walletService } from "@/services/wallet.service";

type ScanBlockedReason =
  | "no_active_visit"
  | "wallet_unavailable"
  | "wallet_inactive"
  | "no_available_inventory"
  | "insufficient_balance";

export type StoreScanEligibility =
  | {
      canScan: true;
      activeVisitId: number;
      walletBalanceAvailableMinor: number;
      minimumInventoryPriceMinor: number;
      minimumInventoryPriceBaht: number;
    }
  | {
      canScan: false;
      reason: ScanBlockedReason;
      message: string;
      walletBalanceAvailableMinor?: number;
      minimumInventoryPriceMinor?: number;
      minimumInventoryPriceBaht?: number;
    };

export class StoreScanNotAllowedError extends Error {
  constructor(
    public readonly eligibility: Extract<
      StoreScanEligibility,
      { canScan: false }
    >,
  ) {
    super(eligibility.message);
    this.name = "StoreScanNotAllowedError";
  }
}

async function getMinimumInventoryPriceBaht(): Promise<number | null> {
  const [row] = await db
    .select({
      minimumPrice: sql<number | null>`min(${inventories.price})`,
    })
    .from(inventories)
    .where(
      and(
        eq(inventories.isActive, true),
        isNull(inventories.deletedAt),
        gt(inventories.amount, 0),
      ),
    );

  return row?.minimumPrice ?? null;
}

class StoreAccessService {
  async getScanEligibility(userId: number): Promise<StoreScanEligibility> {
    const activeVisit = await clientVisitService.getActiveVisitForUser(userId);
    if (!activeVisit) {
      return {
        canScan: false,
        reason: "no_active_visit",
        message: "กรุณาเดินผ่านกล้องทางเข้าก่อนสแกน QR",
      };
    }

    let wallet: Awaited<ReturnType<typeof walletService.getWalletSnapshot>>;
    try {
      wallet = await walletService.getWalletSnapshot(userId);
    } catch {
      return {
        canScan: false,
        reason: "wallet_unavailable",
        message: "ระบบไม่สามารถดึง wallet ของท่านได้ กรุณาติดต่อพนักงาน",
      };
    }

    if (wallet.status !== "active") {
      return {
        canScan: false,
        reason: "wallet_inactive",
        message: "Wallet ของท่านยังไม่พร้อมใช้งาน กรุณาติดต่อพนักงาน",
        walletBalanceAvailableMinor: wallet.balanceAvailableMinor,
      };
    }

    const minimumInventoryPriceBaht = await getMinimumInventoryPriceBaht();
    if (minimumInventoryPriceBaht === null) {
      return {
        canScan: false,
        reason: "no_available_inventory",
        message: "ยังไม่มีสินค้าพร้อมขายในร้าน",
        walletBalanceAvailableMinor: wallet.balanceAvailableMinor,
      };
    }

    const minimumInventoryPriceMinor = bahtToMinorUnit(
      minimumInventoryPriceBaht,
    );
    if (wallet.balanceAvailableMinor < minimumInventoryPriceMinor) {
      return {
        canScan: false,
        reason: "insufficient_balance",
        message:
          "ยอดเงินใน wallet ไม่พอสำหรับสินค้าราคาต่ำสุด กรุณาเติมเงินก่อน",
        walletBalanceAvailableMinor: wallet.balanceAvailableMinor,
        minimumInventoryPriceMinor,
        minimumInventoryPriceBaht,
      };
    }

    return {
      canScan: true,
      activeVisitId: activeVisit.id,
      walletBalanceAvailableMinor: wallet.balanceAvailableMinor,
      minimumInventoryPriceMinor,
      minimumInventoryPriceBaht,
    };
  }

  async requireScanEligibility(
    userId: number,
  ): Promise<Extract<StoreScanEligibility, { canScan: true }>> {
    const eligibility = await this.getScanEligibility(userId);
    if (!eligibility.canScan) {
      throw new StoreScanNotAllowedError(eligibility);
    }
    return eligibility;
  }
}

export const storeAccessService = new StoreAccessService();
