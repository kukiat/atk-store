import { QrCode, ScanLine } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { FaceAuthStatusNotice } from "@/components/face-auth-status-notice";
import { FaceEnrollmentPrompt } from "@/components/face-enrollment-prompt";
import { FaceVerificationDebugPrompt } from "@/components/face-verification-debug-prompt";
import { HomeNav } from "@/components/home-nav";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import { getPermissions } from "@/lib/permissions";
import { roleService } from "@/services/role.service";

export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");
  const roleCodes = await roleService.getRoleCodesForUser(user.id);
  const permissions = getPermissions(roleCodes);

  return (
    <main className="relative mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-6 sm:px-6 lg:px-8">
      <HomeNav
        canAccessAdmin={permissions.canAccessAdmin}
        user={{
          name: user.name,
          email: user.email,
          avatarUrl: user.avatarUrl,
        }}
      />

      <section className="grid w-full flex-1 items-center gap-8 pt-24 pb-8 md:grid-cols-[minmax(0,1fr)_minmax(320px,380px)] md:gap-10 md:pt-28 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="flex flex-col items-center gap-6 text-center md:items-start md:text-left">
          <div className="bg-primary text-primary-foreground flex size-20 items-center justify-center rounded-2xl md:size-24">
            <ScanLine className="size-10 md:size-12" />
          </div>

          <div className="max-w-xl space-y-3">
            <h1 className="text-balance text-2xl font-bold sm:text-3xl">
              ATK Store
            </h1>
            <p className="text-muted-foreground text-pretty">
              สแกน QR ที่ชั้นวางสินค้า (smart shelf) ด้วยมือถือ
              เพื่อดูและเลือกสินค้าบนชั้นนั้น แล้วใส่ตะกร้าได้ทันที
            </p>
          </div>

          <div className="bg-muted text-muted-foreground flex w-full max-w-md items-center gap-2 rounded-lg px-4 py-3 text-sm md:max-w-none">
            <QrCode className="size-4 shrink-0" />
            <span className="text-left">ตัวอย่าง: เปิดหน้าชั้นวางเพื่อทดลองใช้งาน</span>
          </div>
        </div>

        <div className="mx-auto grid w-full max-w-md gap-4 md:max-w-none">
          <FaceEnrollmentPrompt />

          <FaceVerificationDebugPrompt />

          <FaceAuthStatusNotice />

          <div className="flex w-full flex-col gap-3 sm:grid sm:grid-cols-2 md:flex md:flex-col">
            <Button render={<Link href="/shelf/A12" />} size="lg">
              ชั้น A12 — ชุดตรวจ ATK
            </Button>
            <Button
              render={<Link href="/shelf/B03" />}
              size="lg"
              variant="outline"
            >
              ชั้น B03 — หน้ากากอนามัย
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
