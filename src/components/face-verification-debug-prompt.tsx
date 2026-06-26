import { ChevronRight, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import { faceRecognitionService } from "@/services/face-recognition.service";

/**
 * Debug-only entry point for proving the face recognition flow end-to-end.
 *
 * This intentionally renders only when:
 * - ENABLE_FACE_RECOGNITION_DEBUG=YES
 * - the current user is signed in
 * - the current user already has a row in user_face_profiles
 *
 * Rendering this component never calls AWS. It only checks local app state and
 * links to the explicit verification page, so no liveness/recognition cost is
 * incurred until the user presses the verify CTA on that page.
 */
export async function FaceVerificationDebugPrompt() {
  if (process.env.ENABLE_FACE_RECOGNITION_DEBUG !== "YES") return null;

  const user = await getCurrentUser();
  if (!user || user.faceEnrollmentStatus !== "registered") return null;

  const profile = await faceRecognitionService.getProfileByUserId(user.id);
  if (!profile) return null;

  return (
    <Button
      render={<Link href="/verify-face" />}
      variant="outline"
      size="lg"
      className="h-auto w-full justify-between gap-3 px-4 py-3 text-left"
      aria-label="ทดสอบยืนยันใบหน้าด้วย Face Recognition"
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-full">
          <ShieldCheck className="size-5" />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-medium">Debug: Verify face</span>
          <span className="text-muted-foreground block truncate text-xs">
            ทดสอบว่า Rekognition จำใบหน้าบัญชีนี้ได้จริง
          </span>
        </span>
      </span>
      <ChevronRight className="text-muted-foreground size-4 shrink-0" />
    </Button>
  );
}
