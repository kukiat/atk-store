/**
 * Auth constants shared between the server-only data-access layer and the
 * edge-safe proxy. Keep this file free of `server-only`, `next/headers`, and
 * DB imports so it can be used from `proxy.ts`.
 */

/** Name of the httpOnly cookie holding the opaque session token. */
export const SESSION_COOKIE = "atk_session";
export const GOOGLE_OAUTH_STATE_COOKIE = "atk_google_oauth_state";
export const GOOGLE_OAUTH_PKCE_COOKIE = "atk_google_oauth_pkce";
export const GOOGLE_OAUTH_NONCE_COOKIE = "atk_google_oauth_nonce";

/**
 * Short-lived cookie holding the verified Google ID token. It is the input to
 * the Cognito credential bridge for face enrollment. Path-scoped to the face
 * API so it is never sent on ordinary page or shelf requests, and it naturally
 * expires roughly when the Google ID token does (~1 hour).
 */
export const GOOGLE_ID_TOKEN_COOKIE = "atk_g_idt";
export const GOOGLE_ID_TOKEN_COOKIE_PATH = "/api/face";

/** Approximate lifetime of a Google ID token (1 hour). */
const GOOGLE_ID_TOKEN_MAX_AGE = 60 * 60;

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

/** OAuth correlation values are short-lived and never readable by client JS. */
export function oauthCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 10,
  };
}

/**
 * Options for the path-scoped, httpOnly Google ID token cookie consumed by the
 * credential bridge. Never readable by client JS.
 */
export function googleIdTokenCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: GOOGLE_ID_TOKEN_COOKIE_PATH,
    maxAge: GOOGLE_ID_TOKEN_MAX_AGE,
  };
}
