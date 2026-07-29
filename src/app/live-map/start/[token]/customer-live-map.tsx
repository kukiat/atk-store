"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  ArrowLeft,
  CheckCircle2,
  Footprints,
  MapPin,
  Navigation,
  RotateCcw,
  Search,
  TriangleAlert,
  Video,
  VideoOff,
} from "lucide-react";
import Link from "next/link";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  calculateNavigationProgress,
  calculateWalkRoute,
  mapBearingDegrees,
  nearestWalkPathPoint,
} from "@/lib/live-map-routing";
import { cn } from "@/lib/utils";
import type {
  CustomerLiveMapData,
  MapPoint,
} from "@/services/live-map.service";

type NavigationMode = "map" | "ar";
type PermissionResult = "granted" | "denied";
type PermissionAwareConstructor = {
  requestPermission?: () => Promise<PermissionResult>;
};

const inputClass =
  "h-11 w-full rounded-lg border border-input bg-background pl-10 pr-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40";
const STEP_METERS = 0.68;
const ARRIVAL_METERS = 0.7;
const OFF_ROUTE_METERS = 1.1;

function pointsToSvg(points: MapPoint[]) {
  return points.map((point) => `${point.x},${point.z}`).join(" ");
}

function defaultBoundary(data: CustomerLiveMapData): MapPoint[] {
  return [
    { x: 0, z: 0 },
    { x: data.floor.widthMeters, z: 0 },
    { x: data.floor.widthMeters, z: data.floor.lengthMeters },
    { x: 0, z: data.floor.lengthMeters },
  ];
}

function normalizeDegrees(value: number) {
  return ((value % 360) + 360) % 360;
}

function pointDistance(first: MapPoint, second: MapPoint) {
  return Math.hypot(first.x - second.x, first.z - second.z);
}

function formatElapsed(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

export function CustomerLiveMap({ data }: { data: CustomerLiveMapData }) {
  const [query, setQuery] = useState("");
  const [selectedDestinationId, setSelectedDestinationId] = useState("");
  const [currentPosition, setCurrentPosition] = useState(data.anchor.start);
  const [mode, setMode] = useState<NavigationMode>("map");
  const [cameraActive, setCameraActive] = useState(false);
  const [mapHeadingDegrees, setMapHeadingDegrees] = useState(
    normalizeDegrees(data.anchor.yawDegrees + 180),
  );
  const [offRoute, setOffRoute] = useState(false);
  const [arrived, setArrived] = useState(false);
  const [trackingMessage, setTrackingMessage] = useState(
    "เลือกสินค้าเพื่อเริ่มนำทาง",
  );
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const productSelectionRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const positionRef = useRef(currentPosition);
  const headingRef = useRef(mapHeadingDegrees);
  const sessionIdRef = useRef(sessionId);
  const modeRef = useRef(mode);
  const calibratedDeviceHeadingRef = useRef<number | null>(null);
  const lastStepAtRef = useRef(0);

  const selectedDestination =
    data.destinations.find(
      (destination) => destination.id === selectedDestinationId,
    ) ?? null;
  const navigationProgress = useMemo(() => {
    if (!selectedDestination) return null;
    return calculateNavigationProgress(
      data.paths,
      currentPosition,
      selectedDestination,
      ARRIVAL_METERS,
    );
  }, [currentPosition, data.paths, selectedDestination]);
  const route = navigationProgress?.route ?? null;
  const visibleDestinations = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("th-TH");
    if (!normalized) return data.destinations;
    return data.destinations.filter((destination) =>
      `${destination.inventoryName} ${destination.label}`
        .toLocaleLowerCase("th-TH")
        .includes(normalized),
    );
  }, [data.destinations, query]);

  const boundary =
    data.floor.boundary.length >= 3
      ? data.floor.boundary
      : defaultBoundary(data);
  const mapScale = Math.max(data.floor.widthMeters, data.floor.lengthMeters, 1);
  const pathStroke = mapScale * 0.018;
  const routeStroke = mapScale * 0.045;
  const markerRadius = mapScale * 0.035;
  const nextRoutePoint =
    route?.points.find(
      (point) => pointDistance(point, currentPosition) > 0.25,
    ) ??
    selectedDestination ??
    null;
  const arrowRotation = nextRoutePoint
    ? normalizeDegrees(
        mapBearingDegrees(currentPosition, nextRoutePoint) - mapHeadingDegrees,
      )
    : 0;

  useEffect(() => {
    positionRef.current = currentPosition;
  }, [currentPosition]);

  useEffect(() => {
    headingRef.current = mapHeadingDegrees;
  }, [mapHeadingDegrees]);

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    if (!selectedDestination || arrived) return;
    const timer = window.setInterval(
      () => setElapsedSeconds((seconds) => seconds + 1),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [arrived, selectedDestination]);

  useEffect(() => {
    if (!cameraActive || !streamRef.current || !videoRef.current) return;
    videoRef.current.srcObject = streamRef.current;
    void videoRef.current.play().catch(() => {
      setTrackingMessage("แตะหน้าจอเพื่ออนุญาตให้กล้องเล่นวิดีโอ");
    });
  }, [cameraActive]);

  useEffect(() => {
    if (!cameraActive || !selectedDestination) return;
    const destination = selectedDestination;

    function handleOrientation(event: DeviceOrientationEvent) {
      const compassHeading = (
        event as DeviceOrientationEvent & { webkitCompassHeading?: number }
      ).webkitCompassHeading;
      const heading =
        compassHeading ??
        (typeof event.alpha === "number" ? 360 - event.alpha : null);
      if (heading === null) return;
      const normalizedHeading = normalizeDegrees(heading);
      const calibratedHeading =
        calibratedDeviceHeadingRef.current ?? normalizedHeading;
      calibratedDeviceHeadingRef.current = calibratedHeading;
      setMapHeadingDegrees(
        normalizeDegrees(
          data.anchor.yawDegrees + 180 + normalizedHeading - calibratedHeading,
        ),
      );
    }

    function handleMotion(event: DeviceMotionEvent) {
      const acceleration = event.acceleration;
      const gravityAcceleration = event.accelerationIncludingGravity;
      const magnitude = acceleration
        ? Math.hypot(
            acceleration.x ?? 0,
            acceleration.y ?? 0,
            acceleration.z ?? 0,
          )
        : gravityAcceleration
          ? Math.abs(
              Math.hypot(
                gravityAcceleration.x ?? 0,
                gravityAcceleration.y ?? 0,
                gravityAcceleration.z ?? 0,
              ) - 9.81,
            )
          : 0;
      const now = Date.now();
      if (magnitude < 1.7 || now - lastStepAtRef.current < 430) return;
      lastStepAtRef.current = now;

      const heading = headingRef.current;
      const radians = (heading * Math.PI) / 180;
      const rawPosition = {
        x: positionRef.current.x + Math.sin(radians) * STEP_METERS,
        z: positionRef.current.z - Math.cos(radians) * STEP_METERS,
      };
      const nearest = nearestWalkPathPoint(data.paths, rawPosition);
      const isOffRoute = !nearest || nearest.distanceMeters > OFF_ROUTE_METERS;
      const nextPosition = nearest && !isOffRoute ? nearest.point : rawPosition;
      setOffRoute(isOffRoute);
      setCurrentPosition(nextPosition);
      const progress = calculateNavigationProgress(
        data.paths,
        nextPosition,
        destination,
        ARRIVAL_METERS,
      );
      const reachedDestination = progress.arrived;
      setArrived(reachedDestination);
      if (reachedDestination) {
        setTrackingMessage(`ถึง ${destination.inventoryName} แล้ว`);
      } else {
        setTrackingMessage(
          isOffRoute
            ? "ดูเหมือนออกนอกเส้นทาง กรุณากลับไปหาเส้นสีฟ้า"
            : "กำลังติดตามตำแหน่งจากการเดิน",
        );
      }

      const activeSessionId = sessionIdRef.current;
      if (activeSessionId) {
        void fetch(`/api/live-map/sessions/${activeSessionId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            x: nextPosition.x,
            z: nextPosition.z,
            mode: "ar",
            status: reachedDestination ? "arrived" : "navigating",
          }),
          keepalive: true,
        });
      }
    }

    window.addEventListener("deviceorientation", handleOrientation, true);
    window.addEventListener("devicemotion", handleMotion);
    return () => {
      window.removeEventListener("deviceorientation", handleOrientation, true);
      window.removeEventListener("devicemotion", handleMotion);
    };
  }, [
    cameraActive,
    data.anchor.yawDegrees,
    data.paths,
    selectedDestination,
  ]);

  useEffect(() => {
    if (!cameraActive) return;
    const previousBodyOverflow = document.body.style.overflow;
    const previousRootOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousRootOverflow;
    };
  }, [cameraActive]);

  useEffect(() => {
    function closeOnPageExit() {
      const activeSessionId = sessionIdRef.current;
      if (!activeSessionId) return;
      void fetch(`/api/live-map/sessions/${activeSessionId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          x: positionRef.current.x,
          z: positionRef.current.z,
          mode: modeRef.current,
          status: "cancelled",
        }),
        keepalive: true,
      });
    }

    window.addEventListener("pagehide", closeOnPageExit);
    return () => {
      window.removeEventListener("pagehide", closeOnPageExit);
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  async function closeCurrentSession(status: "arrived" | "cancelled") {
    const activeSessionId = sessionIdRef.current;
    if (!activeSessionId) return;
    await fetch(`/api/live-map/sessions/${activeSessionId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        x: positionRef.current.x,
        z: positionRef.current.z,
        mode,
        status,
      }),
      keepalive: true,
    }).catch(() => undefined);
  }

  async function selectDestination(destinationId: string, restart = false) {
    if (destinationId === selectedDestinationId && !restart) return;
    await closeCurrentSession("cancelled");
    const destination = data.destinations.find(
      (item) => item.id === destinationId,
    );
    setSelectedDestinationId(destinationId);
    setCurrentPosition(data.anchor.start);
    setOffRoute(false);
    setArrived(false);
    setElapsedSeconds(0);
    setTrackingMessage("พร้อมเริ่มนำทางจากจุดสแกน QR");
    setSessionId(null);
    sessionIdRef.current = null;
    if (!destination) return;

    const initialRoute = calculateWalkRoute(
      data.paths,
      data.anchor.start,
      destination,
    );
    if (!initialRoute) {
      setTrackingMessage("ยังไม่มี Walk path ที่เชื่อมไปยังสินค้านี้");
      return;
    }

    try {
      const response = await fetch("/api/live-map/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          anchorToken: data.anchor.token,
          destinationId,
          distanceMeters: initialRoute.distanceMeters,
          mode,
        }),
      });
      if (!response.ok) throw new Error("Could not record navigation session");
      const session = (await response.json()) as { id: string };
      setSessionId(session.id);
      sessionIdRef.current = session.id;
    } catch {
      setTrackingMessage("นำทางได้ตามปกติ แต่ยังบันทึกสถิติรอบนี้ไม่ได้");
    }
  }

  async function requestSensorPermission(
    constructor: PermissionAwareConstructor | undefined,
  ) {
    if (!constructor?.requestPermission) return true;
    return (await constructor.requestPermission()) === "granted";
  }

  async function startAr() {
    if (!selectedDestination) {
      setTrackingMessage("กรุณาเลือกสินค้าก่อนเปิด AR");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setTrackingMessage("เบราว์เซอร์นี้ไม่รองรับการเปิดกล้อง WebAR");
      return;
    }

    try {
      const orientationAllowed = await requestSensorPermission(
        window.DeviceOrientationEvent as unknown as PermissionAwareConstructor,
      );
      const motionAllowed = await requestSensorPermission(
        window.DeviceMotionEvent as unknown as PermissionAwareConstructor,
      );
      if (!orientationAllowed || !motionAllowed) {
        setTrackingMessage("ไม่ได้รับอนุญาตให้ใช้ motion sensor");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" } },
      });
      streamRef.current = stream;
      calibratedDeviceHeadingRef.current = null;
      setMapHeadingDegrees(normalizeDegrees(data.anchor.yawDegrees + 180));
      setMode("ar");
      setCameraActive(true);
      setTrackingMessage("เปิด AR แล้ว ถือโทรศัพท์ให้ตรงและเริ่มเดิน");

      const activeSessionId = sessionIdRef.current;
      if (activeSessionId) {
        void fetch(`/api/live-map/sessions/${activeSessionId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            x: currentPosition.x,
            z: currentPosition.z,
            mode: "ar",
            status: "navigating",
          }),
        });
      }
    } catch {
      setTrackingMessage(
        "เปิดกล้องไม่ได้ กรุณาอนุญาต Camera และ Motion ในเบราว์เซอร์",
      );
    }
  }

  function stopAr() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
    setMode("map");
    setTrackingMessage("ปิดกล้องแล้ว ยังดูเส้นทางบนแผนที่ได้");
    window.requestAnimationFrame(() => {
      productSelectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  function recalibrate() {
    setCurrentPosition(data.anchor.start);
    calibratedDeviceHeadingRef.current = null;
    setMapHeadingDegrees(normalizeDegrees(data.anchor.yawDegrees + 180));
    setOffRoute(false);
    setArrived(false);
    setTrackingMessage("ตั้งตำแหน่งกลับไปยังจุด QR Anchor แล้ว");
  }

  async function markArrived() {
    setArrived(true);
    setTrackingMessage(
      selectedDestination
        ? `ถึง ${selectedDestination.inventoryName} แล้ว`
        : "ถึงสินค้าแล้ว",
    );
    await closeCurrentSession("arrived");
  }

  if (cameraActive && selectedDestination) {
    return (
      <section
        role="dialog"
        aria-modal="true"
        aria-label={`AR นำทางไป ${selectedDestination.inventoryName}`}
        className="fixed inset-0 z-50 h-dvh w-screen overflow-hidden bg-black"
      >
        <video
          ref={videoRef}
          muted
          playsInline
          autoPlay
          className="absolute inset-0 size-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-transparent to-black/70" />

        <div className="absolute inset-x-0 top-0 z-20 flex items-start px-4 pt-[max(1rem,env(safe-area-inset-top))]">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={stopAr}
            aria-label="กลับไปเลือกสินค้า"
            className="shrink-0 rounded-full bg-black/55 text-white backdrop-blur hover:bg-black/75 hover:text-white"
          >
            <ArrowLeft className="size-6" />
          </Button>
          <div className="pointer-events-none min-w-0 flex-1 px-3 text-center text-white">
            <p className="truncate text-sm font-medium">
              {selectedDestination.inventoryName}
            </p>
            <p className="text-xs text-white/80">
              {route
                ? `เหลือประมาณ ${route.distanceMeters.toFixed(1)} เมตร`
                : "กำลังหาเส้นทาง"}
            </p>
          </div>
          <div aria-hidden="true" className="size-9 shrink-0" />
        </div>

        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="flex size-32 items-center justify-center rounded-full border-4 border-white/80 bg-cyan-400/80 shadow-2xl transition-transform duration-300"
            style={{ transform: `rotate(${arrowRotation}deg)` }}
          >
            <Navigation className="size-20 fill-current text-white" />
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-0 z-20 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <p className="rounded-full bg-black/65 px-4 py-2 text-center text-sm text-white backdrop-blur">
            <Footprints className="mr-2 inline size-4" />
            {trackingMessage}
          </p>
        </div>
      </section>
    );
  }

  return (
    <main className="mx-auto grid w-full max-w-4xl flex-1 gap-4 px-4 py-4 sm:px-6 sm:py-6">
      <Card ref={productSelectionRef}>
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-400 text-amber-950">
              <Navigation className="size-5" />
            </div>
            <div>
              <CardTitle className="text-lg">
                Live Map — {data.floor.name}
              </CardTitle>
              <CardDescription>
                เริ่มจาก {data.anchor.code}: {data.anchor.name}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="relative">
            <Search className="absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground" />
            <input
              className={inputClass}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ค้นหาสินค้าที่ต้องการ..."
              aria-label="ค้นหาสินค้าใน Live Map"
            />
          </div>

          {data.destinations.length === 0 ? (
            <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              ยังไม่มีตำแหน่งสินค้าบนแผนที่ กรุณาเพิ่มจาก Back Office
            </p>
          ) : (
            <div className="flex max-h-40 flex-col gap-2 overflow-y-auto pr-1">
              {visibleDestinations.length === 0 ? (
                <p className="p-3 text-sm text-muted-foreground">
                  ไม่พบสินค้าที่ค้นหา
                </p>
              ) : (
                visibleDestinations.map((destination) => {
                  const selected = destination.id === selectedDestinationId;
                  return (
                    <button
                      key={destination.id}
                      type="button"
                      onClick={() => void selectDestination(destination.id)}
                      className={cn(
                        "flex items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                        selected
                          ? "border-primary bg-primary/10"
                          : "hover:bg-muted",
                      )}
                    >
                      <MapPin
                        className={cn(
                          "mt-0.5 size-5 shrink-0",
                          selected ? "text-primary" : "text-muted-foreground",
                        )}
                      />
                      <span className="min-w-0">
                        <span className="block font-medium">
                          {destination.inventoryName}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {destination.label}
                        </span>
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedDestination && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">โหมดนำทาง</CardTitle>
            <CardDescription>{trackingMessage}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              <div className="rounded-lg border p-2">
                <p className="text-xs text-muted-foreground">ระยะเหลือ</p>
                <p className="font-semibold">
                  {route ? `${route.distanceMeters.toFixed(1)} m` : "—"}
                </p>
              </div>
              <div className="rounded-lg border p-2">
                <p className="text-xs text-muted-foreground">เวลา</p>
                <p className="font-semibold">{formatElapsed(elapsedSeconds)}</p>
              </div>
              <div className="rounded-lg border p-2">
                <p className="text-xs text-muted-foreground">โหมด</p>
                <p className="font-semibold">
                  {cameraActive ? "AR" : "2D Map"}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {!arrived && (
                <>
                  {cameraActive ? (
                    <Button type="button" variant="outline" onClick={stopAr}>
                      <VideoOff className="size-4" />
                      ปิดกล้อง
                    </Button>
                  ) : (
                    <Button type="button" onClick={() => void startAr()}>
                      <Video className="size-4" />
                      หันเข้าหาป้ายแล้วเริ่ม AR
                    </Button>
                  )}
                  <Button type="button" variant="outline" onClick={recalibrate}>
                    <RotateCcw className="size-4" />
                    ตั้งตำแหน่งจาก QR ใหม่
                  </Button>
                </>
              )}
              {!arrived ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void markArrived()}
                >
                  <CheckCircle2 className="size-4" />
                  ถึงสินค้าแล้ว
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    void selectDestination(selectedDestinationId, true)
                  }
                >
                  <RotateCcw className="size-4" />
                  นำทางสินค้านี้อีกครั้ง
                </Button>
              )}
            </div>

            {offRoute && (
              <p className="flex items-center gap-2 rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
                <TriangleAlert className="size-5 shrink-0" />
                คุณอาจออกนอก Walk path กรุณากลับไปยังเส้นทาง
              </p>
            )}
            {arrived && (
              <p className="flex items-center gap-2 rounded-lg border border-green-500/50 bg-green-500/10 p-3 text-sm text-green-700 dark:text-green-300">
                <CheckCircle2 className="size-5 shrink-0" />
                ถึง {selectedDestination.inventoryName} แล้ว
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {selectedDestination
              ? `เส้นทางไป ${selectedDestination.inventoryName}`
              : "เลือกสินค้าเพื่อเริ่มนำทาง"}
          </CardTitle>
          <CardDescription>
            {selectedDestination && route
              ? `ระยะทางประมาณ ${route.distanceMeters.toFixed(1)} เมตร`
              : selectedDestination
                ? "ไม่พบ Walk path ที่เชื่อมจากจุดเริ่มต้นไปยังสินค้านี้"
                : "จุดสีเหลืองคือ QR start จุดสีน้ำเงินคือตำแหน่งปัจจุบัน"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <svg
            viewBox={`0 0 ${data.floor.widthMeters} ${data.floor.lengthMeters}`}
            role="img"
            aria-label={`แผนที่ ${data.floor.name}`}
            className="max-h-[65dvh] min-h-80 w-full rounded-xl border bg-slate-950 shadow-inner"
          >
            <defs>
              <marker
                id="live-map-route-arrow"
                markerWidth="7"
                markerHeight="7"
                refX="5"
                refY="3.5"
                orient="auto"
                markerUnits="strokeWidth"
              >
                <path d="M0,0 L7,3.5 L0,7 z" fill="#22d3ee" />
              </marker>
            </defs>
            <rect
              width={data.floor.widthMeters}
              height={data.floor.lengthMeters}
              fill="#020617"
            />
            <polygon
              points={pointsToSvg(boundary)}
              fill="#172033"
              stroke="#cbd5e1"
              strokeWidth={pathStroke}
            />
            {data.restrictedAreas.map((area) => (
              <polygon
                key={area.id}
                points={pointsToSvg(area.polygon)}
                fill="rgba(239,68,68,.42)"
                stroke="#f87171"
                strokeWidth={pathStroke}
              >
                <title>{area.name}</title>
              </polygon>
            ))}
            {data.paths.map((path) => (
              <polyline
                key={path.id}
                points={pointsToSvg(path.points)}
                fill="none"
                stroke="#475569"
                strokeWidth={pathStroke}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <title>{path.name}</title>
              </polyline>
            ))}
            {route && (
              <polyline
                points={pointsToSvg(route.points)}
                fill="none"
                stroke="#22d3ee"
                strokeWidth={routeStroke}
                strokeLinecap="round"
                strokeLinejoin="round"
                markerEnd="url(#live-map-route-arrow)"
              />
            )}
            {data.destinations.map((destination) => {
              const selected = destination.id === selectedDestinationId;
              return (
                <g
                  key={destination.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => void selectDestination(destination.id)}
                  style={{ cursor: "pointer" }}
                >
                  <rect
                    x={destination.x - markerRadius}
                    y={destination.z - markerRadius}
                    width={markerRadius * 2}
                    height={markerRadius * 2}
                    fill={selected ? "#22d3ee" : "#4ade80"}
                    stroke="#ffffff"
                    strokeWidth={pathStroke}
                    transform={`rotate(45 ${destination.x} ${destination.z})`}
                  />
                  <title>
                    {destination.inventoryName}: {destination.label}
                  </title>
                </g>
              );
            })}
            <circle
              cx={data.anchor.start.x}
              cy={data.anchor.start.z}
              r={markerRadius}
              fill="#fbbf24"
              stroke="#ffffff"
              strokeWidth={pathStroke}
            >
              <title>จุดเริ่มต้น {data.anchor.code}</title>
            </circle>
            {selectedDestination && (
              <circle
                cx={currentPosition.x}
                cy={currentPosition.z}
                r={markerRadius * 1.15}
                fill="#38bdf8"
                stroke="#ffffff"
                strokeWidth={pathStroke}
              >
                <title>ตำแหน่งโดยประมาณของคุณ</title>
              </circle>
            )}
          </svg>

          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="size-3 rounded-full bg-amber-400" />
              QR start
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-3 rounded-full bg-sky-400" />
              ตำแหน่งปัจจุบัน
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-3 rotate-45 bg-green-400" />
              สินค้า
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-1 w-5 rounded bg-cyan-400" />
              เส้นทาง
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-3 bg-red-400/70" />
              ห้ามเดิน
            </span>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        WebAR ใช้กล้องและ motion sensor บนอุปกรณ์เท่านั้น
        ระบบไม่บันทึกหรืออัปโหลดวิดีโอ
      </p>

      <Link
        href="/"
        className={cn(
          buttonVariants({ variant: "outline" }),
          "w-full sm:w-fit",
        )}
      >
        กลับหน้าหลัก
      </Link>
    </main>
  );
}
