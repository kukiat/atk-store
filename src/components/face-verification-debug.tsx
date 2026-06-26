"use client";

import "@aws-amplify/ui-react/styles.css";

import {
  type AwsCredentialProvider,
  FaceLivenessDetectorCore,
} from "@aws-amplify/ui-react-liveness";
import {
  CheckCircle2,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  stopFaceCameraStreams,
  useFaceCameraCleanup,
} from "@/lib/face-camera-cleanup";
import { useSuppressReadableStreamCancelError } from "@/lib/use-suppress-readable-stream-cancel-error";

const REGION = process.env.NEXT_PUBLIC_AWS_LIVENESS_REGION ?? "";

type UserProfile = {
  email: string;
  name: string | null;
  avatarUrl: string | null;
};

type Phase =
  | "intro"
  | "starting"
  | "detecting"
  | "checking"
  | "verified"
  | "reauth"
  | "admin_error";

type FaceResultResponse = {
  outcome: "accepted" | "rejected" | "pending";
  confidence?: number;
  reason?: string;
  recognition?: {
    outcome: "registered" | "verified" | "mismatch";
    faceId?: string;
    matchedUserId?: number | null;
    similarity?: number | null;
  };
};

/**
 * Debug-only face verification flow. It does not create a liveness session on
 * mount: the first AWS-costing action happens only after the user presses the
 * start button. Verification uses a fresh liveness session with
 * `{ intent: "verification" }`, then reads the owned result once with one short
 * bounded retry for Rekognition's pending state.
 */
export function FaceVerificationDebug({
  user,
  timeoutMs,
}: {
  user: UserProfile;
  timeoutMs: number;
}) {
  const [phase, setPhase] = useState<Phase>("intro");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [similarity, setSimilarity] = useState<number | null>(null);
  const [slowScan, setSlowScan] = useState(false);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
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

  useEffect(() => {
    if (phase !== "detecting" || !sessionId) return;

    const timer = window.setTimeout(() => {
      setSlowScan(true);
    }, timeoutMs);

    return () => window.clearTimeout(timer);
  }, [phase, sessionId, timeoutMs]);

  const start = useCallback(async () => {
    if (startingRef.current) return;
    startingRef.current = true;
    setPhase("starting");
    setSimilarity(null);
    setSlowScan(false);
    setErrorDetail(null);

    try {
      const authStatus = await fetch("/api/face/auth-status", {
        cache: "no-store",
      });

      if (authStatus.status === 401 || authStatus.status === 409) {
        setPhase("reauth");
        return;
      }

      if (!authStatus.ok) {
        setErrorDetail("face_auth_status_failed");
        setPhase("admin_error");
        return;
      }

      const res = await fetch("/api/face/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent: "verification" }),
      });

      if (res.status === 401) {
        setPhase("reauth");
        return;
      }

      if (!res.ok) {
        setErrorDetail(`session_${res.status}`);
        setPhase("admin_error");
        return;
      }

      const { sessionId: id } = (await res.json()) as { sessionId: string };
      setSessionId(id);
      setPhase("detecting");
    } catch {
      setErrorDetail("session_request_failed");
      setPhase("admin_error");
    } finally {
      startingRef.current = false;
    }
  }, []);

  const readResult = useCallback(async (id: string): Promise<void> => {
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
        setErrorDetail(`result_${res.status}`);
        setPhase("admin_error");
        return;
      }

      const data = (await res.json()) as FaceResultResponse;
      if (data.outcome === "pending") continue;

      if (
        data.outcome === "accepted" &&
        data.recognition?.outcome === "verified"
      ) {
        stopFaceCameraStreams();
        setSessionId(null);
        setSimilarity(data.recognition.similarity ?? null);
        setPhase("verified");
        return;
      }

      stopFaceCameraStreams();
      setSessionId(null);
      setSimilarity(data.recognition?.similarity ?? null);
      setErrorDetail(
        data.reason ?? data.recognition?.outcome ?? "not_verified",
      );
      setPhase("admin_error");
      return;
    }

    stopFaceCameraStreams();
    setSessionId(null);
    setErrorDetail("result_pending");
    setPhase("admin_error");
  }, []);

  const handleAnalysisComplete = useCallback(async () => {
    if (!sessionId) return;
    setPhase("checking");
    stopFaceCameraStreams();
    await readResult(sessionId);
  }, [sessionId, readResult]);

  if (phase === "verified") {
    return (
      <ResultShell
        icon={<CheckCircle2 className="size-12 text-green-600" />}
        title="ยืนยันใบหน้าสำเร็จ"
        description="ระบบจำใบหน้าของบัญชีนี้ได้แล้ว"
      >
        <VerifiedProfile user={user} similarity={similarity} />
        <Button render={<Link href="/" />} size="lg" className="w-full">
          Back to home
        </Button>
      </ResultShell>
    );
  }

  if (phase === "reauth") {
    return (
      <ResultShell
        icon={<ShieldAlert className="size-12 text-amber-500" />}
        title="เซสชันหมดอายุ"
        description="กรุณาเข้าสู่ระบบอีกครั้งก่อนทดสอบยืนยันใบหน้า"
      >
        <Button
          render={<Link href="/api/auth/signin/google" />}
          size="lg"
          className="w-full"
        >
          เข้าสู่ระบบอีกครั้ง
        </Button>
      </ResultShell>
    );
  }

  if (phase === "admin_error") {
    return (
      <ResultShell
        icon={<XCircle className="text-destructive size-12" />}
        title="เกิดข้อผิดพลาดในการยืนยันใบหน้า"
        description={getAdminErrorDescription(errorDetail)}
      >
        {similarity !== null ? (
          <p className="text-muted-foreground text-xs">
            Face similarity:{" "}
            <span className="text-foreground font-mono">
              {similarity.toFixed(2)}%
            </span>
          </p>
        ) : null}
        <Button render={<Link href="/" />} size="lg" className="w-full">
          Back to home
        </Button>
      </ResultShell>
    );
  }

  if (phase === "detecting" && sessionId) {
    if (!REGION) {
      return (
        <ResultShell
          icon={<XCircle className="text-destructive size-12" />}
          title="ตั้งค่าไม่ครบ"
          description="ไม่พบค่า region สำหรับ Face Liveness กรุณาติดต่อ admin"
        >
          <Button render={<Link href="/" />} size="lg" className="w-full">
            Back to home
          </Button>
        </ResultShell>
      );
    }

    return (
      <div className="space-y-3">
        <div className="bg-muted/60 text-muted-foreground rounded-lg px-4 py-3 text-sm">
          {slowScan ? (
            <span className="text-amber-700">
              ใช้เวลานานกว่าที่ตั้งไว้ แต่ระบบจะรอให้ Face Liveness
              ปิดสตรีมอย่างปลอดภัยก่อนตัดสินผล
            </span>
          ) : (
            <>
              หากใช้เวลานานกว่า{" "}
              <span className="text-foreground font-mono">
                {(timeoutMs / 1000).toFixed(0)}
              </span>{" "}
              วินาที ระบบจะแจ้งเตือนแต่จะไม่ตัดกล้องกลางสตรีม
            </>
          )}
        </div>
        <div className="w-full overflow-hidden rounded-2xl">
          <FaceLivenessDetectorCore
            sessionId={sessionId}
            region={REGION}
            onAnalysisComplete={handleAnalysisComplete}
            onError={() => {
              stopFaceCameraStreams();
              setSessionId(null);
              setErrorDetail("detector_error");
              setPhase((p) => (p === "reauth" ? p : "admin_error"));
            }}
            config={{ credentialProvider }}
          />
        </div>
      </div>
    );
  }

  if (phase === "checking" || phase === "starting") {
    return (
      <div className="flex flex-col items-center gap-3 py-12">
        <Loader2 className="text-muted-foreground size-8 animate-spin" />
        <p className="text-muted-foreground text-sm">
          {phase === "starting" ? "กำลังเริ่มต้น…" : "กำลังตรวจสอบใบหน้า…"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-muted/60 text-muted-foreground space-y-2 rounded-lg p-4 text-sm">
        <p className="text-foreground font-medium">Debug recognition proof</p>
        <p>
          ปุ่มนี้จะสร้าง Face Liveness session ใหม่เพื่อถ่าย reference image
          แล้วให้ backend เรียก Rekognition SearchFacesByImage เทียบกับ Face
          Collection ของบัญชีนี้
        </p>
      </div>
      <Button onClick={start} size="lg" className="w-full">
        <ShieldCheck className="size-4" />
        Start verify face
      </Button>
    </div>
  );
}

function VerifiedProfile({
  user,
  similarity,
}: {
  user: UserProfile;
  similarity: number | null;
}) {
  return (
    <div className="border-border bg-card w-full rounded-xl border p-4 text-left">
      <div className="flex items-center gap-3">
        {user.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.avatarUrl}
            alt={`รูปโปรไฟล์ของ ${user.name ?? user.email}`}
            className="bg-muted size-14 rounded-full object-cover"
          />
        ) : (
          <div className="bg-muted text-muted-foreground flex size-14 items-center justify-center rounded-full text-lg font-semibold">
            {(user.name ?? user.email).slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate font-medium">{user.name ?? "No name"}</p>
          <p className="text-muted-foreground truncate text-sm">{user.email}</p>
        </div>
      </div>
      {similarity !== null ? (
        <p className="text-muted-foreground mt-3 text-xs">
          Face similarity:{" "}
          <span className="text-foreground font-mono">
            {similarity.toFixed(2)}%
          </span>
        </p>
      ) : null}
    </div>
  );
}

function getAdminErrorDescription(detail: string | null) {
  if (detail === "face_mismatch" || detail === "mismatch") {
    return "ใบหน้าที่สแกนไม่ตรงกับใบหน้าที่ลงทะเบียนไว้สำหรับบัญชีนี้ กรุณาติดต่อ admin หากคิดว่าเป็นข้อผิดพลาด";
  }
  if (detail === "result_pending") {
    return "ระบบยังไม่ได้ผลลัพธ์จาก Rekognition ภายในรอบตรวจสอบที่กำหนด กรุณาลองใหม่หรือแจ้ง admin";
  }
  if (detail === "detector_error") {
    return "กล้องหรือ Face Liveness detector มีข้อผิดพลาด กรุณาปิดหน้าแล้วลองใหม่ หรือติดต่อ admin";
  }
  return "ระบบไม่สามารถยืนยันใบหน้าได้ กรุณาติดต่อ admin";
}

function ResultShell({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-4 py-8 text-center">
      {icon}
      <div className="space-y-1">
        <h2 className="text-balance text-lg font-semibold">{title}</h2>
        <p className="text-muted-foreground text-pretty text-sm">
          {description}
        </p>
      </div>
      <div className="flex w-full flex-col gap-3 pt-2">{children}</div>
    </div>
  );
}
