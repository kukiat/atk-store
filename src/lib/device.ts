import type { NextRequest } from "next/server";
import { userAgent } from "next/server";

export function isMobileOrTabletRequest(request: NextRequest): boolean {
  const deviceType = userAgent(request).device.type;
  return deviceType === "mobile" || deviceType === "tablet";
}
