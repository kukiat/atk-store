"use client";

import { Camera, Keyboard, ScanLine } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => {
  detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue: string }>>;
};

declare global {
  interface Window {
    BarcodeDetector?: BarcodeDetectorConstructor;
  }
}

type DecodeResult = {
  shelfIds: string[];
  shelves: Array<{ id: string; name: string; imageUrl: string | null }>;
  error?: string;
};

export function QrScanner() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [encodedPayload, setEncodedPayload] = useState("");
  const [status, setStatus] = useState<"idle" | "camera" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

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

    if (result.shelfIds.length === 1) {
      router.push(`/shelf/${result.shelfIds[0]}`);
      return;
    }

    const params = new URLSearchParams({ payload: value });
    router.push(`/scan/shelves?${params.toString()}`);
  }

  async function startCamera() {
    if (!window.BarcodeDetector || !videoRef.current) {
      setMessage(
        "อุปกรณ์นี้ยังไม่รองรับ camera QR scan กรุณาวาง encoded payload",
      );
      return;
    }

    setStatus("camera");
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
      audio: false,
    });
    streamRef.current = stream;
    videoRef.current.srcObject = stream;
    await videoRef.current.play();

    const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
    let active = true;

    async function tick() {
      if (!active || !videoRef.current) return;
      const codes = await detector.detect(videoRef.current).catch(() => []);
      const first = codes[0]?.rawValue;
      if (first) {
        active = false;
        stream.getTracks().forEach((track) => track.stop());
        await decode(first);
        return;
      }
      window.setTimeout(tick, 350);
    }

    tick();
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
        <Button onClick={startCamera} disabled={status === "camera"}>
          <Camera className="size-4" />
          เปิดกล้องสแกน
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
