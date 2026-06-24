import { AlertCircle, ScanLine, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

// Where the Google OAuth flow begins. After Google authenticates the user it
// redirects back to the configured callback: /api/auth/callback/google
const GOOGLE_SIGN_IN_URL = "/api/auth/signin/google";

const ERROR_MESSAGES: Record<string, string> = {
  no_code: "ไม่ได้รับรหัสยืนยันจาก Google กรุณาลองใหม่อีกครั้ง",
  no_email: "ไม่พบอีเมลในบัญชี Google ของคุณ",
  token_exchange_failed: "แลกเปลี่ยนข้อมูลกับ Google ไม่สำเร็จ กรุณาลองใหม่",
  userinfo_failed: "ดึงข้อมูลผู้ใช้จาก Google ไม่สำเร็จ กรุณาลองใหม่",
  access_denied: "คุณยกเลิกการเข้าสู่ระบบด้วย Google",
};

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z"
      />
    </svg>
  );
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const errorMessage = error
    ? (ERROR_MESSAGES[error] ?? "เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง")
    : null;

  return (
    <main className="relative flex min-h-dvh flex-1 items-center justify-center overflow-hidden px-6 py-16">
      {/* soft decorative background */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
      >
        <div className="bg-foreground/5 absolute -top-24 left-1/2 size-72 -translate-x-1/2 rounded-full blur-3xl" />
        <div className="bg-foreground/5 absolute -bottom-32 -left-16 size-80 rounded-full blur-3xl" />
        <div className="bg-foreground/5 absolute -right-20 bottom-10 size-64 rounded-full blur-3xl" />
      </div>

      <div className="bg-card w-full max-w-sm rounded-3xl border p-8 shadow-sm">
        <div className="flex flex-col items-center text-center">
          <div className="bg-primary text-primary-foreground flex size-16 items-center justify-center rounded-2xl shadow-sm">
            <ScanLine className="size-8" />
          </div>

          <h1 className="mt-6 text-2xl font-bold">เข้าสู่ระบบ</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            ยินดีต้อนรับสู่ <span className="text-foreground font-medium">ATK Store</span>
            <br />
            เข้าสู่ระบบด้วยบัญชี Google เพื่อเริ่มต้นใช้งาน
          </p>
        </div>

        {errorMessage && (
          <div className="text-destructive bg-destructive/10 mt-6 flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <Button
          render={<Link href={GOOGLE_SIGN_IN_URL} />}
          variant="outline"
          size="lg"
          className="mt-8 h-11 w-full gap-3 text-sm font-medium"
        >
          <GoogleIcon className="size-5" />
          เข้าสู่ระบบด้วย Google
        </Button>

        <div className="text-muted-foreground mt-6 flex items-center justify-center gap-1.5 text-xs">
          <ShieldCheck className="size-3.5" />
          <span>การเข้าสู่ระบบปลอดภัยด้วย Google OAuth</span>
        </div>
      </div>
    </main>
  );
}
