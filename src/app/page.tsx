import { LogOut, QrCode, ScanLine } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";

export default async function HomePage() {
  const user = await getCurrentUser();

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-8 px-6 py-16 text-center">
      {user && (
        <div className="absolute inset-x-0 top-0 mx-auto flex w-full max-w-md items-center justify-between gap-2 px-4 py-3">
          <span className="text-muted-foreground truncate text-sm">
            สวัสดี, <span className="text-foreground font-medium">{user.name ?? user.email}</span>
          </span>
          <Button
            render={<Link href="/api/auth/signout" />}
            variant="ghost"
            size="sm"
            className="shrink-0"
          >
            <LogOut className="size-4" />
            ออกจากระบบ
          </Button>
        </div>
      )}

      <div className="bg-primary text-primary-foreground flex size-20 items-center justify-center rounded-2xl">
        <ScanLine className="size-10" />
      </div>

      <div className="space-y-3">
        <h1 className="text-2xl font-bold">ATK Store</h1>
        <p className="text-muted-foreground">
          สแกน QR ที่ชั้นวางสินค้า (smart shelf) ด้วยมือถือ
          เพื่อดูและเลือกสินค้าบนชั้นนั้น แล้วใส่ตะกร้าได้ทันที
        </p>
      </div>

      <div className="bg-muted text-muted-foreground flex items-center gap-2 rounded-lg px-4 py-3 text-sm">
        <QrCode className="size-4 shrink-0" />
        <span>ตัวอย่าง: เปิดหน้าชั้นวางเพื่อทดลองใช้งาน</span>
      </div>

      <div className="flex w-full flex-col gap-3">
        <Button render={<Link href="/shelf/A12" />} size="lg">
          ชั้น A12 — ชุดตรวจ ATK
        </Button>
        <Button render={<Link href="/shelf/B03" />} size="lg" variant="outline">
          ชั้น B03 — หน้ากากอนามัย
        </Button>
      </div>
    </main>
  );
}
