import { ChevronRight, ScanFace } from "lucide-react";
import Link from "next/link";

import { getCurrentUser } from "@/lib/auth";

/**
 * Quiet, non-blocking post-login nudge to register a face. Renders nothing for
 * signed-out or already-registered users, and never touches any AWS API — it
 * only links to the dedicated registration page. `getCurrentUser` is request-
 * memoized, so rendering this alongside a page that also reads the user is free.
 */
export async function FaceEnrollmentPrompt() {
  const user = await getCurrentUser();
  if (!user || user.faceEnrollmentStatus === "registered") return null;

  const inProgress = user.faceEnrollmentStatus === "pending";

  return (
    <Link
      href="/register-face"
      className="border-border bg-card hover:bg-accent focus-visible:ring-ring flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors focus-visible:ring-2 focus-visible:outline-none"
      aria-label="ลงทะเบียนใบหน้าเพื่อยืนยันตัวตน"
    >
      <span className="bg-primary text-primary-foreground flex size-9 shrink-0 items-center justify-center rounded-full">
        <ScanFace className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">
          {inProgress ? "ลงทะเบียนใบหน้าให้เสร็จ" : "ลงทะเบียนใบหน้า"}
        </span>
        <span className="text-muted-foreground block truncate text-xs">
          ยืนยันตัวตนด้วยใบหน้าเพื่อความปลอดภัยของบัญชี
        </span>
      </span>
      <ChevronRight className="text-muted-foreground size-4 shrink-0" />
    </Link>
  );
}
