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
