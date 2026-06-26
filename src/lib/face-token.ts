import "server-only";

const REAUTH_SKEW_SECONDS = 30;

type JwtPayload = {
  exp?: unknown;
};

export type FaceTokenStatus =
  | { ready: true; expiresAt: string }
  | { ready: false; reason: "missing" | "expired" | "invalid" };

/**
 * Lightweight UX preflight for the path-scoped Google ID token used by the
 * Cognito bridge. This does not authenticate the user; API routes still use the
 * DB-backed app session and Cognito still validates the Logins token. It only
 * lets the UI know whether starting a camera flow would immediately require
 * re-authentication.
 */
export function getFaceTokenStatus(token: string | undefined): FaceTokenStatus {
  if (!token) return { ready: false, reason: "missing" };

  const payload = decodeJwtPayload(token);
  if (!payload) return { ready: false, reason: "invalid" };

  if (typeof payload.exp !== "number") {
    return { ready: false, reason: "invalid" };
  }

  const expiresAtMs = payload.exp * 1000;
  const isExpired = expiresAtMs <= Date.now() + REAUTH_SKEW_SECONDS * 1000;

  if (isExpired) return { ready: false, reason: "expired" };

  return { ready: true, expiresAt: new Date(expiresAtMs).toISOString() };
}

function decodeJwtPayload(token: string): JwtPayload | null {
  const [, payload] = token.split(".");
  if (!payload) return null;

  try {
    const json = Buffer.from(base64UrlToBase64(payload), "base64").toString(
      "utf8",
    );
    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
}

function base64UrlToBase64(value: string): string {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = base64.length % 4;
  if (padding === 0) return base64;
  return `${base64}${"=".repeat(4 - padding)}`;
}
