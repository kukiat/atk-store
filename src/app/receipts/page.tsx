import { CalendarDays, ChevronRight, ReceiptText } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import { formatMinorBaht } from "@/lib/money";
import { getCurrentUser } from "@/lib/auth";
import { receiptService } from "@/services/receipt.service";

function formatIssuedAt(date: Date): string {
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default async function ReceiptsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");

  const receipts = await receiptService.listReceiptsForUser(user.id);

  return (
    <main className="mx-auto grid w-full max-w-2xl flex-1 gap-5 px-4 py-6 sm:px-6">
      <header className="grid gap-2">
        <div className="flex items-center gap-2 text-muted-foreground">
          <ReceiptText className="size-5" />
          <span className="text-sm font-medium">History</span>
        </div>
        <h1 className="text-balance text-2xl font-bold">e-Receipt History</h1>
        <p className="text-muted-foreground text-pretty text-sm">
          รายการใบเสร็จของคุณ เรียงจากรายการล่าสุด
        </p>
      </header>

      {receipts.length === 0 ? (
        <section className="grid justify-items-center gap-3 rounded-lg border border-dashed p-8 text-center">
          <ReceiptText className="size-10 text-muted-foreground" />
          <div>
            <p className="font-medium">ยังไม่มี e-receipt</p>
            <p className="text-muted-foreground mt-1 text-sm">
              เมื่อ checkout สำเร็จ ใบเสร็จจะแสดงที่นี่
            </p>
          </div>
          <Link href="/" className={buttonVariants({ variant: "outline" })}>
            กลับหน้าแรก
          </Link>
        </section>
      ) : (
        <section className="grid gap-3">
          {receipts.map((receipt) => (
            <Link
              key={receipt.id}
              href={`/receipts/${encodeURIComponent(receipt.receiptNo)}`}
              className="grid gap-3 rounded-lg border bg-card p-4 text-card-foreground transition-colors hover:bg-muted/40 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
            >
              <div className="min-w-0">
                <p className="truncate font-semibold">{receipt.receiptNo}</p>
                <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                  <CalendarDays className="size-4" />
                  {formatIssuedAt(receipt.issuedAt)}
                </p>
              </div>
              <div className="flex items-center justify-between gap-3 sm:justify-end">
                <span className="font-semibold tabular-nums">
                  {formatMinorBaht(receipt.totalMinor)}
                </span>
                <ChevronRight className="size-4 text-muted-foreground" />
              </div>
            </Link>
          ))}
        </section>
      )}
    </main>
  );
}
