export const WALLET_CURRENCY = "THB";

export function bahtToMinorUnit(amountBaht: number): number {
  if (!Number.isFinite(amountBaht)) {
    throw new Error("Amount must be a finite number");
  }
  return Math.round(amountBaht * 100);
}

export function assertPositiveMinorUnit(amountMinor: number): void {
  if (!Number.isInteger(amountMinor) || amountMinor <= 0) {
    throw new Error("Amount must be a positive integer minor unit");
  }
}

export function formatMinorBaht(amountMinor: number): string {
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: WALLET_CURRENCY,
  }).format(amountMinor / 100);
}
