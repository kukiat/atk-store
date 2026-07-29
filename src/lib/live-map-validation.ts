import {
  calculateWalkRoute,
  nearestWalkPathPoint,
  type RoutePoint,
  type WalkPath,
} from "@/lib/live-map-routing";

export type LiveMapValidationInput = {
  boundary: RoutePoint[];
  paths: Array<WalkPath & { id: string; name: string }>;
  anchors: Array<{
    id: string;
    code: string;
    startX: number;
    startZ: number;
  }>;
  locations: Array<{
    id: string;
    inventoryName: string;
    x: number;
    z: number;
  }>;
};

export type LiveMapValidationIssue = {
  severity: "error" | "warning";
  code: string;
  message: string;
};

const MAX_PATH_CONNECTOR_METERS = 0.8;

export function validateLiveMap(
  input: LiveMapValidationInput,
): LiveMapValidationIssue[] {
  const issues: LiveMapValidationIssue[] = [];

  if (input.boundary.length < 3) {
    issues.push({
      severity: "error",
      code: "boundary-missing",
      message: "ยังไม่ได้กำหนด Boundary ของร้าน",
    });
  }
  if (input.paths.every((path) => path.points.length < 2)) {
    issues.push({
      severity: "error",
      code: "path-missing",
      message: "ยังไม่มี Walk path ที่ใช้คำนวณเส้นทาง",
    });
  }
  if (input.anchors.length === 0) {
    issues.push({
      severity: "error",
      code: "anchor-missing",
      message: "ยังไม่มี QR Anchor สำหรับระบุตำแหน่งเริ่มต้น",
    });
  }
  if (input.locations.length === 0) {
    issues.push({
      severity: "warning",
      code: "location-missing",
      message: "ยังไม่มีตำแหน่งสินค้าให้ลูกค้าเลือก",
    });
  }

  for (const anchor of input.anchors) {
    const start = { x: anchor.startX, z: anchor.startZ };
    const nearest = nearestWalkPathPoint(input.paths, start);
    if (nearest && nearest.distanceMeters > MAX_PATH_CONNECTOR_METERS) {
      issues.push({
        severity: "warning",
        code: `anchor-away-from-path:${anchor.id}`,
        message: `จุดเริ่มของ QR ${anchor.code} อยู่ห่าง Walk path ${nearest.distanceMeters.toFixed(1)} เมตร`,
      });
    }
  }

  for (const location of input.locations) {
    const target = { x: location.x, z: location.z };
    const nearest = nearestWalkPathPoint(input.paths, target);
    if (nearest && nearest.distanceMeters > MAX_PATH_CONNECTOR_METERS) {
      issues.push({
        severity: "warning",
        code: `location-away-from-path:${location.id}`,
        message: `${location.inventoryName} อยู่ห่าง Walk path ${nearest.distanceMeters.toFixed(1)} เมตร`,
      });
    }

    for (const anchor of input.anchors) {
      const route = calculateWalkRoute(
        input.paths,
        { x: anchor.startX, z: anchor.startZ },
        target,
      );
      if (!route) {
        issues.push({
          severity: "error",
          code: `route-missing:${anchor.id}:${location.id}`,
          message: `ไม่มีเส้นทางจาก QR ${anchor.code} ไป ${location.inventoryName}`,
        });
      }
    }
  }

  return issues;
}
