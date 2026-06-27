import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { FaceVerificationDebug } from "@/components/face-verification-debug";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import { getPermissions } from "@/lib/permissions";
import { faceRecognitionService } from "@/services/face-recognition.service";
import { roleService } from "@/services/role.service";

const DEFAULT_TIMEOUT_MS = 5000;

export default async function VerifyFacePage() {
  if (process.env.ENABLE_FACE_RECOGNITION_DEBUG !== "YES") {
    redirect("/");
  }

  const user = await getCurrentUser();
  if (!user) redirect("/signin");

  const roleCodes = await roleService.getRoleCodesForUser(user.id);
  if (!getPermissions(roleCodes).canAccessAdmin) redirect("/");

  const profile = await faceRecognitionService.getProfileByUserId(user.id);
  if (!profile) redirect("/");

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-8 px-6 py-10 sm:max-w-xl">
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
        <h1 className="text-balance text-2xl font-bold">Verify face debug</h1>
        <p className="text-muted-foreground text-pretty text-sm">
          ทดสอบว่า Face Collection
          สามารถจำใบหน้าที่ลงทะเบียนไว้กับบัญชีนี้ได้จริง
          โดยจะเปิดกล้องหลังจากกดปุ่มเริ่มเท่านั้น
        </p>
      </div>

      <FaceVerificationDebug
        timeoutMs={getFaceRecognitionDebugTimeoutMs()}
        user={{
          email: user.email,
          name: user.name,
          avatarUrl: user.avatarUrl,
        }}
      />
    </main>
  );
}

function getFaceRecognitionDebugTimeoutMs(): number {
  const raw = process.env.FACE_RECOGNITION_DEBUG_TIMEOUT_MS;
  if (!raw) return DEFAULT_TIMEOUT_MS;

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_TIMEOUT_MS;

  return Math.max(1000, Math.round(parsed));
}
