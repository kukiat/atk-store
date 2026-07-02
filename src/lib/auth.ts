import "server-only";

import { cookies } from "next/headers";
import { cache } from "react";

import type { User } from "@/db/schema";
import { userService } from "@/services/user.service";

import { SESSION_COOKIE } from "./auth-shared";

/**
 * Secure (database-backed) auth check for use in Server Components, Server
 * Actions, and Route Handlers. Memoized per request via React `cache` so
 * multiple calls in one render share a single DB lookup.
 *
 * Returns the signed-in user, or null when there is no valid session.
 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return userService.getUserBySession(token);
});

export class AuthenticationRequiredError extends Error {
  constructor() {
    super("Authentication is required");
    this.name = "AuthenticationRequiredError";
  }
}

/** Use in every private Route Handler or Server Action. */
export async function requireCurrentUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new AuthenticationRequiredError();
  return user;
}

function getOrigin(value: string | null): string | null {
  if (!value) return null;

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function getForwardedOrigin(request: Request): string | null {
  const forwardedHost =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!forwardedHost) return null;

  const forwardedProto =
    request.headers.get("x-forwarded-proto") ??
    new URL(request.url).protocol.replace(":", "");

  return getOrigin(`${forwardedProto}://${forwardedHost}`);
}

/** Reject browser-originated mutations from an unexpected origin. */
export function hasSameOrigin(request: Request): boolean {
  const origin = getOrigin(request.headers.get("origin"));
  if (!origin) return false;

  const allowedOrigins = new Set(
    [
      new URL(request.url).origin,
      getForwardedOrigin(request),
      getOrigin(process.env.AUTH_URL ?? null),
    ].filter((value): value is string => Boolean(value)),
  );

  return allowedOrigins.has(origin);
}
