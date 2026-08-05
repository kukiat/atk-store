"use client";

import { Camera, Keyboard, ScanLine } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  createQrDetector,
  getCameraErrorMessage,
  getQrCameraSupport,
  shouldRetryQrDetection,
} from "@/lib/qr-camera";

type DecodeResult = {
  inventoryIds: string[];
  inventories: Array<{ id: string; name: string; imageUrl: string | null }>;
  error?: string;
};

export function QrScanner() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanTimerRef = useRef<number | null>(null);
  const scanActiveRef = useRef(false);
  const scanGenerationRef = useRef(0);
  const consecutiveScanErrorRef = useRef(0);
  const [encodedPayload, setEncodedPayload] = useState("");
  const [status, setStatus] = useState<
    "idle" | "starting" | "camera" | "error"
  >("idle");
  const [message, setMessage] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    scanGenerationRef.current += 1;
    scanActiveRef.current = false;
    consecutiveScanErrorRef.current = 0;
    if (scanTimerRef.current !== null) {
      window.clearTimeout(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => {
    const handlePageHide = () => {
      stopCamera();
      setStatus("idle");
    };
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      window.removeEventListener("pagehide", handlePageHide);
      stopCamera();
    };
  }, [stopCamera]);

  async function decode(value: string) {
    setMessage(null);
    const response = await fetch("/api/qr/decode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ encodedPayload: value }),
    });
    const result = (await response.json()) as DecodeResult;

    if (!response.ok) {
      setStatus("error");
      setMessage(result.error ?? "อ่าน QR ไม่สำเร็จ");
      return;
    }

    if (result.inventoryIds.length === 1) {
      router.push(`/inventory/${result.inventoryIds[0]}`);
      return;
    }

    const params = new URLSearchParams({ payload: value });
    router.push(`/scan/inventories?${params.toString()}`);
  }

  async function startCamera() {
    const support = getQrCameraSupport({
      isSecureContext: window.isSecureContext,
      hasGetUserMedia: Boolean(navigator.mediaDevices?.getUserMedia),
    });
    if (!support.supported) {
      setStatus("error");
      setMessage(support.message);
      return;
    }

    const video = videoRef.current;
    if (!video) {
      setStatus("error");
      setMessage("ไม่พบพื้นที่แสดงภาพจากกล้อง กรุณาโหลดหน้าใหม่");
      return;
    }

    stopCamera();
    const generation = scanGenerationRef.current;
    setMessage(null);
    setStatus("starting");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      if (generation !== scanGenerationRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = stream;
      video.srcObject = stream;
      await video.play();
      if (generation !== scanGenerationRef.current) return;

      let detector: Awaited<ReturnType<typeof createQrDetector>>;
      try {
        detector = await createQrDetector();
      } catch {
        if (generation !== scanGenerationRef.current) return;
        stopCamera();
        setStatus("error");
        setMessage("โหลดตัวอ่าน QR ไม่สำเร็จ กรุณาโหลดหน้าใหม่แล้วลองอีกครั้ง");
        return;
      }
      if (generation !== scanGenerationRef.current) return;

      scanActiveRef.current = true;
      setStatus("camera");

      async function tick() {
        if (
          generation !== scanGenerationRef.current ||
          !scanActiveRef.current ||
          !videoRef.current
        ) {
          return;
        }

        try {
          const codes = await detector.detect(videoRef.current);
          if (generation !== scanGenerationRef.current) return;
          consecutiveScanErrorRef.current = 0;

          const first = codes[0]?.rawValue;
          if (first) {
            stopCamera();
            await decode(first);
            return;
          }
        } catch (error) {
          if (generation !== scanGenerationRef.current) return;
          consecutiveScanErrorRef.current += 1;
          if (shouldRetryQrDetection(consecutiveScanErrorRef.current)) {
            scanTimerRef.current = window.setTimeout(tick, 350);
            return;
          }
          stopCamera();
          setStatus("error");
          setMessage(getCameraErrorMessage(error));
          return;
        }

        scanTimerRef.current = window.setTimeout(tick, 350);
      }

      void tick();
    } catch (error) {
      if (generation !== scanGenerationRef.current) return;
      stopCamera();
      setStatus("error");
      setMessage(getCameraErrorMessage(error));
    }
  }

  return (
    <div className="grid gap-5">
      <div className="aspect-square overflow-hidden rounded-lg border bg-muted">
        <video
          ref={videoRef}
          className="size-full object-cover"
          muted
          playsInline
          aria-label="QR scanner camera preview"
        />
      </div>

      <div className="grid gap-3">
        <Button
          onClick={startCamera}
          disabled={status === "starting" || status === "camera"}
        >
          <Camera className="size-4" />
          {status === "starting" ? "กำลังเปิดกล้อง..." : "เปิดกล้องสแกน"}
        </Button>

        <label className="grid gap-2 text-sm font-medium">
          <span className="flex items-center gap-2">
            <Keyboard className="size-4" />
            Encoded payload
          </span>
          <textarea
            className="min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
            value={encodedPayload}
            onChange={(event) => setEncodedPayload(event.target.value)}
          />
        </label>

        <Button
          variant="outline"
          onClick={() => decode(encodedPayload.trim())}
          disabled={!encodedPayload.trim()}
        >
          <ScanLine className="size-4" />
          Decode
        </Button>
      </div>

      {message && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {message}
        </p>
      )}
    </div>
  );
}
