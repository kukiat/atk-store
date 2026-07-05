import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ReceiptDocument } from "@/components/receipt-document";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import { receiptService } from "@/services/receipt.service";
import { ReceiptActions } from "./receipt-actions";

const RECEIPT_CAPTURE_ID = "receipt-capture";

export default async function ReceiptDetailPage({
  params,
}: {
  params: Promise<{ receiptNo: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");

  const { receiptNo } = await params;
  const receipt = await receiptService.getReceiptForUser(
    decodeURIComponent(receiptNo),
    user.id,
  );

  if (!receipt) notFound();

  return (
    <main className="mx-auto grid w-full max-w-3xl flex-1 gap-4 px-4 py-6 pb-28 sm:px-6">
      <header className="flex items-center justify-between gap-3">
        <Link
          href="/receipts"
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          <ArrowLeft className="size-4" />
          History
        </Link>
      </header>

      <ReceiptDocument receipt={receipt} captureId={RECEIPT_CAPTURE_ID} />
      <ReceiptActions
        targetId={RECEIPT_CAPTURE_ID}
        receiptNo={receipt.receiptNo}
      />
    </main>
  );
}
