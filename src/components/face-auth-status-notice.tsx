"use client";

import { ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

type Status = "checking" | "ready" | "reauth" | "signed_out" | "unknown";

/**
 * Client-side face-auth preflight. The Google ID token cookie is intentionally
 * path-scoped to `/api/face`, so the Home Server Component cannot read it.
 * This component performs one cheap same-origin API check and never calls AWS.
 */
export function FaceAuthStatusNotice() {
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const res = await fetch("/api/face/auth-status", {
          cache: "no-store",
        });
        if (cancelled) return;

        if (res.ok) {
          setStatus("ready");
          return;
        }

        if (res.status === 401) {
          setStatus("signed_out");
          return;
        }

        if (res.status === 409) {
          setStatus("reauth");
          return;
        }

        setStatus("unknown");
      } catch {
        if (!cancelled) setStatus("unknown");
      }
    }

    void check();

    return () => {
      cancelled = true;
    };
  }, []);

  if (status === "checking" || status === "ready") return null;

  if (status === "signed_out") {
    return null;
  }

  return (
    <div className="border-amber-200 bg-amber-50 text-amber-900 flex w-full items-start gap-3 rounded-lg border px-4 py-3 text-left text-sm">
      <ShieldAlert className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="space-y-1">
          <p className="font-medium">
            ต้องเข้าสู่ระบบ Google อีกครั้งก่อนใช้กล้อง
          </p>
          <p className="text-amber-800">
            เพื่อความปลอดภัย ระบบต้องยืนยันบัญชีของคุณใหม่ก่อนเริ่มสแกนใบหน้า
          </p>
        </div>
        <Button
          render={<Link href="/api/auth/signin/google" />}
          size="sm"
          variant="outline"
          className="border-amber-300 bg-white text-amber-950 hover:bg-amber-100"
        >
          Sign in Google อีกครั้ง
        </Button>
      </div>
    </div>
  );
}
