import { ArrowLeft, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { FaceLivenessRegistration } from "@/components/face-liveness-registration";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";

export default async function RegisterFacePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");

  const alreadyRegistered = user.faceEnrollmentStatus === "registered";

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-8 px-6 py-10">
      <div className="flex items-center gap-2">
        <Button
          render={<Link href="/" />}
          variant="ghost"
          size="sm"
          className="-ml-2"
        >
          <ArrowLeft className="size-4" />
          กลับ
        </Button>
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-bold">ลงทะเบียนใบหน้า</h1>
        <p className="text-muted-foreground text-sm">
          ยืนยันว่าเป็นบุคคลจริงด้วยการสแกนใบหน้า เพื่อความปลอดภัยของบัญชีคุณ
        </p>
      </div>

      {alreadyRegistered ? (
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <CheckCircle2 className="size-12 text-green-600" />
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">คุณลงทะเบียนใบหน้าแล้ว</h2>
            <p className="text-muted-foreground text-sm">
              ไม่จำเป็นต้องลงทะเบียนซ้ำ
            </p>
          </div>
          <div className="w-full pt-2">
            <Button render={<Link href="/" />} size="lg" className="w-full">
              กลับสู่หน้าหลัก
            </Button>
          </div>
        </div>
      ) : (
        <FaceLivenessRegistration />
      )}
    </main>
  );
}
