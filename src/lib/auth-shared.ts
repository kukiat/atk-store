/**
 * Auth constants shared between the server-only data-access layer and the
 * edge-safe proxy. Keep this file free of `server-only`, `next/headers`, and
 * DB imports so it can be used from `proxy.ts`.
 */

/** Name of the httpOnly cookie holding the opaque session token. */
export const SESSION_COOKIE = "atk_session";

/** Where unauthenticated users are sent. */
export const SIGN_IN_PATH = "/signin";

/** Routes reachable without a session. Everything else requires sign-in. */
export const PUBLIC_PATHS = [SIGN_IN_PATH];

/** Cookie options for the session cookie (set on the server response). */
export function sessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    expires: expiresAt,
  };
}
