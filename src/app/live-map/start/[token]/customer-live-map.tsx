"use client";

import { useMemo, useState } from "react";

import { MapPin, Navigation, Search } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { calculateWalkRoute } from "@/lib/live-map-routing";
import { cn } from "@/lib/utils";
import type {
  CustomerLiveMapData,
  MapPoint,
} from "@/services/live-map.service";

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

export function CustomerLiveMap({ data }: { data: CustomerLiveMapData }) {
  const [query, setQuery] = useState("");
  const [selectedDestinationId, setSelectedDestinationId] = useState("");
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

  return (
    <main className="mx-auto grid w-full max-w-4xl flex-1 gap-4 px-4 py-4 sm:px-6 sm:py-6">
      <Card>
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
                      onClick={() => setSelectedDestinationId(destination.id)}
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
                : "จุดสีเหลืองคือตำแหน่งเริ่มต้น จุดสีเขียวคือตำแหน่งสินค้า"}
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
                  onClick={() => setSelectedDestinationId(destination.id)}
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
              r={markerRadius * 1.2}
              fill="#fbbf24"
              stroke="#ffffff"
              strokeWidth={pathStroke}
            >
              <title>จุดเริ่มต้น {data.anchor.code}</title>
            </circle>
          </svg>

          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="size-3 rounded-full bg-amber-400" />
              จุดเริ่มต้น
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
