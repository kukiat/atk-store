import { formatMinorBaht } from "@/lib/money";

type ReceiptDocumentItem = {
  id: string;
  name: string;
  unitName: string;
  quantity: number;
  unitPriceMinor: number;
  lineSubtotalMinor: number;
  vatMinor: number;
  lineTotalMinor: number;
};

type ReceiptDocumentData = {
  receiptNo: string;
  status: string;
  issuedAt: Date;
  customerName: string | null;
  customerEmail: string;
  storeName: string;
  storeLegalName: string | null;
  storeTaxId: string | null;
  storeAddress: string | null;
  storePhone: string | null;
  storeEmail: string | null;
  subtotalMinor: number;
  vatPercent: number;
  vatMinor: number;
  discountMinor: number;
  totalMinor: number;
  currency: string;
  paymentMethod: string;
  paymentReference: string | null;
  walletBalanceAfterMinor: number | null;
  items: ReceiptDocumentItem[];
};

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function ReceiptDocument({
  receipt,
  captureId,
}: {
  receipt: ReceiptDocumentData;
  captureId?: string;
}) {
  return (
    <article
      id={captureId}
      className="overflow-hidden rounded-lg border bg-card text-card-foreground shadow-sm"
    >
      <header className="grid gap-5 border-b p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-balance text-2xl font-bold">
              {receipt.storeName}
            </h1>
            {receipt.storeLegalName ? (
              <p className="text-muted-foreground text-sm text-pretty">
                {receipt.storeLegalName}
              </p>
            ) : null}
            {receipt.storeAddress ? (
              <p className="text-muted-foreground mt-2 text-sm text-pretty">
                {receipt.storeAddress}
              </p>
            ) : null}
            <div className="text-muted-foreground mt-2 grid gap-1 text-sm">
              {receipt.storeTaxId ? <p>Tax ID {receipt.storeTaxId}</p> : null}
              {receipt.storePhone ? <p>Tel {receipt.storePhone}</p> : null}
              {receipt.storeEmail ? <p>{receipt.storeEmail}</p> : null}
            </div>
          </div>

          <div className="grid gap-1 text-left sm:text-right">
            <span className="inline-flex w-fit items-center rounded-full border border-emerald-500/40 px-2.5 py-1 text-xs font-semibold text-emerald-700 sm:ml-auto dark:text-emerald-300">
              {receipt.status.toUpperCase()}
            </span>
            <p className="font-mono text-sm font-semibold">
              {receipt.receiptNo}
            </p>
            <p className="text-muted-foreground text-sm">
              {formatDate(receipt.issuedAt)}
            </p>
          </div>
        </div>

        <div className="grid gap-3 rounded-lg bg-muted/40 p-3 text-sm sm:grid-cols-2">
          <div>
            <p className="text-muted-foreground font-medium">Customer</p>
            <p className="font-semibold">
              {receipt.customerName ?? receipt.customerEmail}
            </p>
            <p className="text-muted-foreground">{receipt.customerEmail}</p>
          </div>
          <div>
            <p className="text-muted-foreground font-medium">Payment</p>
            <p className="font-semibold capitalize">{receipt.paymentMethod}</p>
            {receipt.paymentReference ? (
              <p className="text-muted-foreground truncate font-mono text-xs">
                {receipt.paymentReference}
              </p>
            ) : null}
          </div>
        </div>
      </header>

      <section className="p-5 sm:p-6">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="py-2 pr-3 text-left font-semibold">Item</th>
                <th className="px-3 py-2 text-right font-semibold">Qty</th>
                <th className="px-3 py-2 text-right font-semibold">Price</th>
                <th className="py-2 pl-3 text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {receipt.items.map((item) => (
                <tr key={item.id} className="border-b last:border-b-0">
                  <td className="py-3 pr-3">
                    <p className="font-medium">{item.name}</p>
                    <p className="text-muted-foreground text-xs">
                      {item.unitName}
                    </p>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {item.quantity}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {formatMinorBaht(item.unitPriceMinor)}
                  </td>
                  <td className="py-3 pl-3 text-right font-semibold tabular-nums">
                    {formatMinorBaht(item.lineTotalMinor)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="ml-auto mt-5 grid w-full max-w-sm gap-2 text-sm">
          <SummaryRow label="Subtotal" value={receipt.subtotalMinor} />
          <SummaryRow
            label={`VAT ${receipt.vatPercent.toLocaleString("th-TH")}%`}
            value={receipt.vatMinor}
          />
          {receipt.discountMinor > 0 ? (
            <SummaryRow label="Discount" value={-receipt.discountMinor} />
          ) : null}
          <div className="mt-2 flex items-center justify-between border-t pt-3 text-lg font-bold">
            <span>Total</span>
            <span className="tabular-nums">
              {formatMinorBaht(receipt.totalMinor)}
            </span>
          </div>
          {receipt.walletBalanceAfterMinor !== null ? (
            <div className="text-muted-foreground flex items-center justify-between text-xs">
              <span>Wallet balance after</span>
              <span className="tabular-nums">
                {formatMinorBaht(receipt.walletBalanceAfterMinor)}
              </span>
            </div>
          ) : null}
        </div>
      </section>

      <footer className="border-t border-dashed p-5 text-center text-sm text-muted-foreground sm:p-6">
        ขอบคุณที่ใช้บริการ · {receipt.currency}
      </footer>
    </article>
  );
}

function SummaryRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{formatMinorBaht(value)}</span>
    </div>
  );
}
