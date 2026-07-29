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
  adaptiveHeadingResponsiveness,
  compassHeadingDegrees,
  createHeadingCalibrationState,
  createStepDetectorState,
  motionMagnitude,
  normalizeDegrees,
  processHeadingSample,
  processMotionSample,
  rotationRateMagnitude,
  smoothHeadingDegrees,
} from "@/lib/live-map-motion";
import { calculateWalkRoute } from "@/lib/live-map-routing";
import {
  createArrivalTrackerState,
  createOffRouteTrackerState,
  createRouteProgressState,
  type RouteProgressState,
  updateArrivalTracker,
  updateOffRouteTracker,
  updateRouteProgress,
} from "@/lib/live-map-tracking";
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

function formatElapsed(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

export function CustomerLiveMap({ data }: { data: CustomerLiveMapData }) {
  const [query, setQuery] = useState("");
  const [selectedDestinationId, setSelectedDestinationId] = useState("");
  const [currentPosition, setCurrentPosition] = useState(data.anchor.start);
  const [routeProgress, setRouteProgress] = useState<RouteProgressState | null>(
    null,
  );
  const [mode, setMode] = useState<NavigationMode>("map");
  const [cameraActive, setCameraActive] = useState(false);
  const [mapHeadingDegrees, setMapHeadingDegrees] = useState(
    normalizeDegrees(data.anchor.yawDegrees + 180),
  );
  const [offRoute, setOffRoute] = useState(false);
  const [arrived, setArrived] = useState(false);
  const [headingCalibrated, setHeadingCalibrated] = useState(false);
  const [headingCalibrationActive, setHeadingCalibrationActive] =
    useState(false);
  const [trackingMessage, setTrackingMessage] = useState(
    "เลือกสินค้าเพื่อเริ่มนำทาง",
  );
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const productSelectionRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const positionRef = useRef(currentPosition);
  const routeProgressRef = useRef<RouteProgressState | null>(routeProgress);
  const headingRef = useRef(mapHeadingDegrees);
  const sessionIdRef = useRef(sessionId);
  const modeRef = useRef(mode);
  const headingCalibrationRef = useRef(
    createHeadingCalibrationState(mapHeadingDegrees),
  );
  const headingCalibrationActiveRef = useRef(false);
  const lastAppliedHeadingAtRef = useRef<number | null>(null);
  const stepDetectorRef = useRef(createStepDetectorState());
  const arrivalTrackerRef = useRef(createArrivalTrackerState());
  const offRouteTrackerRef = useRef(createOffRouteTrackerState());

  const selectedDestination =
    data.destinations.find(
      (destination) => destination.id === selectedDestinationId,
    ) ?? null;
  const route = useMemo(() => {
    if (!selectedDestination) return null;
    return calculateWalkRoute(
      data.paths,
      data.anchor.start,
      selectedDestination,
    );
  }, [data.anchor.start, data.paths, selectedDestination]);
  const remainingDistanceMeters =
    routeProgress?.remainingDistanceMeters ?? route?.distanceMeters ?? null;
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
  const routeBearingDegrees =
    routeProgress?.routeBearingDegrees ??
    (route ? createRouteProgressState(route.points).routeBearingDegrees : 0);
  const arrowRotation = normalizeDegrees(
    routeBearingDegrees - mapHeadingDegrees,
  );

  useEffect(() => {
    positionRef.current = currentPosition;
  }, [currentPosition]);

  useEffect(() => {
    routeProgressRef.current = routeProgress;
  }, [routeProgress]);

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
    if (!cameraActive || !selectedDestination || !route) return;
    const destination = selectedDestination;
    const routePoints = route.points;

    function handleOrientation(event: DeviceOrientationEvent) {
      if (!headingCalibrationActiveRef.current) return;
      const compassHeading = (
        event as DeviceOrientationEvent & { webkitCompassHeading?: number }
      ).webkitCompassHeading;
      const tiltCompensatedHeading =
        typeof event.alpha === "number" &&
        typeof event.beta === "number" &&
        typeof event.gamma === "number"
          ? compassHeadingDegrees(event.alpha, event.beta, event.gamma)
          : null;
      const heading =
        typeof compassHeading === "number" && Number.isFinite(compassHeading)
          ? compassHeading
          : tiltCompensatedHeading;
      if (heading === null) return;
      const now = event.timeStamp > 0 ? event.timeStamp : performance.now();
      const wasCalibrated =
        headingCalibrationRef.current.calibratedDeviceHeadingDegrees !== null;
      const calibration = processHeadingSample(
        headingCalibrationRef.current,
        heading,
        now,
      );
      headingCalibrationRef.current = calibration.state;
      if (!calibration.accepted || calibration.mapHeadingDegrees === null) {
        return;
      }
      if (!wasCalibrated && calibration.calibrated) {
        stepDetectorRef.current = createStepDetectorState();
        setHeadingCalibrated(true);
        setTrackingMessage("ตั้งทิศเรียบร้อย เริ่มเดินตามลูกศรได้");
      }
      const elapsedMs =
        lastAppliedHeadingAtRef.current === null
          ? 16
          : now - lastAppliedHeadingAtRef.current;
      lastAppliedHeadingAtRef.current = now;
      const targetHeading = calibration.mapHeadingDegrees;
      const responsiveHeading = smoothHeadingDegrees(
        headingRef.current,
        targetHeading,
        adaptiveHeadingResponsiveness(
          headingRef.current,
          targetHeading,
          elapsedMs,
        ),
      );
      headingRef.current = responsiveHeading;
      setMapHeadingDegrees(responsiveHeading);
    }

    function handleMotion(event: DeviceMotionEvent) {
      if (
        headingCalibrationRef.current.calibratedDeviceHeadingDegrees === null
      ) {
        return;
      }
      const currentRouteProgress = routeProgressRef.current;
      if (!currentRouteProgress) return;
      const now = event.timeStamp > 0 ? event.timeStamp : performance.now();
      const magnitude = motionMagnitude(
        event.acceleration,
        event.accelerationIncludingGravity,
      );
      const detection = processMotionSample(
        stepDetectorRef.current,
        magnitude,
        now,
        rotationRateMagnitude(event.rotationRate),
      );
      stepDetectorRef.current = detection.state;

      let nextRouteProgress = currentRouteProgress;
      let nextPosition = positionRef.current;
      let isOffRoute = offRouteTrackerRef.current.offRoute;
      if (detection.detected) {
        nextRouteProgress = updateRouteProgress(
          routePoints,
          currentRouteProgress,
          detection.stepMeters,
          headingRef.current,
          detection.confidence,
        );
        routeProgressRef.current = nextRouteProgress;
        setRouteProgress(nextRouteProgress);
        nextPosition = nextRouteProgress.matchedPosition;
        positionRef.current = nextPosition;
        setCurrentPosition(nextPosition);

        const previousOffRoute = offRouteTrackerRef.current;
        const nextOffRoute = updateOffRouteTracker(
          previousOffRoute,
          nextRouteProgress.crossTrackMeters,
        );
        offRouteTrackerRef.current = nextOffRoute;
        isOffRoute = nextOffRoute.offRoute;
        if (previousOffRoute.offRoute !== nextOffRoute.offRoute) {
          setOffRoute(nextOffRoute.offRoute);
        }
      }

      const previousArrival = arrivalTrackerRef.current;
      const nextArrival = updateArrivalTracker(
        previousArrival,
        nextRouteProgress.remainingDistanceMeters,
        now,
      );
      arrivalTrackerRef.current = nextArrival;
      const arrivalChanged = previousArrival.arrived !== nextArrival.arrived;
      const candidateChanged =
        previousArrival.candidateSinceMs !== nextArrival.candidateSinceMs;
      if (arrivalChanged) setArrived(nextArrival.arrived);

      if (nextArrival.arrived) {
        setTrackingMessage(`ถึง ${destination.inventoryName} แล้ว`);
      } else if (nextArrival.candidateSinceMs !== null) {
        setTrackingMessage(
          "ใกล้ถึงสินค้าแล้ว อยู่ในตำแหน่งนี้สักครู่เพื่อยืนยัน",
        );
      } else if (detection.detected || candidateChanged) {
        setTrackingMessage(
          isOffRoute
            ? "ดูเหมือนออกนอกเส้นทาง กรุณากลับไปหาเส้นสีฟ้า"
            : "กำลังติดตามตำแหน่งจากการเดิน",
        );
      }

      if (!detection.detected && !arrivalChanged) return;

      const activeSessionId = sessionIdRef.current;
      if (activeSessionId) {
        void fetch(`/api/live-map/sessions/${activeSessionId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            x: nextPosition.x,
            z: nextPosition.z,
            mode: "ar",
            status: nextArrival.arrived ? "arrived" : "navigating",
          }),
          keepalive: true,
        });
      }
    }

    function handleScreenOrientationChange() {
      const currentRouteProgress = routeProgressRef.current;
      if (!currentRouteProgress) return;
      headingCalibrationRef.current = createHeadingCalibrationState(
        currentRouteProgress.routeBearingDegrees,
      );
      lastAppliedHeadingAtRef.current = null;
      stepDetectorRef.current = createStepDetectorState();
      headingRef.current = currentRouteProgress.routeBearingDegrees;
      setMapHeadingDegrees(currentRouteProgress.routeBearingDegrees);
      setHeadingCalibrated(false);
      headingCalibrationActiveRef.current = false;
      setHeadingCalibrationActive(false);
      setTrackingMessage(
        "หน้าจอหมุนแล้ว ชี้โทรศัพท์ตามทางแล้วแตะตั้งทิศอีกครั้ง",
      );
    }

    const supportsAbsoluteOrientation = "ondeviceorientationabsolute" in window;
    const orientationEventName = supportsAbsoluteOrientation
      ? "deviceorientationabsolute"
      : "deviceorientation";
    window.addEventListener(
      orientationEventName,
      handleOrientation as EventListener,
      true,
    );
    window.addEventListener("devicemotion", handleMotion);
    if (window.screen.orientation) {
      window.screen.orientation.addEventListener(
        "change",
        handleScreenOrientationChange,
      );
    } else {
      window.addEventListener(
        "orientationchange",
        handleScreenOrientationChange,
      );
    }
    return () => {
      window.removeEventListener(
        orientationEventName,
        handleOrientation as EventListener,
        true,
      );
      window.removeEventListener("devicemotion", handleMotion);
      if (window.screen.orientation) {
        window.screen.orientation.removeEventListener(
          "change",
          handleScreenOrientationChange,
        );
      } else {
        window.removeEventListener(
          "orientationchange",
          handleScreenOrientationChange,
        );
      }
    };
  }, [cameraActive, route, selectedDestination]);

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
    positionRef.current = data.anchor.start;
    setCurrentPosition(data.anchor.start);
    routeProgressRef.current = null;
    setRouteProgress(null);
    arrivalTrackerRef.current = createArrivalTrackerState();
    offRouteTrackerRef.current = createOffRouteTrackerState();
    setOffRoute(false);
    setArrived(false);
    setHeadingCalibrated(false);
    headingCalibrationActiveRef.current = false;
    setHeadingCalibrationActive(false);
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
    const initialProgress = createRouteProgressState(initialRoute.points);
    routeProgressRef.current = initialProgress;
    setRouteProgress(initialProgress);
    positionRef.current = initialProgress.matchedPosition;
    setCurrentPosition(initialProgress.matchedPosition);
    headingCalibrationRef.current = createHeadingCalibrationState(
      initialProgress.routeBearingDegrees,
    );
    headingRef.current = initialProgress.routeBearingDegrees;
    setMapHeadingDegrees(initialProgress.routeBearingDegrees);

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
      arrivalTrackerRef.current = createArrivalTrackerState(
        arrivalTrackerRef.current.arrived,
      );
      const currentRouteProgress = routeProgressRef.current;
      if (!currentRouteProgress) {
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        setTrackingMessage("ยังไม่มีเส้นทางที่พร้อมสำหรับ AR");
        return;
      }
      headingCalibrationRef.current = createHeadingCalibrationState(
        currentRouteProgress.routeBearingDegrees,
      );
      lastAppliedHeadingAtRef.current = null;
      stepDetectorRef.current = createStepDetectorState();
      const initialHeading = currentRouteProgress.routeBearingDegrees;
      headingRef.current = initialHeading;
      setMapHeadingDegrees(initialHeading);
      setHeadingCalibrated(false);
      headingCalibrationActiveRef.current = false;
      setHeadingCalibrationActive(false);
      setMode("ar");
      setCameraActive(true);
      setTrackingMessage("ชี้โทรศัพท์ไปตามทางเดิน แล้วแตะตั้งทิศและเริ่มเดิน");

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
    arrivalTrackerRef.current = createArrivalTrackerState(
      arrivalTrackerRef.current.arrived,
    );
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
    setMode("map");
    setHeadingCalibrated(false);
    headingCalibrationActiveRef.current = false;
    setHeadingCalibrationActive(false);
    setTrackingMessage("ปิดกล้องแล้ว ยังดูเส้นทางบนแผนที่ได้");
    window.requestAnimationFrame(() => {
      productSelectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  function recalibrate() {
    if (!route) return;
    const initialProgress = createRouteProgressState(route.points);
    routeProgressRef.current = initialProgress;
    setRouteProgress(initialProgress);
    positionRef.current = initialProgress.matchedPosition;
    setCurrentPosition(initialProgress.matchedPosition);
    headingCalibrationRef.current = createHeadingCalibrationState(
      initialProgress.routeBearingDegrees,
    );
    lastAppliedHeadingAtRef.current = null;
    stepDetectorRef.current = createStepDetectorState();
    arrivalTrackerRef.current = createArrivalTrackerState();
    offRouteTrackerRef.current = createOffRouteTrackerState();
    const initialHeading = initialProgress.routeBearingDegrees;
    headingRef.current = initialHeading;
    setMapHeadingDegrees(initialHeading);
    setHeadingCalibrated(false);
    headingCalibrationActiveRef.current = false;
    setHeadingCalibrationActive(false);
    setOffRoute(false);
    setArrived(false);
    setTrackingMessage("ตั้งตำแหน่งกลับไปยังจุด QR Anchor แล้ว");
  }

  function beginHeadingCalibration(message: string) {
    const currentRouteProgress = routeProgressRef.current;
    if (!currentRouteProgress) return;
    headingCalibrationRef.current = createHeadingCalibrationState(
      currentRouteProgress.routeBearingDegrees,
    );
    lastAppliedHeadingAtRef.current = null;
    stepDetectorRef.current = createStepDetectorState();
    headingRef.current = currentRouteProgress.routeBearingDegrees;
    setMapHeadingDegrees(currentRouteProgress.routeBearingDegrees);
    setHeadingCalibrated(false);
    headingCalibrationActiveRef.current = true;
    setHeadingCalibrationActive(true);
    setTrackingMessage(message);
  }

  function recalibrateHeading() {
    beginHeadingCalibration(
      "กำลังตั้งทิศใหม่ กรุณาชี้ตามทางและถือนิ่งประมาณ 1 วินาที",
    );
  }

  async function markArrived() {
    arrivalTrackerRef.current = createArrivalTrackerState(true);
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
              {!headingCalibrationActive
                ? "ชี้ตามทางแล้วแตะปุ่มตั้งทิศด้านล่าง"
                : !headingCalibrated
                  ? "กำลังตั้งทิศ กรุณาถือโทรศัพท์ให้นิ่ง"
                  : remainingDistanceMeters !== null
                    ? `เหลือประมาณ ${remainingDistanceMeters.toFixed(1)} เมตร`
                    : "กำลังหาเส้นทาง"}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={recalibrateHeading}
            aria-label="ตั้งทิศลูกศรใหม่"
            className="shrink-0 rounded-full bg-black/55 text-white backdrop-blur hover:bg-black/75 hover:text-white"
          >
            <RotateCcw className="size-5" />
          </Button>
        </div>

        <div className="absolute inset-0 flex flex-col items-center justify-center gap-5">
          <div
            className="flex size-32 will-change-transform items-center justify-center rounded-full border-4 border-white/80 bg-cyan-400/80 shadow-2xl"
            style={{ transform: `rotate(${arrowRotation}deg)` }}
          >
            <Navigation className="size-20 fill-current text-white" />
          </div>
          {!headingCalibrationActive && (
            <Button
              type="button"
              onClick={() =>
                beginHeadingCalibration(
                  "กำลังตั้งทิศ กรุณาชี้ตามทางและถือนิ่งประมาณ 1 วินาที",
                )
              }
              className="rounded-full bg-white px-6 text-black shadow-xl hover:bg-white/90"
            >
              ตั้งทิศและเริ่มเดิน
            </Button>
          )}
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
                  {remainingDistanceMeters !== null
                    ? `${remainingDistanceMeters.toFixed(1)} m`
                    : "—"}
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
                      เปิด AR และตั้งทิศตามทางเดิน
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
