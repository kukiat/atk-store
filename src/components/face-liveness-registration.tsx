"use client";

import "@aws-amplify/ui-react/styles.css";

import {
  type AwsCredentialProvider,
  FaceLivenessDetectorCore,
} from "@aws-amplify/ui-react-liveness";
import { CheckCircle2, Loader2, ShieldAlert, XCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  stopFaceCameraStreams,
  useFaceCameraCleanup,
} from "@/lib/face-camera-cleanup";
import { useSuppressReadableStreamCancelError } from "@/lib/use-suppress-readable-stream-cancel-error";
import { cn } from "@/lib/utils";

const REGION = process.env.NEXT_PUBLIC_AWS_LIVENESS_REGION ?? "";

type Phase =
  | "intro"
  | "starting"
  | "detecting"
  | "checking"
  | "accepted"
  | "rejected"
  | "reauth"
  | "error";

/**
 * Client-only face registration. It creates exactly one liveness session when
 * the user presses start (never on mount), streams via the Amplify detector
 * using short-lived credentials from our bridge, and reads the backend decision
 * once after the detector's completion callback (with at most one retry).
 *
 * `debugMode` is injected by the server page from `ENABLE_FACENESS_DEBUG` env.
 * When true, a confidence badge (score + color tier) is shown after each
 * attempt. Set `ENABLE_FACENESS_DEBUG=NO` in production to hide it.
 */
export function FaceLivenessRegistration({
  debugMode = false,
}: {
  debugMode?: boolean;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("intro");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  // Guards against duplicate session creation from rapid taps / re-renders.
  const startingRef = useRef(false);

  useSuppressReadableStreamCancelError(Boolean(sessionId));
  useFaceCameraCleanup(Boolean(sessionId));

  const credentialProvider = useCallback<AwsCredentialProvider>(async () => {
    const res = await fetch("/api/face/credentials", { cache: "no-store" });
    if (!res.ok) {
      if (res.status === 409) setPhase("reauth");
      throw new Error(`credentials_${res.status}`);
    }
    const data = (await res.json()) as {
      accessKeyId: string;
      secretAccessKey: string;
      sessionToken: string;
      expiration?: string;
    };
    return {
      accessKeyId: data.accessKeyId,
      secretAccessKey: data.secretAccessKey,
      sessionToken: data.sessionToken,
      expiration: data.expiration ? new Date(data.expiration) : undefined,
    };
  }, []);

  const start = useCallback(async () => {
    if (startingRef.current) return;
    startingRef.current = true;
    setPhase("starting");
    try {
      const authStatus = await fetch("/api/face/auth-status", {
        cache: "no-store",
      });
      if (authStatus.status === 401 || authStatus.status === 409) {
        setPhase("reauth");
        return;
      }
      if (!authStatus.ok) {
        setPhase("error");
        return;
      }

      const res = await fetch("/api/face/session", { method: "POST" });
      if (res.status === 409) {
        // Already registered elsewhere — reflect server truth.
        setPhase("accepted");
        return;
      }
      if (!res.ok) {
        setPhase("error");
        return;
      }
      const { sessionId: id } = (await res.json()) as { sessionId: string };
      setRejectionReason(null);
      setSessionId(id);
      setPhase("detecting");
    } catch {
      setPhase("error");
    } finally {
      startingRef.current = false;
    }
  }, []);

  const readResult = useCallback(
    async (id: string): Promise<void> => {
      // Never poll: read once, and allow at most one bounded delayed retry when
      // the backend reports the result is not ready yet.
      for (let attempt = 0; attempt < 2; attempt++) {
        if (attempt > 0) await new Promise((r) => setTimeout(r, 1500));

        const res = await fetch("/api/face/result", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: id }),
        });
        if (!res.ok) {
          stopFaceCameraStreams();
          setSessionId(null);
          setPhase("error");
          return;
        }
        const data = (await res.json()) as {
          outcome: "accepted" | "rejected" | "pending";
          confidence?: number;
          reason?: string;
        };

        if (data.outcome === "pending") continue;

        setConfidence(data.confidence ?? null);
        setRejectionReason(data.reason ?? null);
        stopFaceCameraStreams();
        setSessionId(null);
        setPhase(data.outcome === "accepted" ? "accepted" : "rejected");
        if (data.outcome === "accepted") router.refresh();
        return;
      }

      // Still pending after the single retry.
      stopFaceCameraStreams();
      setSessionId(null);
      setPhase("error");
    },
    [router],
  );

  const handleAnalysisComplete = useCallback(async () => {
    if (!sessionId) return;
    setPhase("checking");
    stopFaceCameraStreams();
    await readResult(sessionId);
  }, [sessionId, readResult]);

  if (phase === "accepted") {
    return (
      <Result
        icon={<CheckCircle2 className="size-12 text-green-600" />}
        title="ลงทะเบียนใบหน้าสำเร็จ"
        description="ระบบยืนยันตัวตนของคุณแล้ว"
        debug={debugMode ? <ConfidenceBadge confidence={confidence} /> : null}
        action={
          <Button render={<Link href="/" />} size="lg" className="w-full">
            กลับสู่หน้าหลัก
          </Button>
        }
      />
    );
  }

  if (phase === "rejected") {
    return (
      <Result
        icon={<XCircle className="size-12 text-destructive" />}
        title={getRejectedTitle(rejectionReason)}
        description={getRejectedDescription(rejectionReason)}
        debug={debugMode ? <ConfidenceBadge confidence={confidence} /> : null}
        action={
          <Button
            onClick={() => resetTo(setPhase, setSessionId)}
            size="lg"
            className="w-full"
          >
            ลองใหม่อีกครั้ง
          </Button>
        }
      />
    );
  }

  if (phase === "reauth") {
    return (
      <Result
        icon={<ShieldAlert className="text-amber-500 size-12" />}
        title="เซสชันหมดอายุ"
        description="กรุณาเข้าสู่ระบบอีกครั้งเพื่อลงทะเบียนใบหน้า"
        action={
          <Button
            render={<Link href="/api/auth/signin/google" />}
            size="lg"
            className="w-full"
          >
            เข้าสู่ระบบอีกครั้ง
          </Button>
        }
      />
    );
  }

  if (phase === "error") {
    return (
      <Result
        icon={<XCircle className="text-destructive size-12" />}
        title="เกิดข้อผิดพลาด"
        description="ไม่สามารถดำเนินการได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง"
        action={
          <Button
            onClick={() => resetTo(setPhase, setSessionId)}
            size="lg"
            className="w-full"
          >
            ลองใหม่อีกครั้ง
          </Button>
        }
      />
    );
  }

  if (phase === "detecting" && sessionId) {
    if (!REGION) {
      return (
        <Result
          icon={<XCircle className="text-destructive size-12" />}
          title="ตั้งค่าไม่ครบ"
          description="ไม่พบค่า region สำหรับ Face Liveness"
        />
      );
    }
    return (
      <div className="w-full overflow-hidden rounded-2xl">
        <FaceLivenessDetectorCore
          sessionId={sessionId}
          region={REGION}
          onAnalysisComplete={handleAnalysisComplete}
          onError={() => {
            stopFaceCameraStreams();
            setSessionId(null);
            setPhase((p) => (p === "reauth" ? p : "error"));
          }}
          config={{ credentialProvider }}
        />
      </div>
    );
  }

  if (phase === "checking" || phase === "starting") {
    return (
      <div className="flex flex-col items-center gap-3 py-12">
        <Loader2 className="text-muted-foreground size-8 animate-spin" />
        <p className="text-muted-foreground text-sm">
          {phase === "starting" ? "กำลังเริ่มต้น…" : "กำลังตรวจสอบผล…"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-muted/60 text-muted-foreground space-y-2 rounded-lg p-4 text-sm">
        <p className="text-foreground font-medium">ก่อนเริ่มลงทะเบียน</p>
        <p>
          ระบบจะเปิดกล้องเพื่อตรวจสอบว่าเป็นใบหน้าจริง (liveness)
          ภาพอ้างอิงจะถูกเก็บอย่างปลอดภัยเพื่อใช้ยืนยันตัวตนเท่านั้น
          และจะไม่บันทึกวิดีโอเซลฟี่ของคุณ
        </p>
      </div>
      <Button onClick={start} size="lg" className="w-full">
        เริ่มลงทะเบียนใบหน้า
      </Button>
    </div>
  );
}

function resetTo(
  setPhase: (p: Phase) => void,
  setSessionId: (s: string | null) => void,
) {
  setSessionId(null);
  setPhase("intro");
}

function getRejectedTitle(reason: string | null) {
  if (reason === "face_already_registered") return "ใบหน้านี้ถูกลงทะเบียนแล้ว";
  if (reason === "face_not_indexed") return "ยังลงทะเบียนใบหน้าไม่ได้";
  if (reason === "face_mismatch") return "ใบหน้าไม่ตรงกับบัญชีนี้";
  return "ยืนยันใบหน้าไม่สำเร็จ";
}

function getRejectedDescription(reason: string | null) {
  if (reason === "face_already_registered") {
    return "ระบบพบว่าใบหน้านี้มีอยู่ใน Face Collection แล้ว กรุณาติดต่อผู้ดูแลหากคิดว่าเป็นข้อผิดพลาด";
  }
  if (reason === "face_not_indexed") {
    return "ระบบยืนยัน liveness ได้แล้ว แต่รูปอ้างอิงยังไม่เหมาะสำหรับทำ face recognition กรุณาลองใหม่ในที่แสงสว่างเพียงพอ";
  }
  if (reason === "face_mismatch") {
    return "ใบหน้าที่ตรวจพบไม่ตรงกับใบหน้าที่ลงทะเบียนไว้สำหรับบัญชีนี้";
  }
  return "กรุณาตรวจสอบแสงสว่างและตำแหน่งใบหน้า แล้วลองใหม่อีกครั้ง";
}

function Result({
  icon,
  title,
  description,
  debug,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  debug?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-4 py-8 text-center">
      {icon}
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
      {debug}
      {action ? <div className="w-full pt-2">{action}</div> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Debug-only confidence badge — never rendered when ENABLE_FACENESS_DEBUG=NO
// ---------------------------------------------------------------------------

type ConfidenceTier = {
  label: string;
  bar: string; // Tailwind bg color for the filled bar
  badge: string; // Tailwind text + border classes for the pill
};

function getConfidenceTier(score: number): ConfidenceTier {
  if (score >= 90)
    return {
      label: "สูงมาก (≥ 90)",
      bar: "bg-green-500",
      badge: "border-green-500 text-green-700 bg-green-50",
    };
  if (score >= 70)
    return {
      label: "ปานกลาง (70–89)",
      bar: "bg-amber-400",
      badge: "border-amber-400 text-amber-700 bg-amber-50",
    };
  if (score >= 50)
    return {
      label: "ต่ำ (50–69)",
      bar: "bg-orange-400",
      badge: "border-orange-400 text-orange-700 bg-orange-50",
    };
  return {
    label: "ต่ำมาก (< 50)",
    bar: "bg-red-400",
    badge: "border-red-400 text-red-700 bg-red-50",
  };
}

function ConfidenceBadge({ confidence }: { confidence: number | null }) {
  if (confidence === null) {
    return (
      <div className="border-muted-foreground/30 text-muted-foreground rounded-lg border px-3 py-2 text-xs font-mono">
        [DEBUG] confidence: n/a
      </div>
    );
  }

  const tier = getConfidenceTier(confidence);
  const pct = Math.min(100, Math.max(0, confidence));

  return (
    <div className="border-border w-full space-y-2 rounded-lg border p-3 text-left">
      <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-widest">
        Debug — Confidence Score
      </p>
      {/* Bar */}
      <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
        <div
          className={cn("h-full rounded-full transition-all", tier.bar)}
          style={{ width: `${pct}%` }}
        />
      </div>
      {/* Score + tier pill */}
      <div className="flex items-center justify-between">
        <span className="font-mono text-sm font-semibold">
          {confidence.toFixed(2)}%
        </span>
        <span
          className={cn(
            "rounded-full border px-2 py-0.5 text-xs font-medium",
            tier.badge,
          )}
        >
          {tier.label}
        </span>
      </div>
    </div>
  );
}
