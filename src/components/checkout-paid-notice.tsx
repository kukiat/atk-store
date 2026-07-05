"use client";

import { CheckCircle2, ReceiptText } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function CheckoutPaidNotice({
  receiptNo,
}: {
  receiptNo: string | null;
}) {
  const router = useRouter();
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setVisible(false);
      router.replace("/");
    }, 5000);

    return () => window.clearTimeout(timer);
  }, [router]);

  if (!visible) return null;

  return (
    <div className="grid gap-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-700 dark:text-emerald-300">
      <div className="flex items-start gap-3">
        <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
        <div>
          <p className="font-semibold">ชำระเงินสำเร็จ</p>
          <p className="mt-1 text-pretty">ขอบคุณที่ใช้บริการ</p>
        </div>
      </div>

      {receiptNo ? (
        <Link
          href={`/receipts/${encodeURIComponent(receiptNo)}`}
          className={cn(
            buttonVariants({ size: "sm", variant: "outline" }),
            "w-full border-emerald-500/50 bg-background/80 text-emerald-700 hover:bg-background dark:text-emerald-300",
          )}
        >
          <ReceiptText className="size-4" />
          ดู e-receipt ของคุณเลย
        </Link>
      ) : null}
    </div>
  );
}
