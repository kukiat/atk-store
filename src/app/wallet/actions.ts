"use server";

import { redirect } from "next/navigation";

import { requireCurrentUser } from "@/lib/auth";
import { bahtToMinorUnit } from "@/lib/money";
import type { WalletFundingChannelCode } from "@/db/schema";
import { walletService } from "@/services/wallet.service";

function readChannel(value: FormDataEntryValue | null): WalletFundingChannelCode {
  if (value === "card" || value === "promptpay") return value;
  throw new Error("Invalid wallet funding channel");
}

export async function createWalletTopupAction(formData: FormData) {
  const user = await requireCurrentUser();
  const amountBaht = Number(formData.get("amountBaht"));
  const channelCode = readChannel(formData.get("channelCode"));
  const amountMinor = bahtToMinorUnit(amountBaht);

  const { url } = await walletService.createTopUpCheckoutSession(
    user,
    amountMinor,
    channelCode,
  );

  redirect(url);
}
