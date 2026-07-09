import { QrCode, ScanLine, ShoppingCart, WalletCards } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { CheckoutPaidNotice } from "@/components/checkout-paid-notice";
import { FaceAuthStatusNotice } from "@/components/face-auth-status-notice";
import { FaceEnrollmentPrompt } from "@/components/face-enrollment-prompt";
import { FaceVerificationDebugPrompt } from "@/components/face-verification-debug-prompt";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  storeAccessService,
  type StoreScanEligibility,
} from "@/services/store-access.service";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{
    checkout?: string | string[];
    receipt?: string | string[];
  }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");
  const resolvedSearchParams = await searchParams;
  const checkoutParam = resolvedSearchParams.checkout;
  const checkout = Array.isArray(checkoutParam)
    ? checkoutParam[0]
    : checkoutParam;
  const receiptParam = resolvedSearchParams.receipt;
  const receiptNo = Array.isArray(receiptParam)
    ? receiptParam[0]
    : receiptParam;
  const scanEligibility = await storeAccessService.getScanEligibility(user.id);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-6 sm:px-6 lg:px-8">
      <section className="grid w-full flex-1 items-center gap-8 py-8 md:grid-cols-[minmax(0,1fr)_minmax(320px,380px)] md:gap-10 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="flex flex-col items-center gap-6 text-center md:items-start md:text-left">
          <div className="bg-primary text-primary-foreground flex size-20 items-center justify-center rounded-2xl md:size-24">
            <ScanLine className="size-10 md:size-12" />
          </div>

          <div className="max-w-xl space-y-3">
            <h1 className="text-balance text-2xl font-bold sm:text-3xl">
              ATK Store
            </h1>
            <p className="text-muted-foreground text-pretty">
              สแกน QR ของสินค้าด้วยมือถือ
              เพื่อเปิดตู้ แล้วระบบจะใส่สินค้าลงตะกร้าตามจำนวนที่หยิบจริง
            </p>
          </div>

          <div className="bg-muted text-muted-foreground flex w-full max-w-md items-center gap-2 rounded-lg px-4 py-3 text-sm md:max-w-none">
            <QrCode className="size-4 shrink-0" />
            <span className="text-left">
              สแกน QR แบบเดี่ยวหรือ grouped QR เพื่อเลือกสินค้าที่ต้องการหยิบ
            </span>
          </div>
        </div>

        <div className="mx-auto grid w-full max-w-md gap-4 md:max-w-none">
          {checkout === "paid" ? (
            <CheckoutPaidNotice receiptNo={receiptNo ?? null} />
          ) : null}

          <FaceEnrollmentPrompt />

          <FaceVerificationDebugPrompt />

          <FaceAuthStatusNotice />

          <ScanEligibilityNotice eligibility={scanEligibility} />

          <div className="flex w-full flex-col gap-3 sm:grid sm:grid-cols-2 md:flex md:flex-col">
            {scanEligibility.canScan ? (
              <Link href="/scan" className={buttonVariants({ size: "lg" })}>
                <QrCode className="size-4" />
                สแกน QR
              </Link>
            ) : (
              <span
                aria-disabled="true"
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "pointer-events-none opacity-50",
                )}
              >
                <QrCode className="size-4" />
                สแกน QR
              </span>
            )}
            <Link
              href="/cart"
              className={buttonVariants({ size: "lg", variant: "outline" })}
            >
              <ShoppingCart className="size-4" />
              เปิดตะกร้า
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

function ScanEligibilityNotice({
  eligibility,
}: {
  eligibility: StoreScanEligibility;
}) {
  if (eligibility.canScan) return null;

  if (eligibility.reason === "insufficient_balance") {
    return (
      <div className="grid gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-200">
        <div className="flex items-start gap-3">
          <WalletCards className="mt-0.5 size-5 shrink-0" />
          <div>
            <p className="font-semibold">กรุณาเติม wallet ก่อนสแกน QR</p>
            <p className="mt-1 text-pretty">
              ยอดคงเหลือ{" "}
              {formatPrice(eligibility.walletBalanceAvailableMinor ?? 0)}{" "}
              ต่ำกว่าสินค้าราคาต่ำสุด{" "}
              {formatPrice(eligibility.minimumInventoryPriceMinor ?? 0)}
            </p>
          </div>
        </div>
        <Link
          href="/wallet"
          className={cn(buttonVariants({ variant: "outline" }), "w-full")}
        >
          <WalletCards className="size-4" />
          เติม wallet
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
      <QrCode className="mt-0.5 size-5 shrink-0" />
      <div>
        <p className="font-semibold text-foreground">ยังไม่สามารถสแกน QR ได้</p>
        <p className="mt-1 text-pretty">{eligibility.message}</p>
      </div>
    </div>
  );
}
