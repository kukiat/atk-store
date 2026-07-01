/** Format an integer amount of satang as Thai Baht, e.g. 3500 -> "฿35.00". */
export function formatPrice(cents: number): string {
  return formatBaht(cents / 100);
}

/** Format a baht amount from inventory.price. */
export function formatBaht(amount: number): string {
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
  }).format(amount);
}
