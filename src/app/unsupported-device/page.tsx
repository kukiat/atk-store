import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

export default function UnsupportedDevicePage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12 text-center">
      <h1 className="text-balance text-2xl font-bold">
        ใช้งานได้เฉพาะ mobile/tablet
      </h1>
      <p className="mt-3 text-pretty text-sm text-muted-foreground">
        QR scan, inventory selection และ cart ถูกจำกัดให้ใช้งานบนอุปกรณ์ mobile
        หรือ tablet เท่านั้น
      </p>
      <Link href="/" className={buttonVariants({ className: "mt-6" })}>
        กลับหน้าหลัก
      </Link>
    </main>
  );
}
