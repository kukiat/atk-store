import { NextResponse, type NextRequest, userAgent } from "next/server";

import { PUBLIC_PATHS, SESSION_COOKIE, SIGN_IN_PATH } from "@/lib/auth-shared";

/**
 * Optimistic auth gate (runs before every matched route):
 *   - no session  + protected route  → redirect to the sign-in page
 *
 * This is a fast cookie-presence check only. The real (database-backed) check
 * happens in `getCurrentUser()` inside Server Components / Route Handlers.
 * Do not redirect public pages based only on cookie presence: a stale cookie
 * would otherwise bounce between `/signin` and `/` forever.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  const deviceType = userAgent(request).device.type;
  const mobileOnly =
    pathname === "/cart" ||
    pathname === "/scan" ||
    pathname.startsWith("/scan/") ||
    pathname.startsWith("/shelf/");
  const isPublic = PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );

  if (!hasSession && !isPublic) {
    return NextResponse.redirect(new URL(SIGN_IN_PATH, request.url));
  }

  if (
    mobileOnly &&
    deviceType !== "mobile" &&
    deviceType !== "tablet" &&
    pathname !== "/unsupported-device"
  ) {
    return NextResponse.redirect(new URL("/unsupported-device", request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Run on everything except API routes, Next internals, and static assets.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.svg$).*)"],
};
