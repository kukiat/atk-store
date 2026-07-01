import { redirect } from "next/navigation";

import { QrScanner } from "@/app/scan/qr-scanner";
import { getCurrentUser } from "@/lib/auth";

export default async function ScanPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 pt-6 pb-8">
      <header className="mb-6">
        <p className="text-sm text-muted-foreground">QR scan</p>
        <h1 className="text-balance text-xl font-bold">สแกน shelf QR</h1>
      </header>
      <QrScanner />
    </main>
  );
}
