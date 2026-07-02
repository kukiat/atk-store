import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { QrScanner } from "@/app/scan/qr-scanner";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";

export default async function ScanPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 pt-6 pb-8">
      <header className="mb-6 grid gap-3">
        <Link
          href="/"
          className={buttonVariants({
            variant: "ghost",
            size: "sm",
            className: "w-fit -ml-2",
          })}
        >
          <ArrowLeft className="size-4" />
          กลับ
        </Link>
        <div>
          <p className="text-sm text-muted-foreground">QR scan</p>
          <h1 className="text-balance text-xl font-bold">สแกน shelf QR</h1>
        </div>
      </header>
      <QrScanner />
    </main>
  );
}
